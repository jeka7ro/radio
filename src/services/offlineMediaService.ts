import Hls from 'hls.js';

export interface OfflineMediaItem {
  id: string;
  title: string;
  subtitleLabel?: string;
  poster?: string;
  mediaType: 'hls' | 'blob';
  mimeType?: string;
  sizeBytes: number;
  duration: number;
  createdAt: number;
  qualityLabel: string;
  audioLabel?: string;
  masterM3u8?: string;
  videoM3u8?: string;
  audioM3u8?: string;
  videoSegCount?: number;
  audioSegCount?: number;
}

export interface OfflineDownloadProgress {
  percent: number;
  downloadedBytes: number;
  totalSegments: number;
  completedSegments: number;
  stage: string;
}

const DB_NAME = 'aether_offline_media_db_v1';
const DB_VERSION = 1;
const STORE_ITEMS = 'items';
const STORE_BLOBS = 'blobs';

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putBlobChunk(key: string, value: ArrayBuffer | Blob): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readwrite');
    tx.objectStore(STORE_BLOBS).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getBlobChunk(key: string): Promise<ArrayBuffer | Blob | null> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readonly');
    const req = tx.objectStore(STORE_BLOBS).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveOfflineItemMeta(item: OfflineMediaItem): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ITEMS, 'readwrite');
    tx.objectStore(STORE_ITEMS).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineItemMeta(id: string): Promise<OfflineMediaItem | null> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ITEMS, 'readonly');
    const req = tx.objectStore(STORE_ITEMS).get(id);
    req.onsuccess = () => resolve((req.result as OfflineMediaItem) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function listOfflineItems(): Promise<OfflineMediaItem[]> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ITEMS, 'readonly');
    const req = tx.objectStore(STORE_ITEMS).getAll();
    req.onsuccess = () => {
      const list = (req.result as OfflineMediaItem[]) || [];
      list.sort((a, b) => b.createdAt - a.createdAt);
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteOfflineItem(id: string): Promise<void> {
  const item = await getOfflineItemMeta(id);
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_ITEMS, STORE_BLOBS], 'readwrite');
    tx.objectStore(STORE_ITEMS).delete(id);
    const blobStore = tx.objectStore(STORE_BLOBS);
    blobStore.delete(`${id}::file`);
    const vCount = item?.videoSegCount || 0;
    const aCount = item?.audioSegCount || 0;
    for (let i = 0; i < vCount; i++) {
      blobStore.delete(`${id}::v_${i}`);
    }
    for (let i = 0; i < aCount; i++) {
      blobStore.delete(`${id}::a_${i}`);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

/**
 * Save a local File (.mp4, .mkv, .webm, .mov) into IndexedDB so it persists in the Offline Library
 */
export async function saveLocalFileToOfflineDb(
  file: File,
  customTitle?: string
): Promise<OfflineMediaItem> {
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const cleanTitle = (customTitle || file.name).replace(/\.[a-z0-9]{2,4}$/i, '');
  await putBlobChunk(`${id}::file`, file);
  const item: OfflineMediaItem = {
    id,
    title: cleanTitle,
    subtitleLabel: 'Fișier salvat local pe dispozitiv',
    mediaType: 'blob',
    mimeType: file.type || 'video/mp4',
    sizeBytes: file.size,
    duration: 0,
    createdAt: Date.now(),
    qualityLabel: 'Original Local',
  };
  await saveOfflineItemMeta(item);
  return item;
}

function resolveRelativeUrl(baseUrl: string, rel: string): string {
  try {
    return new URL(rel.trim(), baseUrl).toString();
  } catch {
    return rel.trim();
  }
}

interface ParsedMasterPlaylist {
  videoVariants: Array<{
    url: string;
    resolution: string;
    height: number;
    bandwidth: number;
    audioGroup?: string;
    codecs?: string;
  }>;
  audioTracks: Array<{
    groupId: string;
    name: string;
    lang: string;
    url: string;
  }>;
}

function parseMasterM3u8(text: string, masterUrl: string): ParsedMasterPlaylist {
  const lines = text.split(/\r?\n/);
  const audioTracks: ParsedMasterPlaylist['audioTracks'] = [];
  const videoVariants: ParsedMasterPlaylist['videoVariants'] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXT-X-MEDIA:') && line.includes('TYPE=AUDIO')) {
      const uriMatch = line.match(/URI="([^"]+)"/i);
      const groupMatch = line.match(/GROUP-ID="([^"]+)"/i);
      const nameMatch = line.match(/NAME="([^"]+)"/i);
      const langMatch = line.match(/LANGUAGE="([^"]+)"/i);
      if (uriMatch?.[1] && !groupMatch?.[1]?.startsWith('failover-')) {
        audioTracks.push({
          groupId: groupMatch?.[1] || 'audio0',
          name: nameMatch?.[1] || 'Audio',
          lang: langMatch?.[1] || 'ru',
          url: resolveRelativeUrl(masterUrl, uriMatch[1]),
        });
      }
    } else if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const resMatch = line.match(/RESOLUTION=(\d+x(\d+))/i);
      const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
      const audioMatch = line.match(/AUDIO="([^"]+)"/i);
      const codecsMatch = line.match(/CODECS="([^"]+)"/i);
      const audioGroup = audioMatch?.[1] || '';
      // Skip failover duplicate variants
      if (audioGroup.startsWith('failover-')) continue;

      let nextLine = '';
      for (let j = i + 1; j < lines.length; j++) {
        const cand = lines[j].trim();
        if (cand && !cand.startsWith('#')) {
          nextLine = cand;
          i = j;
          break;
        }
      }
      if (nextLine) {
        videoVariants.push({
          url: resolveRelativeUrl(masterUrl, nextLine),
          resolution: resMatch?.[1] || '1280x720',
          height: Number(resMatch?.[2]) || 720,
          bandwidth: Number(bwMatch?.[1]) || 800000,
          audioGroup,
          codecs: codecsMatch?.[1] || 'avc1.64001f,mp4a.40.2',
        });
      }
    }
  }

  return { videoVariants, audioTracks };
}

function parseMediaSegmentM3u8(
  text: string,
  playlistUrl: string,
  offlinePrefix: string
): {
  segmentUrls: string[];
  rewrittenM3u8: string;
  totalDuration: number;
} {
  const lines = text.split(/\r?\n/);
  const segmentUrls: string[] = [];
  const outLines: string[] = [];
  let totalDuration = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      const durMatch = line.match(/^#EXTINF:([\d.]+)/i);
      if (durMatch?.[1]) {
        totalDuration += parseFloat(durMatch[1]) || 0;
      }
      outLines.push(line);
    } else {
      const idx = segmentUrls.length;
      segmentUrls.push(resolveRelativeUrl(playlistUrl, line));
      outLines.push(`${offlinePrefix}_${idx}.ts`);
    }
  }

  if (!outLines.some((l) => l.startsWith('#EXT-X-ENDLIST'))) {
    outLines.push('#EXT-X-ENDLIST');
  }

  return {
    segmentUrls,
    rewrittenM3u8: outLines.join('\n'),
    totalDuration: Math.round(totalDuration),
  };
}

/**
 * Downloads an HLS movie/episode (video + audio segments) into IndexedDB for 100% offline playback.
 */
export async function downloadHlsToOfflineDb(params: {
  id: string;
  title: string;
  subtitleLabel?: string;
  poster?: string;
  masterM3u8Url: string;
  preferredHeight?: number; // e.g. 360 or 720
  audioTrackIndex?: number;
  audioLabel?: string;
  signal?: AbortSignal;
  onProgress?: (prog: OfflineDownloadProgress) => void;
}): Promise<OfflineMediaItem> {
  const {
    id,
    title,
    subtitleLabel,
    poster,
    masterM3u8Url,
    preferredHeight = 360,
    audioTrackIndex = 0,
    audioLabel = 'Русский / Original',
    signal,
    onProgress,
  } = params;

  const masterRes = await fetch(masterM3u8Url, { signal });
  if (!masterRes.ok) {
    throw new Error(`Eroare la citirea streamului (${masterRes.status})`);
  }
  const masterText = await masterRes.text();
  const encId = encodeURIComponent(id);

  // Check if masterM3u8Url is already a single media playlist or a master playlist
  const isMaster = masterText.includes('#EXT-X-STREAM-INF');

  let videoPlaylistUrl = masterM3u8Url;
  let audioPlaylistUrl = '';
  let chosenResolution = '1280x720';
  let chosenCodecs = 'avc1.64001f,mp4a.40.2';

  if (isMaster) {
    const parsed = parseMasterM3u8(masterText, masterM3u8Url);
    if (parsed.videoVariants.length === 0) {
      throw new Error('Nu s-au găsit variante video în playlist');
    }

    // Pick variant closest to preferredHeight
    const sorted = [...parsed.videoVariants].sort(
      (a, b) =>
        Math.abs(a.height - preferredHeight) -
        Math.abs(b.height - preferredHeight)
    );
    const chosenVariant = sorted[0];
    videoPlaylistUrl = chosenVariant.url;
    chosenResolution = chosenVariant.resolution;
    chosenCodecs = chosenVariant.codecs || chosenCodecs;

    if (parsed.audioTracks.length > 0) {
      const chosenAudio =
        parsed.audioTracks[
          Math.min(audioTrackIndex, parsed.audioTracks.length - 1)
        ] || parsed.audioTracks[0];
      audioPlaylistUrl = chosenAudio.url;
    }
  }

  // Fetch video media playlist
  const vRes = await fetch(videoPlaylistUrl, { signal });
  if (!vRes.ok) {
    throw new Error('Nu s-a putut descărca lista de segmente video');
  }
  const vText = await vRes.text();
  const parsedVideo = parseMediaSegmentM3u8(
    vText,
    videoPlaylistUrl,
    `https://offline.local/${encId}/seg/v`
  );

  // Fetch audio media playlist if separate
  let parsedAudio: ReturnType<typeof parseMediaSegmentM3u8> | null = null;
  if (audioPlaylistUrl) {
    const aRes = await fetch(audioPlaylistUrl, { signal });
    if (aRes.ok) {
      const aText = await aRes.text();
      parsedAudio = parseMediaSegmentM3u8(
        aText,
        audioPlaylistUrl,
        `https://offline.local/${encId}/seg/a`
      );
    }
  }

  const totalVideoSegs = parsedVideo.segmentUrls.length;
  const totalAudioSegs = parsedAudio ? parsedAudio.segmentUrls.length : 0;
  const totalSegments = totalVideoSegs + totalAudioSegs;

  if (totalSegments === 0) {
    throw new Error('Streamul nu conține segmente descărcabile');
  }

  let completedSegments = 0;
  let downloadedBytes = 0;

  const tasks: Array<{ key: string; url: string }> = [];
  const maxLen = Math.max(totalVideoSegs, totalAudioSegs);
  // Interleave video and audio segments so even partial downloads have synced audio+video
  for (let i = 0; i < maxLen; i++) {
    if (i < totalVideoSegs) {
      tasks.push({ key: `${id}::v_${i}`, url: parsedVideo.segmentUrls[i] });
    }
    if (parsedAudio && i < totalAudioSegs) {
      tasks.push({ key: `${id}::a_${i}`, url: parsedAudio.segmentUrls[i] });
    }
  }

  const CONCURRENCY = 6;
  let cursor = 0;

  const worker = async () => {
    while (cursor < tasks.length) {
      if (signal?.aborted) {
        throw new DOMException('Descărcare anulată', 'AbortError');
      }
      const taskIdx = cursor++;
      const task = tasks[taskIdx];
      if (!task) break;

      let buf: ArrayBuffer | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const segRes = await fetch(task.url, { signal });
          if (segRes.ok) {
            buf = await segRes.arrayBuffer();
            break;
          }
        } catch (err) {
          if (signal?.aborted) throw err;
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }

      if (!buf) {
        throw new Error(`Eroare la descărcarea segmentului #${taskIdx + 1}`);
      }

      await putBlobChunk(task.key, buf);
      completedSegments++;
      downloadedBytes += buf.byteLength;

      if (onProgress) {
        onProgress({
          percent: Math.min(
            99,
            Math.round((completedSegments / totalSegments) * 100)
          ),
          downloadedBytes,
          totalSegments,
          completedSegments,
          stage: `Se descarcă (${completedSegments}/${totalSegments} segmente)...`,
        });
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => worker())
  );

  // Build offline master.m3u8
  const offlineMasterLines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  if (parsedAudio) {
    offlineMasterLines.push(
      `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio0",NAME="default",DEFAULT=YES,AUTOSELECT=YES,LANGUAGE="ru",URI="https://offline.local/${encId}/audio.m3u8"`
    );
    offlineMasterLines.push(
      `#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=900000,CODECS="${chosenCodecs}",RESOLUTION=${chosenResolution},AUDIO="audio0"`
    );
  } else {
    offlineMasterLines.push(
      `#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=900000,CODECS="${chosenCodecs}",RESOLUTION=${chosenResolution}`
    );
  }
  offlineMasterLines.push(`https://offline.local/${encId}/video.m3u8`);

  const item: OfflineMediaItem = {
    id,
    title,
    subtitleLabel,
    poster,
    mediaType: 'hls',
    sizeBytes: downloadedBytes,
    duration: parsedVideo.totalDuration,
    createdAt: Date.now(),
    qualityLabel: chosenResolution.includes('360') ? 'SD 360p' : 'HD 720p',
    audioLabel,
    masterM3u8: offlineMasterLines.join('\n'),
    videoM3u8: parsedVideo.rewrittenM3u8,
    audioM3u8: parsedAudio?.rewrittenM3u8,
    videoSegCount: totalVideoSegs,
    audioSegCount: totalAudioSegs,
  };

  await saveOfflineItemMeta(item);

  if (onProgress) {
    onProgress({
      percent: 100,
      downloadedBytes,
      totalSegments,
      completedSegments: totalSegments,
      stage: 'Descărcat complet! Disponibil Offline.',
    });
  }

  return item;
}

/**
 * Exports a downloaded offline video to the user's device Downloads folder
 */
export async function exportOfflineItemToDeviceFile(
  item: OfflineMediaItem
): Promise<void> {
  const safeName = item.title
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .trim()
    .slice(0, 80);

  if (item.mediaType === 'blob') {
    const chunk = await getBlobChunk(`${item.id}::file`);
    if (!chunk) throw new Error('Fișierul local nu a fost găsit în baza de date');
    const blob =
      chunk instanceof Blob
        ? chunk
        : new Blob([chunk], { type: item.mimeType || 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName || 'video'}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    return;
  }

  // For HLS items, assemble video segments into a downloadable .ts file
  const parts: BlobPart[] = [];
  const count = item.videoSegCount || 0;
  for (let i = 0; i < count; i++) {
    const seg = await getBlobChunk(`${item.id}::v_${i}`);
    if (seg) parts.push(seg);
  }
  const blob = new Blob(parts, { type: 'video/mp2t' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName || 'video'}.ts`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Custom hls.js loader that intercepts `https://offline.local/<id>/...` requests
 * and serves playlists and .ts segments directly from IndexedDB (100% offline).
 */
export function createOfflineAwareHlsLoader() {
  const BaseLoader = Hls.DefaultConfig.loader;

  return class OfflineAwareLoader extends BaseLoader {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    load(context: any, config: any, callbacks: any) {
      const url: string = context?.url || '';
      if (!url.startsWith('https://offline.local/')) {
        super.load(context, config, callbacks);
        return;
      }

      const start = performance.now();
      this.stats.loading.start = start;

      void (async () => {
        try {
          const parsedUrl = new URL(url);
          // pathname: /<encodedId>/master.m3u8 or /<encodedId>/seg/v_0.ts
          const parts = parsedUrl.pathname.split('/').filter(Boolean);
          const itemId = decodeURIComponent(parts[0] || '');
          const subPath = parts.slice(1).join('/');

          if (subPath.endsWith('.m3u8')) {
            const meta = await getOfflineItemMeta(itemId);
            if (!meta) throw new Error('Offline item not found');
            let manifest = '';
            if (subPath === 'master.m3u8') manifest = meta.masterM3u8 || '';
            else if (subPath === 'video.m3u8') manifest = meta.videoM3u8 || '';
            else if (subPath === 'audio.m3u8') manifest = meta.audioM3u8 || '';

            const now = performance.now();
            this.stats.loading.first = now;
            this.stats.loading.end = now;
            this.stats.loaded = manifest.length;
            this.stats.total = manifest.length;
            callbacks.onSuccess(
              { url, data: manifest },
              this.stats,
              context,
              null
            );
            return;
          }

          // Segment request: seg/v_0.ts or seg/a_0.ts
          const segMatch = subPath.match(/^seg\/([va]_\d+)\.ts$/);
          if (segMatch?.[1]) {
            const segKey = `${itemId}::${segMatch[1]}`;
            const chunk = await getBlobChunk(segKey);
            if (!chunk) throw new Error(`Missing offline segment ${segKey}`);
            const ab =
              chunk instanceof Blob ? await chunk.arrayBuffer() : chunk;
            const now = performance.now();
            this.stats.loading.first = now;
            this.stats.loading.end = now;
            this.stats.loaded = ab.byteLength;
            this.stats.total = ab.byteLength;
            callbacks.onSuccess({ url, data: ab }, this.stats, context, null);
            return;
          }

          throw new Error(`Unhandled offline URL: ${url}`);
        } catch (err) {
          callbacks.onError(
            {
              code: 404,
              text: err instanceof Error ? err.message : 'Offline load error',
            },
            context,
            null,
            this.stats
          );
        }
      })();
    }
  };
}


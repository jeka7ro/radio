import { useSyncExternalStore } from 'react';
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
  sourceLabel?: string;
  partCount?: number;
  hasVideoInit?: boolean;
  hasAudioInit?: boolean;
  masterM3u8?: string;
  videoM3u8?: string;
  audioM3u8?: string;
  videoSegCount?: number;
  audioSegCount?: number;
  savedSubCues?: Array<{ start: number; end: number; text: string }>;
  savedSubLabel?: string;
  vodId?: string;
  mediaKind?: 'movie' | 'series';
  season?: number;
  episode?: number;
  overview?: string;
  releaseYear?: string;
  rating?: string;
  backdrop?: string;
}

export interface OfflineDownloadProgress {
  title?: string;
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

let cachedDbPromise: Promise<IDBDatabase> | null = null;

function openOfflineDb(): Promise<IDBDatabase> {
  if (cachedDbPromise) return cachedDbPromise;
  cachedDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    const timer = window.setTimeout(() => {
      cachedDbPromise = null;
      reject(new Error('IndexedDB open timeout'));
    }, 10_000);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS);
      }
    };
    req.onsuccess = () => {
      window.clearTimeout(timer);
      const db = req.result;
      db.onclose = () => {
        cachedDbPromise = null;
      };
      db.onversionchange = () => {
        db.close();
        cachedDbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      window.clearTimeout(timer);
      cachedDbPromise = null;
      reject(req.error || new Error('IndexedDB open error'));
    };
    req.onblocked = () => {
      window.clearTimeout(timer);
      cachedDbPromise = null;
      reject(new Error('IndexedDB blocked'));
    };
  });
  return cachedDbPromise;
}

async function putBlobChunk(key: string, value: ArrayBuffer | Blob): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn();
    };
    const timer = window.setTimeout(() => {
      done(() => reject(new Error('IndexedDB write timeout (spațiu plin sau tab suspendat)')));
    }, 15_000);
    const tx = db.transaction(STORE_BLOBS, 'readwrite');
    tx.objectStore(STORE_BLOBS).put(value, key);
    tx.oncomplete = () => done(resolve);
    tx.onerror = () => done(() => reject(tx.error || new Error('IndexedDB write error')));
    tx.onabort = () =>
      done(() => reject(tx.error || new Error('IndexedDB transaction aborted (posibil spațiu insuficient)')));
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
    blobStore.delete(`${id}::v_init`);
    blobStore.delete(`${id}::a_init`);
    const vCount = item?.videoSegCount || 0;
    const aCount = item?.audioSegCount || 0;
    const pCount = item?.partCount || 0;
    for (let i = 0; i < vCount; i++) {
      blobStore.delete(`${id}::v_${i}`);
    }
    for (let i = 0; i < aCount; i++) {
      blobStore.delete(`${id}::a_${i}`);
    }
    for (let i = 0; i < pCount; i++) {
      blobStore.delete(`${id}::p_${i}`);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteBlobKeysSilent(keys: string[]): Promise<void> {
  if (!keys.length) return;
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_BLOBS, 'readwrite');
      const store = tx.objectStore(STORE_BLOBS);
      for (const k of keys) {
        try {
          store.delete(k);
        } catch {
          // ignore
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    // ignore cleanup error
  }
}

/**
 * Retrieves a playable single Blob for a saved offline file (supports both single `${id}::file`
 * and chunked direct-video `${id}::p_0..N-1` items without copying everything into JS heap).
 */
export async function getOfflineFileBlob(
  item: OfflineMediaItem
): Promise<Blob | null> {
  const single = await getBlobChunk(`${item.id}::file`);
  if (single) {
    return single instanceof Blob
      ? single
      : new Blob([single], { type: item.mimeType || 'video/mp4' });
  }
  const partCount = item.partCount || 0;
  if (partCount > 0) {
    const parts: BlobPart[] = [];
    for (let i = 0; i < partCount; i++) {
      const chunk = await getBlobChunk(`${item.id}::p_${i}`);
      if (!chunk) return null;
      parts.push(chunk);
    }
    if (parts.length > 0) {
      return new Blob(parts, { type: item.mimeType || 'video/mp4' });
    }
  }
  return null;
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
  const trimmedRel = rel.trim();
  if (!trimmedRel) return trimmedRel;
  try {
    if (
      trimmedRel.startsWith('http://') ||
      trimmedRel.startsWith('https://')
    ) {
      return trimmedRel;
    }
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://filmio.my';
    if (trimmedRel.startsWith('/')) {
      return new URL(trimmedRel, origin).toString();
    }
    const absBase =
      baseUrl.startsWith('http://') || baseUrl.startsWith('https://')
        ? baseUrl
        : new URL(baseUrl, origin).toString();
    return new URL(trimmedRel, absBase).toString();
  } catch {
    return trimmedRel;
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
        const resolvedUrl = resolveRelativeUrl(masterUrl, nextLine);
        const bwNum = Number(bwMatch?.[1]) || 800000;
        let inferredHeight = Number(resMatch?.[2]) || 0;
        if (!inferredHeight) {
          const urlHMatch = resolvedUrl.match(/(?:^|[^\d])(2160|1440|1080|720|480|360|240)p?(?:[^\d]|$)/i);
          if (urlHMatch?.[1]) {
            inferredHeight = Number(urlHMatch[1]);
          } else if (bwNum >= 3_800_000) {
            inferredHeight = 1080;
          } else if (bwNum >= 1_800_000) {
            inferredHeight = 720;
          } else if (bwNum >= 850_000) {
            inferredHeight = 480;
          } else {
            inferredHeight = 360;
          }
        }
        const inferredW = Math.round((inferredHeight * 16) / 9);
        videoVariants.push({
          url: resolvedUrl,
          resolution: resMatch?.[1] || `${inferredW}x${inferredHeight}`,
          height: inferredHeight,
          bandwidth: bwNum,
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
  initSegmentUrl?: string;
  rewrittenM3u8: string;
  totalDuration: number;
} {
  const lines = text.split(/\r?\n/);
  const segmentUrls: string[] = [];
  let initSegmentUrl: string | undefined;
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
      if (line.startsWith('#EXT-X-MAP:')) {
        const mapUriMatch = line.match(/URI="([^"]+)"/i);
        if (mapUriMatch?.[1]) {
          initSegmentUrl = resolveRelativeUrl(playlistUrl, mapUriMatch[1]);
          outLines.push(
            line.replace(/URI="([^"]+)"/i, `URI="${offlinePrefix}_init.mp4"`)
          );
          continue;
        }
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
    initSegmentUrl,
    rewrittenM3u8: outLines.join('\n'),
    totalDuration: Math.round(totalDuration),
  };
}

function isLikelyDirectVideoUrl(rawUrl: string): boolean {
  const checkSingle = (u: string): boolean => {
    if (!u) return false;
    if (/\.m3u8(\?|%3F|&|$)/i.test(u) || /video\.m3u8|master\.m3u8|index.*\.m3u8/i.test(u)) {
      return false;
    }
    if (u.includes('/api/filelist/stream')) return true;
    if (/\.(mp4|m4v|mkv|webm|mov)(\?|&|$)/i.test(u)) return true;
    const isVkDirectMp4 =
      /vkuser\.net|okcdn\.ru|mycdn\.me/i.test(u) &&
      /[?&]ct=[0145](?:&|$)/i.test(u) &&
      !/[?&]ct=6(?:&|$)/i.test(u);
    if (isVkDirectMp4) return true;
    return false;
  };
  if (checkSingle(rawUrl)) return true;
  try {
    const parsed = new URL(
      rawUrl,
      typeof window !== 'undefined' ? window.location.origin : 'https://filmio.my'
    );
    const inner = parsed.searchParams.get('url');
    if (inner && checkSingle(inner)) return true;
  } catch {
    // ignore
  }
  return false;
}

function bytesLookLikeHlsText(bytes: Uint8Array): boolean {
  const sampleLen = Math.min(bytes.length, 256);
  let i = 0;
  // Skip UTF-8 BOM if present
  if (
    sampleLen >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    i = 3;
  }
  while (
    i < sampleLen &&
    (bytes[i] === 0x20 ||
      bytes[i] === 0x09 ||
      bytes[i] === 0x0a ||
      bytes[i] === 0x0d)
  ) {
    i++;
  }
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.subarray(i, Math.min(sampleLen, i + 32)))
    .trim();
  return (
    head.startsWith('#EXTM3U') ||
    head.startsWith('#EXT-X-') ||
    head.startsWith('#EXTINF:')
  );
}

function bytesLookLikeBinaryMedia(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  // MP4 / fMP4 box ('ftyp', 'moov', 'styp', 'moof', 'mdat', 'free', 'wide')
  const fourcc = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  if (
    fourcc === 'ftyp' ||
    fourcc === 'moov' ||
    fourcc === 'styp' ||
    fourcc === 'moof' ||
    fourcc === 'mdat' ||
    fourcc === 'free' ||
    fourcc === 'wide'
  ) {
    return true;
  }
  // Matroska / WebM EBML header (0x1A 0x45 0xDF 0xA3)
  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return true;
  }
  // MPEG-TS sync byte 0x47
  if (bytes[0] === 0x47 && (bytes.length < 189 || bytes[188] === 0x47)) {
    return true;
  }
  // Check for NUL bytes in first 64 bytes (binary payload)
  const checkLen = Math.min(bytes.length, 64);
  for (let i = 0; i < checkLen; i++) {
    if (bytes[i] === 0x00) return true;
  }
  return false;
}

/**
 * Downloads an HLS (.m3u8) OR Direct Video (MP4 / fMP4 / MKV / FileList / VK Direct)
 * movie/episode into IndexedDB for 100% offline playback.
 */
export async function downloadHlsToOfflineDb(params: {
  id: string;
  title: string;
  subtitleLabel?: string;
  poster?: string;
  masterM3u8Url: string;
  preferredHeight?: number; // e.g. 360, 480, 720, 1080
  audioTrackIndex?: number;
  audioLabel?: string;
  sourceLabel?: string;
  estimatedSizeBytes?: number;
  estimatedDurationSec?: number;
  forceDirectVideo?: boolean;
  savedSubCues?: Array<{ start: number; end: number; text: string }>;
  savedSubLabel?: string;
  vodId?: string;
  mediaKind?: 'movie' | 'series';
  season?: number;
  episode?: number;
  overview?: string;
  releaseYear?: string;
  rating?: string;
  backdrop?: string;
  signal?: AbortSignal;
  onProgress?: (prog: OfflineDownloadProgress) => void;
}): Promise<OfflineMediaItem> {
  const {
    id,
    title,
    subtitleLabel,
    poster,
    masterM3u8Url,
    preferredHeight = 480,
    audioTrackIndex = 0,
    audioLabel = 'Original / Русский',
    sourceLabel,
    estimatedSizeBytes = 0,
    estimatedDurationSec = 0,
    forceDirectVideo = false,
    savedSubCues,
    savedSubLabel,
    vodId,
    mediaKind,
    season,
    episode,
    overview,
    releaseYear,
    rating,
    backdrop,
    signal,
    onProgress,
  } = params;

  const qualityLabelFromHeight = (h: number, resStr = ''): string =>
    h <= 380 || resStr.includes('360')
      ? 'SD 360p (Eco)'
      : h <= 540 || resStr.includes('480')
        ? 'SD+ 480p (Mobil)'
        : h <= 780 || resStr.includes('720')
          ? 'HD 720p'
          : 'Full HD 1080p';

  const fetchWithTimeout = async (
    url: string,
    timeoutMs: number,
    asText: boolean
  ): Promise<string | ArrayBuffer> => {
    const segCtrl = new AbortController();
    const onParentAbort = () => segCtrl.abort();
    if (signal) {
      if (signal.aborted) {
        throw new DOMException('Descărcare anulată', 'AbortError');
      }
      signal.addEventListener('abort', onParentAbort, { once: true });
    }
    const timer = window.setTimeout(() => segCtrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: segCtrl.signal, cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return asText ? await res.text() : await res.arrayBuffer();
    } catch (err) {
      if (signal?.aborted) {
        throw new DOMException('Descărcare anulată', 'AbortError');
      }
      throw err;
    } finally {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onParentAbort);
    }
  };

  const urlLooksDirectVideo =
    forceDirectVideo || isLikelyDirectVideoUrl(masterM3u8Url);

  // Preserve 360p/480p/720p/1080p variants when fetching HLS master playlist through /api/tv-proxy
  const effectiveMasterUrl =
    !urlLooksDirectVideo &&
    masterM3u8Url.includes('/api/tv-proxy') &&
    !masterM3u8Url.includes('allQualities=1')
      ? `${masterM3u8Url}${masterM3u8Url.includes('?') ? '&' : '?'}allQualities=1`
      : masterM3u8Url;

  const streamDirectVideoFromReader = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    firstChunk: Uint8Array | null,
    contentType: string,
    contentLength: number,
    headerDuration: number,
    streamAbortCtrl: AbortController
  ): Promise<OfflineMediaItem> => {
    const CHUNK_BYTES = 8 * 1024 * 1024; // 8 MB per IndexedDB part -> low peak RAM on iPad/iPhone
    const writtenKeys: string[] = [];
    let partIndex = 0;
    let pendingParts: Uint8Array[] = [];
    let pendingSize = 0;
    let downloadedBytes = 0;
    const startedAtMs = Date.now();
    let lastProgressEmitMs = 0;

    const normalizedMime = /video\/webm/i.test(contentType)
      ? 'video/webm'
      : /video\/x-matroska|matroska/i.test(contentType)
        ? 'video/x-matroska'
        : 'video/mp4';

    const flushPending = async () => {
      if (pendingSize <= 0 || pendingParts.length === 0) return;
      const key = `${id}::p_${partIndex++}`;
      const chunkBlob = new Blob(pendingParts as BlobPart[], {
        type: normalizedMime,
      });
      pendingParts = [];
      pendingSize = 0;
      await putBlobChunk(key, chunkBlob);
      writtenKeys.push(key);
    };

    const emitDirectProgress = (force = false) => {
      if (!onProgress) return;
      const nowMs = Date.now();
      if (!force && nowMs - lastProgressEmitMs < 250) return;
      lastProgressEmitMs = nowMs;
      const elapsedSec = Math.max(0.5, (nowMs - startedAtMs) / 1000);
      const speedMbPerSec = downloadedBytes / (1024 * 1024) / elapsedSec;
      const speedText =
        speedMbPerSec >= 0.05 ? ` • ${speedMbPerSec.toFixed(1)} MB/s` : '';
      let pct = 1;
      if (contentLength > 0) {
        pct = Math.min(99, Math.max(1, Math.round((downloadedBytes / contentLength) * 99)));
      } else if (estimatedSizeBytes > 0) {
        pct = Math.min(
          98,
          Math.max(1, Math.round((downloadedBytes / estimatedSizeBytes) * 98))
        );
      } else {
        pct = Math.min(
          95,
          Math.max(
            2,
            Math.round((downloadedBytes / (downloadedBytes + 350 * 1024 * 1024)) * 95)
          )
        );
      }
      const totalTag =
        contentLength > 0
          ? ` / ${formatBytes(contentLength)}`
          : estimatedSizeBytes > 0
            ? ` / ~${formatBytes(estimatedSizeBytes)}`
            : '';
      const srcTag = sourceLabel ? `${sourceLabel} • ` : '';
      onProgress({
        title,
        percent: pct,
        downloadedBytes,
        totalSegments: 0,
        completedSegments: partIndex,
        stage: `${srcTag}${formatBytes(downloadedBytes)}${totalTag}${speedText}`,
      });
    };

    const readNextWithIdleTimeout = async (): Promise<
      ReadableStreamReadResult<Uint8Array>
    > => {
      let idleTimer: number | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        idleTimer = window.setTimeout(() => {
          streamAbortCtrl.abort();
          reject(new Error('Streamul video s-a întrerupt (timeout 40s fără date)'));
        }, 40_000);
      });
      try {
        return await Promise.race([reader.read(), timeoutPromise]);
      } finally {
        if (idleTimer !== null) window.clearTimeout(idleTimer);
      }
    };

    try {
      if (firstChunk && firstChunk.byteLength > 0) {
        pendingParts.push(firstChunk);
        pendingSize += firstChunk.byteLength;
        downloadedBytes += firstChunk.byteLength;
        if (pendingSize >= CHUNK_BYTES) {
          await flushPending();
        }
        emitDirectProgress(true);
      }

      while (true) {
        if (signal?.aborted) {
          throw new DOMException('Descărcare anulată', 'AbortError');
        }
        const { done, value } = await readNextWithIdleTimeout();
        if (done) break;
        if (value && value.byteLength > 0) {
          pendingParts.push(value);
          pendingSize += value.byteLength;
          downloadedBytes += value.byteLength;
          if (pendingSize >= CHUNK_BYTES) {
            await flushPending();
          }
          emitDirectProgress(false);
        }
      }

      await flushPending();

      if (downloadedBytes < 16 * 1024) {
        throw new Error('Fișierul video primit este gol sau incomplet.');
      }

      const item: OfflineMediaItem = {
        id,
        title,
        subtitleLabel,
        poster,
        mediaType: 'blob',
        mimeType: normalizedMime,
        sizeBytes: downloadedBytes,
        duration: Math.round(headerDuration || estimatedDurationSec || 0),
        createdAt: Date.now(),
        qualityLabel: qualityLabelFromHeight(preferredHeight),
        audioLabel,
        sourceLabel,
        partCount: partIndex,
        savedSubCues,
        savedSubLabel,
        vodId,
        mediaKind,
        season,
        episode,
        overview,
        releaseYear,
        rating,
        backdrop,
      };

      await saveOfflineItemMeta(item);

      if (onProgress) {
        onProgress({
          title,
          percent: 100,
          downloadedBytes,
          totalSegments: partIndex,
          completedSegments: partIndex,
          stage: 'Descărcat complet! Disponibil Offline.',
        });
      }

      return item;
    } catch (err) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      await deleteBlobKeysSilent(writtenKeys);
      if (signal?.aborted) {
        throw new DOMException('Descărcare anulată', 'AbortError');
      }
      throw err;
    }
  };

  // Single streaming entry fetch: detects Direct Video vs HLS .m3u8 without duplicate requests or OOM
  const entryCtrl = new AbortController();
  const onEntryParentAbort = () => entryCtrl.abort();
  if (signal) {
    if (signal.aborted) {
      throw new DOMException('Descărcare anulată', 'AbortError');
    }
    signal.addEventListener('abort', onEntryParentAbort, { once: true });
  }
  const headerTimeoutMs = urlLooksDirectVideo ? 45_000 : 22_000;
  const headerTimer = window.setTimeout(() => entryCtrl.abort(), headerTimeoutMs);

  let entryRes: Response;
  try {
    entryRes = await fetch(effectiveMasterUrl, {
      signal: entryCtrl.signal,
      cache: 'no-store',
    });
  } catch (err) {
    window.clearTimeout(headerTimer);
    signal?.removeEventListener('abort', onEntryParentAbort);
    if (signal?.aborted) {
      throw new DOMException('Descărcare anulată', 'AbortError');
    }
    throw new Error(
      err instanceof Error && err.name === 'AbortError'
        ? 'Serverul video nu a răspuns la timp.'
        : err instanceof Error
          ? err.message
          : 'Nu s-a putut accesa streamul video.'
    );
  }
  window.clearTimeout(headerTimer);

  if (!entryRes.ok) {
    let errDetail = `HTTP ${entryRes.status}`;
    try {
      const errTxt = (await entryRes.text()).slice(0, 300);
      if (errTxt.trim().startsWith('{')) {
        const parsedErr = JSON.parse(errTxt);
        if (parsedErr?.error) errDetail = String(parsedErr.error);
      }
    } catch {
      // ignore
    }
    signal?.removeEventListener('abort', onEntryParentAbort);
    throw new Error(`Streamul video a răspuns cu eroare (${errDetail}).`);
  }

  const entryContentType = (entryRes.headers.get('content-type') || '').toLowerCase();
  const entryContentLength =
    parseInt(entryRes.headers.get('content-length') || '0', 10) || 0;
  const entryDurationHeader =
    parseFloat(entryRes.headers.get('x-content-duration') || '0') || 0;
  const isM3u8ContentType =
    entryContentType.includes('mpegurl') || entryContentType.includes('m3u8');
  const isDirectBinaryHeader =
    !isM3u8ContentType &&
    (urlLooksDirectVideo ||
      entryContentType.startsWith('video/') ||
      entryContentType.includes('application/octet-stream'));

  if (isDirectBinaryHeader && entryRes.body) {
    try {
      const reader = entryRes.body.getReader();
      return await streamDirectVideoFromReader(
        reader,
        null,
        entryContentType,
        entryContentLength,
        entryDurationHeader,
        entryCtrl
      );
    } finally {
      signal?.removeEventListener('abort', onEntryParentAbort);
    }
  }

  // Peek first non-empty chunk to distinguish HLS text playlist vs sneaky binary MP4 vs HTML/JSON error
  let masterText = '';
  if (entryRes.body) {
    const reader = entryRes.body.getReader();
    let firstChunk: Uint8Array | null = null;
    try {
      while (!firstChunk) {
        if (signal?.aborted) {
          throw new DOMException('Descărcare anulată', 'AbortError');
        }
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength > 0) {
          firstChunk = value;
        }
      }
    } catch (err) {
      signal?.removeEventListener('abort', onEntryParentAbort);
      if (signal?.aborted) {
        throw new DOMException('Descărcare anulată', 'AbortError');
      }
      throw err;
    }

    if (!firstChunk) {
      signal?.removeEventListener('abort', onEntryParentAbort);
      throw new Error('Serverul video a returnat un răspuns gol.');
    }

    if (!isM3u8ContentType && !bytesLookLikeHlsText(firstChunk) && bytesLookLikeBinaryMedia(firstChunk)) {
      try {
        return await streamDirectVideoFromReader(
          reader,
          firstChunk,
          entryContentType || 'video/mp4',
          entryContentLength,
          entryDurationHeader,
          entryCtrl
        );
      } finally {
        signal?.removeEventListener('abort', onEntryParentAbort);
      }
    }

    // Drain text playlist (capped at 6 MB safety limit)
    const textChunks: Uint8Array[] = [firstChunk];
    let totalTextBytes = firstChunk.byteLength;
    try {
      while (totalTextBytes < 6 * 1024 * 1024) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength > 0) {
          textChunks.push(value);
          totalTextBytes += value.byteLength;
        }
      }
      if (totalTextBytes >= 6 * 1024 * 1024) {
        await reader.cancel().catch(() => {});
      }
    } finally {
      signal?.removeEventListener('abort', onEntryParentAbort);
    }
    const merged = new Uint8Array(totalTextBytes);
    let pos = 0;
    for (const c of textChunks) {
      merged.set(c, pos);
      pos += c.byteLength;
    }
    masterText = new TextDecoder('utf-8', { fatal: false }).decode(merged);
  } else {
    try {
      masterText = await entryRes.text();
    } finally {
      signal?.removeEventListener('abort', onEntryParentAbort);
    }
  }

  const trimmedMaster = masterText.trim();
  if (!trimmedMaster.includes('#EXT')) {
    if (trimmedMaster.startsWith('{')) {
      try {
        const errJson = JSON.parse(trimmedMaster);
        if (errJson?.error) {
          throw new Error(String(errJson.error));
        }
      } catch (e) {
        if (e instanceof Error && !/JSON/i.test(e.message)) throw e;
      }
    }
    throw new Error('Streamul video nu a returnat un playlist HLS sau fișier video valid.');
  }

  const encId = encodeURIComponent(id);

  // Check if masterM3u8Url is already a single media playlist or a master playlist
  const isMaster = masterText.includes('#EXT-X-STREAM-INF');

  let videoPlaylistUrl = effectiveMasterUrl;
  let audioPlaylistUrl = '';
  let chosenResolution = '854x480';
  let chosenHeight = preferredHeight;
  let chosenCodecs = 'avc1.64001f,mp4a.40.2';

  if (isMaster) {
    const parsed = parseMasterM3u8(masterText, effectiveMasterUrl);
    if (parsed.videoVariants.length === 0) {
      throw new Error('Nu s-au găsit variante video în playlist');
    }

    // Prefer variants <= preferredHeight + 60 so mobile never downloads 4K/1080p when user asked for 360p/480p/720p
    const withinCap = parsed.videoVariants.filter(
      (v) => v.height <= preferredHeight + 60
    );
    const pool = withinCap.length > 0 ? withinCap : parsed.videoVariants;
    const sorted = [...pool].sort(
      (a, b) =>
        Math.abs(a.height - preferredHeight) -
        Math.abs(b.height - preferredHeight)
    );
    const chosenVariant = sorted[0];
    videoPlaylistUrl = chosenVariant.url;
    chosenResolution = chosenVariant.resolution;
    chosenHeight = chosenVariant.height || preferredHeight;
    chosenCodecs = chosenVariant.codecs || chosenCodecs;

    if (parsed.audioTracks.length > 0) {
      const chosenAudio =
        parsed.audioTracks[
          Math.min(audioTrackIndex, parsed.audioTracks.length - 1)
        ] || parsed.audioTracks[0];
      audioPlaylistUrl = chosenAudio.url;
    }
  }

  // Fetch video media playlist (reuse masterText directly when !isMaster to avoid broken duplicate fetch!)
  let vText = !isMaster && masterText.includes('#EXTINF') ? masterText : '';
  if (!vText) {
    for (let va = 0; va < 3; va++) {
      try {
        vText = (await fetchWithTimeout(videoPlaylistUrl, 20_000, true)) as string;
        if (vText && vText.includes('#EXT')) break;
      } catch (err) {
        if (signal?.aborted) throw err;
        if (va === 2) throw new Error('Nu s-a putut descărca lista de segmente video');
        await new Promise((r) => setTimeout(r, 500 * (va + 1)));
      }
    }
  }
  const parsedVideo = parseMediaSegmentM3u8(
    vText,
    videoPlaylistUrl,
    `https://offline.local/${encId}/seg/v`
  );

  // Fetch audio media playlist if separate
  let parsedAudio: ReturnType<typeof parseMediaSegmentM3u8> | null = null;
  if (audioPlaylistUrl) {
    try {
      const aText = (await fetchWithTimeout(audioPlaylistUrl, 20_000, true)) as string;
      if (aText && aText.includes('#EXT')) {
        parsedAudio = parseMediaSegmentM3u8(
          aText,
          audioPlaylistUrl,
          `https://offline.local/${encId}/seg/a`
        );
      }
    } catch (err) {
      if (signal?.aborted) throw err;
    }
  }

  const totalVideoSegs = parsedVideo.segmentUrls.length;
  const totalAudioSegs = parsedAudio ? parsedAudio.segmentUrls.length : 0;
  const hasVideoInit = Boolean(parsedVideo.initSegmentUrl);
  const hasAudioInit = Boolean(parsedAudio?.initSegmentUrl);
  const totalSegments =
    totalVideoSegs + totalAudioSegs + (hasVideoInit ? 1 : 0) + (hasAudioInit ? 1 : 0);

  if (totalVideoSegs === 0) {
    throw new Error('Streamul nu conține segmente descărcabile');
  }

  let completedSegments = 0;
  let downloadedBytes = 0;
  const startedAtMs = Date.now();
  let lastProgressEmitMs = 0;
  const writtenKeys: string[] = [];

  const tasks: Array<{ key: string; url: string }> = [];
  if (parsedVideo.initSegmentUrl) {
    tasks.push({ key: `${id}::v_init`, url: parsedVideo.initSegmentUrl });
  }
  if (parsedAudio?.initSegmentUrl) {
    tasks.push({ key: `${id}::a_init`, url: parsedAudio.initSegmentUrl });
  }
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

  const CONCURRENCY = 4;
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
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const timeoutMs = attempt < 2 ? 18_000 : 26_000;
          const segAb = (await fetchWithTimeout(task.url, timeoutMs, false)) as ArrayBuffer;
          if (segAb && segAb.byteLength > 0) {
            buf = segAb;
            break;
          }
        } catch (err) {
          if (signal?.aborted) throw err;
          await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
        }
      }

      if (!buf) {
        throw new Error(`Segmentul #${taskIdx + 1}/${totalSegments} nu a răspuns după 5 încercări`);
      }

      await putBlobChunk(task.key, buf);
      writtenKeys.push(task.key);
      completedSegments++;
      downloadedBytes += buf.byteLength;

      const nowMs = Date.now();
      if (
        onProgress &&
        (nowMs - lastProgressEmitMs >= 250 || completedSegments === totalSegments)
      ) {
        lastProgressEmitMs = nowMs;
        const elapsedSec = Math.max(0.5, (nowMs - startedAtMs) / 1000);
        const speedMbPerSec = downloadedBytes / (1024 * 1024) / elapsedSec;
        const speedText =
          speedMbPerSec >= 0.1 ? ` • ${speedMbPerSec.toFixed(1)} MB/s` : '';
        onProgress({
          title,
          percent: Math.min(
            99,
            Math.max(1, Math.round((completedSegments / totalSegments) * 100))
          ),
          downloadedBytes,
          totalSegments,
          completedSegments,
          stage: `${chosenHeight}p • ${completedSegments}/${totalSegments} segmente${speedText}`,
        });
      }
    }
  };

  try {
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => worker())
    );
  } catch (err) {
    await deleteBlobKeysSilent(writtenKeys);
    throw err;
  }

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

  const resolvedQualityLabel = qualityLabelFromHeight(
    chosenHeight,
    chosenResolution
  );

  const item: OfflineMediaItem = {
    id,
    title,
    subtitleLabel,
    poster,
    mediaType: 'hls',
    sizeBytes: downloadedBytes,
    duration: parsedVideo.totalDuration,
    createdAt: Date.now(),
    qualityLabel: resolvedQualityLabel,
    audioLabel,
    sourceLabel,
    hasVideoInit: hasVideoInit || undefined,
    hasAudioInit: hasAudioInit || undefined,
    masterM3u8: offlineMasterLines.join('\n'),
    videoM3u8: parsedVideo.rewrittenM3u8,
    audioM3u8: parsedAudio?.rewrittenM3u8,
    videoSegCount: totalVideoSegs,
    audioSegCount: totalAudioSegs,
    savedSubCues,
    savedSubLabel,
    vodId,
    mediaKind,
    season,
    episode,
    overview,
    releaseYear,
    rating,
    backdrop,
  };

  await saveOfflineItemMeta(item);

  // Auto-remux MPEG-TS HLS to single MP4 only for smaller non-fMP4 videos (<= 450 MB) so iPad/iPhone Safari never OOMs
  if (!hasVideoInit && !hasAudioInit && downloadedBytes <= 450 * 1024 * 1024) {
    try {
      if (onProgress) {
        onProgress({
          title,
          percent: 99,
          downloadedBytes,
          totalSegments,
          completedSegments: totalSegments,
          stage: 'Se optimizează fișierul MP4 pentru iPhone / Mobil...',
        });
      }
      await ensureOfflineItemMp4Blob(item, signal);
    } catch {
      // ignore if offline remux is deferred
    }
  }

  if (onProgress) {
    onProgress({
      title,
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
 * Ensures a playable .mp4 (`video/mp4`) Blob exists in IndexedDB (`${item.id}::file` or chunked `p_0..N`)
 * by losslessly remuxing downloaded MPEG-TS video + audio segments via `/api/offline-remux-mp4` if needed.
 */
export async function ensureOfflineItemMp4Blob(
  item: OfflineMediaItem,
  signal?: AbortSignal
): Promise<Blob | null> {
  const existing = await getOfflineFileBlob(item);
  if (existing) {
    return existing;
  }

  const vCount = item.videoSegCount || 0;
  if (vCount <= 0) return null;

  const vParts: BlobPart[] = [];
  for (let i = 0; i < vCount; i++) {
    const seg = await getBlobChunk(`${item.id}::v_${i}`);
    if (seg) vParts.push(seg);
  }
  const vBlob = new Blob(vParts, { type: 'video/mp2t' });

  const aCount = item.audioSegCount || 0;
  const aParts: BlobPart[] = [];
  for (let i = 0; i < aCount; i++) {
    const seg = await getBlobChunk(`${item.id}::a_${i}`);
    if (seg) aParts.push(seg);
  }
  const aBlob = aParts.length > 0 ? new Blob(aParts, { type: 'video/mp2t' }) : null;

  // 1. Try fast lossless server-side ffmpeg remux (/api/offline-remux-mp4)
  try {
    const payload = aBlob ? new Blob([vBlob, aBlob]) : vBlob;
    const res = await fetch('/api/offline-remux-mp4', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-video-bytes': String(vBlob.size),
        'x-audio-bytes': String(aBlob ? aBlob.size : 0),
      },
      body: payload,
      signal,
    });
    if (res.ok && (res.headers.get('content-type') || '').includes('video/mp4')) {
      const mp4Ab = await res.arrayBuffer();
      if (mp4Ab.byteLength > 1024) {
        await putBlobChunk(`${item.id}::file`, mp4Ab);
        return new Blob([mp4Ab], { type: 'video/mp4' });
      }
    }
  } catch {
    // fallback if offline
  }

  return null;
}

/**
 * Exports a downloaded offline video to the user's device Downloads / iPhone Files app as a playable .mp4
 */
export async function exportOfflineItemToDeviceFile(
  item: OfflineMediaItem
): Promise<void> {
  const safeName = item.title
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .trim()
    .slice(0, 80);
  const epSuffix =
    item.mediaKind === 'series' && item.season && item.episode
      ? ` S${item.season}E${item.episode}`
      : '';
  const baseFilename = `${safeName || 'video'}${epSuffix}`;

  const mp4Blob = await ensureOfflineItemMp4Blob(item);
  if (mp4Blob) {
    const fileName = `${baseFilename}.mp4`;
    const isIos =
      typeof navigator !== 'undefined' &&
      /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIos && typeof navigator.share === 'function' && typeof File !== 'undefined') {
      try {
        const fileObj = new File([mp4Blob], fileName, { type: 'video/mp4' });
        if (!navigator.canShare || navigator.canShare({ files: [fileObj] })) {
          await navigator.share({
            title: baseFilename,
            files: [fileObj],
          });
          return;
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
      }
    }

    const url = URL.createObjectURL(mp4Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 15000);
    return;
  }

  // Fallback if offline and MP4 wasn't pre-built
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
  a.download = `${baseFilename}.ts`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 15000);
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

          // Segment request: seg/v_0.ts, seg/a_0.ts, seg/v_init.mp4, seg/a_init.mp4
          const initMatch = subPath.match(/^seg\/([va]_init)\.mp4$/);
          const segMatch = subPath.match(/^seg\/([va]_\d+)\.ts$/);
          const segKeyPart = initMatch?.[1] || segMatch?.[1] || '';
          if (segKeyPart) {
            const segKey = `${itemId}::${segKeyPart}`;
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

/**
 * Builds a native iOS Safari blob: HLS master playlist URL (and returns cleanup function)
 * for devices where hls.js MSE is not supported.
 */
export async function buildIosNativeOfflineHlsBlobUrl(
  item: OfflineMediaItem
): Promise<{ masterBlobUrl: string; revokeAll: () => void }> {
  // 1. Best for all iPhones (Chrome & Safari, HTTP & HTTPS): Play remuxed native MP4 Blob directly
  const mp4Blob = await ensureOfflineItemMp4Blob(item);
  if (mp4Blob) {
    const mp4Url = URL.createObjectURL(mp4Blob);
    return {
      masterBlobUrl: mp4Url,
      revokeAll: () => {
        try {
          URL.revokeObjectURL(mp4Url);
        } catch {
          // ignore
        }
      },
    };
  }

  // 2. If Service Worker is active (on HTTPS / PWA), serve /offline-hls/<id>/master.m3u8 via SW from IndexedDB
  if (
    typeof navigator !== 'undefined' &&
    navigator.serviceWorker &&
    navigator.serviceWorker.controller
  ) {
    return {
      masterBlobUrl: `/offline-hls/${encodeURIComponent(item.id)}/master.m3u8`,
      revokeAll: () => {},
    };
  }

  const createdUrls: string[] = [];
  const makeUrl = (blob: Blob) => {
    const u = URL.createObjectURL(blob);
    createdUrls.push(u);
    return u;
  };

  const rewritePlaylistToBlobUrls = async (
    m3u8Text: string,
    kind: 'v' | 'a'
  ): Promise<string> => {
    const lines = m3u8Text.split(/\r?\n/);
    const out: string[] = [];
    for (const line of lines) {
      const initM = line.match(
        new RegExp(`URI="[^"]*/seg/${kind}_init\\.mp4"`, 'i')
      );
      if (initM) {
        const initChunk = await getBlobChunk(`${item.id}::${kind}_init`);
        if (initChunk) {
          const blob =
            initChunk instanceof Blob
              ? initChunk
              : new Blob([initChunk], { type: 'video/mp4' });
          out.push(line.replace(/URI="[^"]+"/i, `URI="${makeUrl(blob)}"`));
          continue;
        }
      }
      const m = line.match(new RegExp(`/seg/${kind}_(\\d+)\\.ts$`));
      if (m?.[1]) {
        const idx = Number(m[1]);
        const chunk = await getBlobChunk(`${item.id}::${kind}_${idx}`);
        if (chunk) {
          const blob =
            chunk instanceof Blob
              ? chunk
              : new Blob([chunk], { type: 'video/mp2t' });
          out.push(makeUrl(blob));
        }
      } else {
        out.push(line);
      }
    }
    return makeUrl(
      new Blob([out.join('\n')], { type: 'application/vnd.apple.mpegurl' })
    );
  };

  const videoBlobM3u8Url = await rewritePlaylistToBlobUrls(
    item.videoM3u8 || '',
    'v'
  );
  let masterText = (item.masterM3u8 || '').replace(
    /https:\/\/offline\.local\/[^/\s]+\/video\.m3u8/g,
    videoBlobM3u8Url
  );

  if (item.audioM3u8 && (item.audioSegCount || 0) > 0) {
    const audioBlobM3u8Url = await rewritePlaylistToBlobUrls(
      item.audioM3u8,
      'a'
    );
    masterText = masterText.replace(
      /https:\/\/offline\.local\/[^"'\s]+\/audio\.m3u8/g,
      audioBlobM3u8Url
    );
  }

  const masterBlobUrl = makeUrl(
    new Blob([masterText], { type: 'application/vnd.apple.mpegurl' })
  );

  return {
    masterBlobUrl,
    revokeAll: () => {
      for (const u of createdUrls) {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // ignore
        }
      }
    },
  };
}

// ============================================================================
// Persistent Module-Level Singleton Background Video Download Manager & Queue
// Keeps movie/series downloads running uninterrupted across ALL page, tab,
// card, section, and mode transitions (with screen Wake Lock & queue support).
// ============================================================================

export interface OfflineVideoDownloadSnapshot {
  activeProgress: OfflineDownloadProgress | null;
  activeTargetId: string | null;
  activeVodId: string | null;
  activeTitle: string;
  queueCount: number;
  lastError: string | null;
  lastCompletedTitle: string | null;
  libraryRevision: number;
}

export interface OfflineVideoDownloadJobContext {
  signal: AbortSignal;
  setTargetId: (id: string) => void;
  setProgress: (prog: OfflineDownloadProgress) => void;
  notifyItemSaved: () => void;
}

export interface OfflineVideoDownloadJob {
  vodId: string;
  title: string;
  run: (ctx: OfflineVideoDownloadJobContext) => Promise<void>;
}

const bgDlListeners = new Set<() => void>();
const bgDlQueue: OfflineVideoDownloadJob[] = [];
let bgDlRunning = false;
let bgDlAbortCtrl: AbortController | null = null;
let bgDlCompletedToastTimer: number | null = null;
let bgDlWakeLockSentinel: { release?: () => Promise<void> } | null = null;

let bgDlSnapshot: OfflineVideoDownloadSnapshot = {
  activeProgress: null,
  activeTargetId: null,
  activeVodId: null,
  activeTitle: '',
  queueCount: 0,
  lastError: null,
  lastCompletedTitle: null,
  libraryRevision: 0,
};

function emitBgDlSnapshot(partial: Partial<OfflineVideoDownloadSnapshot>): void {
  bgDlSnapshot = { ...bgDlSnapshot, ...partial };
  for (const listener of bgDlListeners) {
    try {
      listener();
    } catch {
      // ignore subscriber error
    }
  }
}

function handleBgDlBeforeUnload(ev: BeforeUnloadEvent): void {
  if (!bgDlRunning) return;
  ev.preventDefault();
  ev.returnValue = '';
}

async function acquireBgDlWakeLock(): Promise<void> {
  if (typeof navigator === 'undefined') return;
  try {
    const wl = (navigator as unknown as {
      wakeLock?: { request?: (t: 'screen') => Promise<{ release?: () => Promise<void> }> };
    }).wakeLock;
    if (wl?.request && !bgDlWakeLockSentinel) {
      bgDlWakeLockSentinel = await wl.request('screen');
    }
  } catch {
    // ignore unsupported or background tab wakeLock rejection
  }
}

function releaseBgDlWakeLock(): void {
  if (!bgDlWakeLockSentinel) return;
  const sentinel = bgDlWakeLockSentinel;
  bgDlWakeLockSentinel = null;
  try {
    void sentinel.release?.();
  } catch {
    // ignore
  }
}

async function pumpBgDlQueue(): Promise<void> {
  if (bgDlRunning) return;
  bgDlRunning = true;
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBgDlBeforeUnload);
  }
  void acquireBgDlWakeLock();

  try {
    while (bgDlQueue.length > 0) {
      const job = bgDlQueue.shift()!;
      const ctrl = new AbortController();
      bgDlAbortCtrl = ctrl;

      if (bgDlCompletedToastTimer !== null && typeof window !== 'undefined') {
        window.clearTimeout(bgDlCompletedToastTimer);
        bgDlCompletedToastTimer = null;
      }

      emitBgDlSnapshot({
        activeVodId: job.vodId,
        activeTitle: job.title,
        activeTargetId: `vod_${job.vodId}`,
        queueCount: bgDlQueue.length,
        lastError: null,
        lastCompletedTitle: null,
        activeProgress: {
          title: job.title,
          percent: 1,
          downloadedBytes: 0,
          totalSegments: 0,
          completedSegments: 0,
          stage: 'Se pregătește descărcarea în fundal...',
        },
      });

      try {
        await job.run({
          signal: ctrl.signal,
          setTargetId: (id) => {
            if (bgDlAbortCtrl === ctrl) {
              emitBgDlSnapshot({ activeTargetId: id });
            }
          },
          setProgress: (prog) => {
            if (bgDlAbortCtrl === ctrl) {
              emitBgDlSnapshot({
                activeProgress: prog,
                activeTitle: prog.title || job.title,
                queueCount: bgDlQueue.length,
              });
            }
          },
          notifyItemSaved: () => {
            emitBgDlSnapshot({
              libraryRevision: bgDlSnapshot.libraryRevision + 1,
            });
          },
        });

        if (!ctrl.signal.aborted) {
          emitBgDlSnapshot({
            libraryRevision: bgDlSnapshot.libraryRevision + 1,
            lastCompletedTitle: job.title,
          });
          if (typeof window !== 'undefined') {
            bgDlCompletedToastTimer = window.setTimeout(() => {
              bgDlCompletedToastTimer = null;
              emitBgDlSnapshot({ lastCompletedTitle: null });
            }, 4200);
          }
        }
      } catch (err) {
        if (
          ctrl.signal.aborted ||
          (err instanceof DOMException && err.name === 'AbortError')
        ) {
          emitBgDlSnapshot({ lastError: 'Descărcarea a fost oprită.' });
        } else {
          emitBgDlSnapshot({
            lastError:
              err instanceof Error
                ? err.message
                : 'Eroare la descărcarea locală.',
          });
        }
      } finally {
        if (bgDlAbortCtrl === ctrl) {
          bgDlAbortCtrl = null;
        }
      }
    }
  } finally {
    bgDlRunning = false;
    bgDlAbortCtrl = null;
    releaseBgDlWakeLock();
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleBgDlBeforeUnload);
    }
    emitBgDlSnapshot({
      activeProgress: null,
      activeTargetId: null,
      activeVodId: null,
      activeTitle: '',
      queueCount: 0,
    });
  }
}

export function enqueueOfflineVideoDownloadJob(
  job: OfflineVideoDownloadJob
): { queued: boolean } {
  const wasBusy = bgDlRunning;
  bgDlQueue.push(job);
  emitBgDlSnapshot({
    queueCount: wasBusy ? bgDlQueue.length : Math.max(0, bgDlQueue.length - 1),
    lastError: null,
  });
  void pumpBgDlQueue();
  return { queued: wasBusy };
}

export function cancelActiveOfflineVideoDownload(): void {
  bgDlQueue.length = 0;
  if (bgDlAbortCtrl) {
    bgDlAbortCtrl.abort();
    bgDlAbortCtrl = null;
  }
  emitBgDlSnapshot({
    activeProgress: null,
    activeTargetId: null,
    activeVodId: null,
    activeTitle: '',
    queueCount: 0,
  });
}

export function clearOfflineVideoDownloadError(): void {
  if (bgDlSnapshot.lastError !== null) {
    emitBgDlSnapshot({ lastError: null });
  }
}

function subscribeOfflineVideoDownload(listener: () => void): () => void {
  bgDlListeners.add(listener);
  return () => {
    bgDlListeners.delete(listener);
  };
}

function getOfflineVideoDownloadSnapshot(): OfflineVideoDownloadSnapshot {
  return bgDlSnapshot;
}

export function useOfflineVideoDownloadState(): OfflineVideoDownloadSnapshot {
  return useSyncExternalStore(
    subscribeOfflineVideoDownload,
    getOfflineVideoDownloadSnapshot,
    getOfflineVideoDownloadSnapshot
  );
}



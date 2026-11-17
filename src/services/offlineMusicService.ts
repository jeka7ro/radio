import { useSyncExternalStore } from 'react';
import type { SpotifyTrackItem } from '../components/tv/spotifyMusicPremiumViews';

export interface OfflineMusicTrackRecord {
  offlineKey: string;
  track: SpotifyTrackItem;
  mimeType: string;
  sizeBytes: number;
  downloadedAt: number;
}

export interface OfflineMusicBatchStats {
  active: boolean;
  completed: number;
  total: number;
  currentTitle: string;
}

export interface OfflineMusicSnapshot {
  hydrated: boolean;
  recordsList: OfflineMusicTrackRecord[];
  recordsMap: Map<string, OfflineMusicTrackRecord>;
  progressMap: Map<string, number>;
  recordsCount: number;
  totalBytes: number;
  batchStats: OfflineMusicBatchStats;
  isOffline: (track: Pick<SpotifyTrackItem, 'id' | 'artist' | 'title'> | null | undefined) => boolean;
  getProgress: (track: Pick<SpotifyTrackItem, 'id' | 'artist' | 'title'> | null | undefined) => number | null;
}

const DB_NAME = 'aether_offline_music_db_v1';
const DB_VERSION = 1;
const STORE_TRACKS = 'tracks';
const STORE_BLOBS = 'audioBlobs';
const DOWNLOAD_CONCURRENCY = 2;

export function getOfflineTrackKey(
  track: Pick<SpotifyTrackItem, 'id' | 'artist' | 'title'>
): string {
  const norm = (s: string) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\u0400-\u04ff\uac00-\ud7af]+/g, ' ')
      .trim();
  const a = norm(track.artist);
  const t = norm(track.title);
  return a && t ? `${a}::${t}` : String(track.id || '');
}

export function formatOfflineMusicBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

let dbPromise: Promise<IDBDatabase> | null = null;
function openMusicDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        db.createObjectStore(STORE_TRACKS, { keyPath: 'offlineKey' });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

async function idbGetAllTracks(): Promise<OfflineMusicTrackRecord[]> {
  const db = await openMusicDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readonly');
    const req = tx.objectStore(STORE_TRACKS).getAll();
    req.onsuccess = () => resolve((req.result as OfflineMusicTrackRecord[]) || []);
    req.onerror = () => reject(req.error);
  });
}

async function idbPutTrackAndBlob(
  record: OfflineMusicTrackRecord,
  buffer: ArrayBuffer
): Promise<void> {
  const db = await openMusicDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_TRACKS, STORE_BLOBS], 'readwrite');
    tx.objectStore(STORE_TRACKS).put(record);
    tx.objectStore(STORE_BLOBS).put(buffer, record.offlineKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetAudioBlob(offlineKey: string): Promise<ArrayBuffer | Blob | null> {
  const db = await openMusicDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readonly');
    const req = tx.objectStore(STORE_BLOBS).get(offlineKey);
    req.onsuccess = () => resolve((req.result as ArrayBuffer | Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDeleteTrack(offlineKey: string): Promise<void> {
  const db = await openMusicDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_TRACKS, STORE_BLOBS], 'readwrite');
    tx.objectStore(STORE_TRACKS).delete(offlineKey);
    tx.objectStore(STORE_BLOBS).delete(offlineKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbClearAll(): Promise<void> {
  const db = await openMusicDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_TRACKS, STORE_BLOBS], 'readwrite');
    tx.objectStore(STORE_TRACKS).clear();
    tx.objectStore(STORE_BLOBS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const recordsMap = new Map<string, OfflineMusicTrackRecord>();
const progressMap = new Map<string, number>();
const queuedKeys = new Set<string>();
const pendingQueue: SpotifyTrackItem[] = [];
const abortControllers = new Map<string, AbortController>();
let activeWorkers = 0;
let hydrated = false;
let batchStats: OfflineMusicBatchStats = {
  active: false,
  completed: 0,
  total: 0,
  currentTitle: '',
};

const listeners = new Set<() => void>();

function isTrackOfflineLookup(
  track: Pick<SpotifyTrackItem, 'id' | 'artist' | 'title'> | null | undefined
): boolean {
  if (!track) return false;
  return recordsMap.has(getOfflineTrackKey(track));
}

function getTrackProgressLookup(
  track: Pick<SpotifyTrackItem, 'id' | 'artist' | 'title'> | null | undefined
): number | null {
  if (!track) return null;
  const key = getOfflineTrackKey(track);
  if (progressMap.has(key)) return progressMap.get(key) ?? 0;
  return null;
}

function buildSnapshot(): OfflineMusicSnapshot {
  const recordsList = Array.from(recordsMap.values()).sort(
    (a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0)
  );
  let totalBytes = 0;
  for (const r of recordsList) {
    totalBytes += Number(r.sizeBytes) || 0;
  }
  return {
    hydrated,
    recordsList,
    recordsMap: new Map(recordsMap),
    progressMap: new Map(progressMap),
    recordsCount: recordsList.length,
    totalBytes,
    batchStats: { ...batchStats },
    isOffline: isTrackOfflineLookup,
    getProgress: getTrackProgressLookup,
  };
}

let currentSnapshot: OfflineMusicSnapshot = buildSnapshot();

function notifySubscribers(): void {
  currentSnapshot = buildSnapshot();
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore listener errors
    }
  });
}

let hydratePromise: Promise<void> | null = null;
export function ensureOfflineMusicHydrated(): Promise<void> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    hydrated = true;
    return Promise.resolve();
  }
  if (hydrated) return Promise.resolve();
  if (hydratePromise) return hydratePromise;
  hydratePromise = idbGetAllTracks()
    .then((list) => {
      for (const rec of list) {
        if (rec?.offlineKey && rec?.track) {
          recordsMap.set(rec.offlineKey, rec);
        }
      }
      hydrated = true;
      notifySubscribers();
    })
    .catch(() => {
      hydrated = true;
    });
  return hydratePromise;
}

if (typeof window !== 'undefined') {
  void ensureOfflineMusicHydrated();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): OfflineMusicSnapshot {
  return currentSnapshot;
}

export function useOfflineMusicState(): OfflineMusicSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function isTrackOfflineSync(
  track: Pick<SpotifyTrackItem, 'id' | 'artist' | 'title'> | null | undefined
): boolean {
  return isTrackOfflineLookup(track);
}

function getProxiedCoverFetchUrl(rawUrl?: string): string {
  const s = String(rawUrl || '').trim();
  if (!s || s.startsWith('data:')) return s;
  if (
    s.includes('mzstatic.com') ||
    s.includes('dzcdn.net') ||
    s.includes('deezer.com') ||
    s.includes('unsplash.com') ||
    s.includes('ytimg.com')
  ) {
    return s;
  }
  if (s.startsWith('http://') || s.startsWith('https://')) {
    return `/api/tv-proxy?url=${encodeURIComponent(s)}`;
  }
  return s;
}

async function cacheCoverAsDataUrl(rawUrl?: string): Promise<string | null> {
  if (typeof window === 'undefined' || !rawUrl) return null;
  if (rawUrl.startsWith('data:')) return rawUrl;
  try {
    const res = await fetch(getProxiedCoverFetchUrl(rawUrl), { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || blob.size === 0) return null;
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Image load failed'));
        el.src = objectUrl;
      });
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      return canvas.toDataURL('image/jpeg', 0.82);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

async function fetchAudioBufferWithProgress(
  url: string,
  offlineKey: string,
  signal: AbortSignal
): Promise<{ buffer: ArrayBuffer; mimeType: string } | null> {
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const contentType = (res.headers.get('content-type') || 'audio/mp4').split(';')[0].trim();
  if (contentType.includes('text/html') || contentType.includes('application/json')) {
    return null;
  }
  const expectedTotal = Number(res.headers.get('content-length') || 0) || 3_200_000;
  if (!res.body) {
    const ab = await res.arrayBuffer();
    if (ab.byteLength < 25_000) return null;
    return { buffer: ab, mimeType: contentType || 'audio/mp4' };
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  let lastReportedPct = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value && value.byteLength > 0) {
      chunks.push(value);
      loaded += value.byteLength;
      const pct = Math.min(95, Math.max(2, Math.round((loaded / expectedTotal) * 100)));
      if (pct - lastReportedPct >= 8) {
        lastReportedPct = pct;
        progressMap.set(offlineKey, pct);
        notifySubscribers();
      }
    }
  }

  if (loaded < 25_000) return null;
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const ch of chunks) {
    out.set(ch, offset);
    offset += ch.byteLength;
  }
  return { buffer: out.buffer, mimeType: contentType || 'audio/mp4' };
}

async function performSingleDownload(track: SpotifyTrackItem): Promise<boolean> {
  const offlineKey = getOfflineTrackKey(track);
  const ctrl = new AbortController();
  abortControllers.set(offlineKey, ctrl);
  progressMap.set(offlineKey, 2);
  if (batchStats.active) {
    batchStats.currentTitle = `${track.artist} — ${track.title}`;
  }
  notifySubscribers();

  try {
    const candidates = [track.fullAudioUrl, track.previewUrl].filter(
      (u): u is string => Boolean(u && typeof u === 'string')
    );

    let fetched: { buffer: ArrayBuffer; mimeType: string } | null = null;
    for (const url of candidates) {
      if (ctrl.signal.aborted) break;
      try {
        fetched = await fetchAudioBufferWithProgress(url, offlineKey, ctrl.signal);
        if (fetched) break;
      } catch {
        if (ctrl.signal.aborted) break;
      }
    }

    if (!fetched || ctrl.signal.aborted) {
      return false;
    }

    progressMap.set(offlineKey, 97);
    notifySubscribers();

    const cachedCover = await cacheCoverAsDataUrl(track.coverSmall || track.cover);
    const savedTrack: SpotifyTrackItem = {
      ...track,
      cover: cachedCover || track.cover,
      coverSmall: cachedCover || track.coverSmall || track.cover,
    };

    const record: OfflineMusicTrackRecord = {
      offlineKey,
      track: savedTrack,
      mimeType: fetched.mimeType || 'audio/mp4',
      sizeBytes: fetched.buffer.byteLength,
      downloadedAt: Date.now(),
    };

    await idbPutTrackAndBlob(record, fetched.buffer);
    recordsMap.set(offlineKey, record);
    return true;
  } catch {
    return false;
  } finally {
    abortControllers.delete(offlineKey);
    progressMap.delete(offlineKey);
    queuedKeys.delete(offlineKey);
    if (batchStats.active) {
      batchStats.completed += 1;
      if (pendingQueue.length === 0 && activeWorkers <= 1) {
        batchStats = { active: false, completed: 0, total: 0, currentTitle: '' };
      }
    }
    notifySubscribers();
  }
}

const singleWaiters = new Map<string, Array<(ok: boolean) => void>>();

function pumpQueue(): void {
  while (activeWorkers < DOWNLOAD_CONCURRENCY && pendingQueue.length > 0) {
    const nextTrack = pendingQueue.shift();
    if (!nextTrack) break;
    const key = getOfflineTrackKey(nextTrack);
    if (!queuedKeys.has(key) || recordsMap.has(key)) {
      queuedKeys.delete(key);
      progressMap.delete(key);
      if (batchStats.active) batchStats.completed += 1;
      const waiters = singleWaiters.get(key);
      if (waiters) {
        singleWaiters.delete(key);
        waiters.forEach((fn) => fn(recordsMap.has(key)));
      }
      continue;
    }

    activeWorkers += 1;
    void performSingleDownload(nextTrack)
      .then((ok) => {
        const waiters = singleWaiters.get(key);
        if (waiters) {
          singleWaiters.delete(key);
          waiters.forEach((fn) => fn(ok));
        }
      })
      .finally(() => {
        activeWorkers = Math.max(0, activeWorkers - 1);
        if (pendingQueue.length === 0 && activeWorkers === 0 && batchStats.active) {
          batchStats = { active: false, completed: 0, total: 0, currentTitle: '' };
          notifySubscribers();
        } else {
          pumpQueue();
        }
      });
  }
}

export function downloadTrackOffline(track: SpotifyTrackItem): Promise<boolean> {
  const key = getOfflineTrackKey(track);
  if (recordsMap.has(key)) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    const list = singleWaiters.get(key) || [];
    list.push(resolve);
    singleWaiters.set(key, list);

    if (!queuedKeys.has(key)) {
      queuedKeys.add(key);
      progressMap.set(key, 0);
      pendingQueue.push(track);
      notifySubscribers();
      pumpQueue();
    }
  });
}

export function downloadTrackCollectionOffline(tracks: SpotifyTrackItem[]): void {
  const toQueue: SpotifyTrackItem[] = [];
  const seen = new Set<string>();
  for (const t of tracks) {
    if (!t || !t.id || !t.title) continue;
    const key = getOfflineTrackKey(t);
    if (seen.has(key) || recordsMap.has(key) || queuedKeys.has(key)) continue;
    seen.add(key);
    toQueue.push(t);
  }
  if (toQueue.length === 0) return;

  batchStats = {
    active: true,
    completed: batchStats.active ? batchStats.completed : 0,
    total: (batchStats.active ? batchStats.total : 0) + toQueue.length,
    currentTitle: `${toQueue[0].artist} — ${toQueue[0].title}`,
  };

  for (const t of toQueue) {
    const key = getOfflineTrackKey(t);
    queuedKeys.add(key);
    progressMap.set(key, 0);
    pendingQueue.push(t);
  }
  notifySubscribers();
  pumpQueue();
}

export function cancelCollectionDownload(tracks?: SpotifyTrackItem[]): void {
  if (!tracks || tracks.length === 0) {
    pendingQueue.length = 0;
    queuedKeys.clear();
    progressMap.clear();
    abortControllers.forEach((ctrl) => ctrl.abort());
    abortControllers.clear();
    batchStats = { active: false, completed: 0, total: 0, currentTitle: '' };
    notifySubscribers();
    return;
  }

  const targetKeys = new Set(tracks.map((t) => getOfflineTrackKey(t)));
  for (let i = pendingQueue.length - 1; i >= 0; i--) {
    const k = getOfflineTrackKey(pendingQueue[i]);
    if (targetKeys.has(k)) {
      pendingQueue.splice(i, 1);
    }
  }
  for (const k of targetKeys) {
    queuedKeys.delete(k);
    progressMap.delete(k);
    const ctrl = abortControllers.get(k);
    if (ctrl) {
      ctrl.abort();
      abortControllers.delete(k);
    }
  }
  if (queuedKeys.size === 0) {
    batchStats = { active: false, completed: 0, total: 0, currentTitle: '' };
  }
  notifySubscribers();
}

export async function removeTrackOffline(
  track: Pick<SpotifyTrackItem, 'id' | 'artist' | 'title'>
): Promise<void> {
  const key = getOfflineTrackKey(track);
  queuedKeys.delete(key);
  progressMap.delete(key);
  const ctrl = abortControllers.get(key);
  if (ctrl) {
    ctrl.abort();
    abortControllers.delete(key);
  }
  recordsMap.delete(key);
  notifySubscribers();
  await idbDeleteTrack(key).catch(() => {});
}

export async function toggleTrackOffline(track: SpotifyTrackItem): Promise<void> {
  const key = getOfflineTrackKey(track);
  if (recordsMap.has(key) || queuedKeys.has(key) || progressMap.has(key)) {
    await removeTrackOffline(track);
    return;
  }
  await downloadTrackOffline(track);
}

export async function clearAllOfflineMusic(): Promise<void> {
  cancelCollectionDownload();
  recordsMap.clear();
  notifySubscribers();
  await idbClearAll().catch(() => {});
}

let activeOfflineObjectUrl: string | null = null;
export async function resolveOfflineMusicObjectUrl(
  track: Pick<SpotifyTrackItem, 'id' | 'artist' | 'title'>
): Promise<string | null> {
  try {
    await ensureOfflineMusicHydrated();
    const key = getOfflineTrackKey(track);
    const meta = recordsMap.get(key);
    const stored = await idbGetAudioBlob(key);
    if (!stored) {
      if (meta) {
        recordsMap.delete(key);
        notifySubscribers();
      }
      return null;
    }
    const blob =
      stored instanceof Blob
        ? stored
        : new Blob([stored], { type: meta?.mimeType || 'audio/mp4' });
    const nextUrl = URL.createObjectURL(blob);
    const prevUrl = activeOfflineObjectUrl;
    activeOfflineObjectUrl = nextUrl;
    if (prevUrl) {
      setTimeout(() => {
        try {
          URL.revokeObjectURL(prevUrl);
        } catch {
          // ignore
        }
      }, 2000);
    }
    return nextUrl;
  } catch {
    return null;
  }
}

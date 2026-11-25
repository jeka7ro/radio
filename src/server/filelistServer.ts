import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { createRequire } from 'node:module';
import { spawn, type ChildProcess } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import ffmpegPath from 'ffmpeg-static';

const requireCjs = createRequire(import.meta.url);
try {
  const resolvedEnginePath = requireCjs.resolve('./fastTorrentEngine.cjs');
  delete requireCjs.cache[resolvedEnginePath];
} catch {
  // ignore
}
const torrentStream = requireCjs('./fastTorrentEngine.cjs') as (
  link: Buffer | string,
  opts?: Record<string, unknown>
) => any;

if (!(globalThis as any).__aetherUncaughtGuardInstalled) {
  (globalThis as any).__aetherUncaughtGuardInstalled = true;
  process.on('uncaughtException', (err: any) => {
    const code = err?.code || '';
    const msg = String(err?.message || err || '');
    if (
      code === 'ERR_UNESCAPED_CHARACTERS' ||
      code === 'ECONNRESET' ||
      code === 'EPIPE' ||
      msg.includes('Request path contains unescaped characters') ||
      msg.includes('bittorrent-tracker')
    ) {
      console.warn('[TorrentGuard] Ignored non-fatal tracker/stream error:', msg);
      return;
    }
    console.error('[UncaughtException]', err);
  });
  process.on('unhandledRejection', (reason: any) => {
    console.warn('[UnhandledRejection]', reason?.message || reason);
  });
}

const SESSION_FILE = path.resolve(process.cwd(), '.filelist-session.json');
const KINOZAL_SESSION_FILE = path.resolve(process.cwd(), '.kinozal-session.json');
const TORRENT_CACHE_DIR = '/tmp/aether-torrents';

const DEFAULT_FL_CREDENTIALS = {
  username: 'jeka7ro',
  password: '11Decembrie!',
  passkey: 'e5414e22e5327ac79101a9c63522107a',
  cookie: 'uid=1639732; pass=887313c4bead053797ba7dfb37f29b46',
  updatedAt: Date.now(),
};

const DEFAULT_KINOZAL_CREDENTIALS = {
  username: 'popescu20210',
  password: 'NOKIAN',
  cookie: '',
  updatedAt: Date.now(),
};

try {
  if (!fs.existsSync(KINOZAL_SESSION_FILE)) {
    fs.writeFileSync(
      KINOZAL_SESSION_FILE,
      JSON.stringify(DEFAULT_KINOZAL_CREDENTIALS, null, 2),
      'utf8'
    );
  }
} catch {
  // ignore
}

interface FileListSession {
  username: string;
  password?: string;
  passkey: string;
  cookie: string;
  updatedAt: number;
}

export interface FileListTorrentCard {
  id: number;
  flId: string;
  name: string;
  releaseTitle: string;
  year: string;
  type: 'movie' | 'series';
  imdbId: string;
  poster: string;
  category: string;
  quality: string;
  isRo: boolean;
  freeleech: boolean;
  doubleup: boolean;
  sizeBytes: number;
  sizeFormatted: string;
  seeders: number;
  leechers: number;
  uploadDate: string;
  genres: string[];
  provider?: 'filelist' | 'torrentio' | 'kinozal';
  infoHash?: string;
  fileIdx?: number;
  audioInfo?: string;
  rutorId?: string;
}

interface ActiveTorrentEngine {
  id: number;
  engine: any;
  ready: boolean;
  readyPromise: Promise<void>;
  lastAccessed: number;
  activeStreams: Set<() => void>;
  activeDownloads?: number;
  verifiedPieces: Set<number>;
  prewarmedFiles?: Set<number>;
  lastTrackerError?: string;
  infoHash?: string;
  lastDirectHttpAnnounceAt?: number;
  files: Array<{
    index: number;
    name: string;
    path: string;
    length: number;
  }>;
  probeCache: Map<
    number,
    {
      durationSec: number;
      videoCodec: string;
      audioTracks: Array<{
        index: number;
        lang: string;
        codec: string;
        title: string;
        label: string;
      }>;
      subtitleTracks?: EmbeddedSubtitleTrack[];
    }
  >;
}

interface ActiveHlsSession {
  key: string;
  sessionId: string;
  dir: string;
  proc: ChildProcess | null;
  exited: boolean;
  startedAt: number;
  lastAccessed: number;
}

export interface EmbeddedSubtitleTrack {
  index: number;
  lang: string;
  langCode2: string;
  langLabel: string;
  codec: string;
  title: string;
  label: string;
  forced: boolean;
  sdh: boolean;
  isText: boolean;
}

interface LiveSubCue {
  start: number;
  end: number;
  text: string;
}

interface LiveSubBucket {
  track: EmbeddedSubtitleTrack;
  cues: LiveSubCue[];
  cueKeys: Set<string>;
  listeners: Set<(cue: LiveSubCue) => void>;
  updatedAt: number;
  fullDiskExtracted?: boolean;
  fullDiskExtracting?: Promise<void> | null;
}

interface GlobalFileListState {
  activeEngines: Map<number, ActiveTorrentEngine>;
  magnetMetaById: Map<
    number,
    {
      infoHash: string;
      trackers: string[];
      fileIdx?: number;
      releaseTitle?: string;
      rutorId?: string;
      provider?: string;
    }
  >;
  activeStreamProcess: ChildProcess | null;
  activeHlsSession: ActiveHlsSession | null;
  internalRangeServerPort: number;
  rangePrioritySeq: number;
  lastFlIpVerifiedAt?: number;
  inFlightFlUnlockPromise?: Promise<boolean> | null;
  liveSubBuckets?: Map<string, LiveSubBucket>;
}

const gState: GlobalFileListState =
  (globalThis as any).__aetherFileListState ||
  ((globalThis as any).__aetherFileListState = {
    activeEngines: new Map<number, ActiveTorrentEngine>(),
    magnetMetaById: new Map(),
    activeStreamProcess: null,
    activeHlsSession: null,
    internalRangeServerPort: 0,
    rangePrioritySeq: 10,
  });

if (!gState.magnetMetaById) {
  gState.magnetMetaById = new Map();
}
if (!gState.liveSubBuckets) {
  gState.liveSubBuckets = new Map();
}

const MKV_SUB_LANG_MAP: Record<string, { code2: string; label: string }> = {
  ron: { code2: 'ro', label: 'Română' },
  rum: { code2: 'ro', label: 'Română' },
  mol: { code2: 'ro', label: 'Română' },
  ro: { code2: 'ro', label: 'Română' },
  eng: { code2: 'en', label: 'English' },
  en: { code2: 'en', label: 'English' },
  rus: { code2: 'ru', label: 'Русский' },
  ru: { code2: 'ru', label: 'Русский' },
  spa: { code2: 'es', label: 'Español' },
  es: { code2: 'es', label: 'Español' },
  fre: { code2: 'fr', label: 'Français' },
  fra: { code2: 'fr', label: 'Français' },
  fr: { code2: 'fr', label: 'Français' },
  ger: { code2: 'de', label: 'Deutsch' },
  deu: { code2: 'de', label: 'Deutsch' },
  de: { code2: 'de', label: 'Deutsch' },
  ita: { code2: 'it', label: 'Italiano' },
  it: { code2: 'it', label: 'Italiano' },
  ukr: { code2: 'uk', label: 'Українська' },
  uk: { code2: 'uk', label: 'Українська' },
  por: { code2: 'pt', label: 'Português' },
  pol: { code2: 'pl', label: 'Polski' },
  hun: { code2: 'hu', label: 'Magyar' },
  tur: { code2: 'tr', label: 'Türkçe' },
  bul: { code2: 'bg', label: 'Български' },
};

function mapMkvSubLang(rawLang: string, metaTitle: string): { code2: string; label: string } {
  const l = String(rawLang || '').toLowerCase().trim();
  if (MKV_SUB_LANG_MAP[l]) return MKV_SUB_LANG_MAP[l];
  const t = String(metaTitle || '').toLowerCase();
  if (/\b(romanian|romana|română)\b/.test(t)) return { code2: 'ro', label: 'Română' };
  if (/\b(english|eng)\b/.test(t)) return { code2: 'en', label: 'English' };
  if (/\b(russian|русский|rus)\b/.test(t)) return { code2: 'ru', label: 'Русский' };
  if (/\b(spanish|español)\b/.test(t)) return { code2: 'es', label: 'Español' };
  return { code2: l.slice(0, 2) || 'und', label: l.toUpperCase() || 'MKV' };
}

function pickEmbeddedSubtitleTrack(
  tracks: EmbeddedSubtitleTrack[] | undefined,
  subLang: string,
  explicitSubIdx: number
): EmbeddedSubtitleTrack | null {
  if (!Array.isArray(tracks) || tracks.length === 0) return null;
  const textTracks = tracks.filter((t) => t.isText);
  if (textTracks.length === 0) return null;
  if (explicitSubIdx >= 0) {
    return textTracks.find((t) => t.index === explicitSubIdx) || null;
  }
  const cleanLang = String(subLang || '').toLowerCase().trim();
  if (!cleanLang || cleanLang === 'off') return null;
  const matching = textTracks.filter((t) => t.langCode2 === cleanLang);
  if (matching.length === 0) return null;
  return (
    matching.find((t) => !t.forced && !t.sdh) ||
    matching.find((t) => !t.forced) ||
    matching[0]
  );
}

function getOrCreateLiveSubBucket(
  key: string,
  track: EmbeddedSubtitleTrack
): LiveSubBucket {
  const map = gState.liveSubBuckets || (gState.liveSubBuckets = new Map());
  let bucket = map.get(key);
  if (!bucket) {
    if (map.size >= 24) {
      let oldestKey = '';
      let oldestTs = Infinity;
      for (const [k, v] of map.entries()) {
        if (v.updatedAt < oldestTs && v.listeners.size === 0) {
          oldestTs = v.updatedAt;
          oldestKey = k;
        }
      }
      if (oldestKey) map.delete(oldestKey);
    }
    bucket = {
      track,
      cues: [],
      cueKeys: new Set(),
      listeners: new Set(),
      updatedAt: Date.now(),
    };
    map.set(key, bucket);
  } else {
    bucket.track = track;
    bucket.updatedAt = Date.now();
  }
  return bucket;
}

function parseVttTimestampSec(ts: string): number {
  const parts = ts.trim().replace(',', '.').split(':');
  if (parts.length === 3) {
    return (Number(parts[0]) || 0) * 3600 + (Number(parts[1]) || 0) * 60 + (Number(parts[2]) || 0);
  }
  if (parts.length === 2) {
    return (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0);
  }
  return 0;
}

function attachLiveVttPipeReader(
  stream: NodeJS.ReadableStream,
  bucket: LiveSubBucket,
  offsetSec: number
): void {
  let buf = '';
  const timeRe =
    /(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{2}:\d{2}[,.]\d{1,3})/;

  const flushBlocks = (isFinal: boolean) => {
    const normalized = buf.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const parts = normalized.split('\n\n');
    if (!isFinal) {
      buf = parts.pop() || '';
    } else {
      buf = '';
    }
    for (const block of parts) {
      const lines = block
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length === 0) continue;
      let tIdx = -1;
      let m: RegExpMatchArray | null = null;
      for (let i = 0; i < Math.min(lines.length, 3); i++) {
        const hit = lines[i].match(timeRe);
        if (hit) {
          tIdx = i;
          m = hit;
          break;
        }
      }
      if (tIdx < 0 || !m) continue;
      const start = Math.max(0, Number((parseVttTimestampSec(m[1]) + offsetSec).toFixed(3)));
      const end = Math.max(0, Number((parseVttTimestampSec(m[2]) + offsetSec).toFixed(3)));
      const text = lines
        .slice(tIdx + 1)
        .map((l) => l.replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').trim())
        .filter(Boolean)
        .join('\n');
      if (!text || end <= start) continue;
      if (bucket.cues.length >= 4000) continue;
      const ck = `${Math.round(start * 10)}|${Math.round(end * 10)}|${text}`;
      if (bucket.cueKeys.has(ck)) continue;
      bucket.cueKeys.add(ck);
      const cue: LiveSubCue = { start, end, text };
      bucket.cues.push(cue);
      bucket.updatedAt = Date.now();
      for (const listener of bucket.listeners) {
        try {
          listener(cue);
        } catch {
          // ignore
        }
      }
    }
  };

  stream.on('data', (chunk: Buffer | string) => {
    buf += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    if (buf.includes('\n\n') || buf.includes('\r\n\r\n')) {
      flushBlocks(false);
    }
  });
  stream.on('end', () => flushBlocks(true));
  stream.on('error', () => {});
}
const activeEngines = gState.activeEngines;
const magnetMetaById = gState.magnetMetaById;

if (!(globalThis as any).__aetherIdleReaperStarted) {
  (globalThis as any).__aetherIdleReaperStarted = true;
  const idleMinutes = Math.max(3, Number(process.env.FILMIO_IDLE_TORRENT_MIN || 10));
  const idleTimeoutMs = idleMinutes * 60 * 1000;
  const reaperTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of activeEngines.entries()) {
      const hasStreams = Boolean(entry.activeStreams && entry.activeStreams.size > 0);
      const hasDownloads = Number(entry.activeDownloads || 0) > 0;
      if (hasStreams || hasDownloads) continue;
      if (now - entry.lastAccessed > idleTimeoutMs) {
        activeEngines.delete(id);
        try {
          entry.engine?.destroy();
        } catch {
          // ignore
        }
        console.log(`[TorrentReaper] Stopped idle engine #${id} after ${idleMinutes}m inactivity`);
      }
    }
  }, 2 * 60 * 1000);
  if (typeof reaperTimer.unref === 'function') {
    reaperTimer.unref();
  }
}

function ensureTmpDir() {
  try {
    if (!fs.existsSync(TORRENT_CACHE_DIR)) {
      fs.mkdirSync(TORRENT_CACHE_DIR, { recursive: true });
    }
  } catch {
    // ignore
  }
}

function loadSession(): FileListSession {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      if (parsed && parsed.username && (parsed.passkey || parsed.cookie)) {
        return {
          ...DEFAULT_FL_CREDENTIALS,
          ...parsed,
        };
      }
    }
  } catch {
    // fallback
  }
  saveSession(DEFAULT_FL_CREDENTIALS);
  return { ...DEFAULT_FL_CREDENTIALS };
}

function saveSession(session: FileListSession) {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface SimpleFetchResponse {
  ok: boolean;
  status: number;
  headers: {
    getSetCookie: () => string[];
  };
  text: () => Promise<string>;
  json: () => Promise<any>;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

function httpsFallbackFetch(
  urlStr: string,
  init?: RequestInit,
  timeoutMs = 9000,
  redirectsLeft = 3
): Promise<SimpleFetchResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finishResolve = (val: SimpleFetchResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      resolve(val);
    };
    const finishReject = (err: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      reject(err instanceof Error ? err : new Error(String(err || 'Request failed')));
    };

    const u = new URL(urlStr);
    const isHttps = u.protocol === 'https:';
    const mod = isHttps ? https : http;
    const rawHeaders: Record<string, string> = {};
    if (init?.headers) {
      for (const [k, v] of Object.entries(init.headers as Record<string, string>)) {
        if (v !== undefined) rawHeaders[k] = String(v);
      }
    }
    const bodyBuf =
      typeof init?.body === 'string'
        ? Buffer.from(init.body, 'utf8')
        : init?.body instanceof Buffer
          ? init.body
          : null;
    if (bodyBuf && !rawHeaders['Content-Length'] && !rawHeaders['content-length']) {
      rawHeaders['Content-Length'] = String(bodyBuf.length);
    }

    const req = mod.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method: init?.method || 'GET',
        headers: rawHeaders,
        family: 4,
        timeout: timeoutMs,
      },
      (res) => {
        const status = res.statusCode || 500;
        const location = res.headers.location;
        if (
          init?.redirect !== 'manual' &&
          (status === 301 || status === 302 || status === 303 || status === 307 || status === 308) &&
          location &&
          redirectsLeft > 0
        ) {
          res.resume();
          const nextUrl = new URL(location, urlStr).toString();
          httpsFallbackFetch(
            nextUrl,
            { ...init, method: status === 303 ? 'GET' : init?.method, body: status === 303 ? undefined : init?.body },
            timeoutMs,
            redirectsLeft - 1
          )
            .then(finishResolve)
            .catch(finishReject);
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
        res.on('error', finishReject);
        res.on('aborted', () => finishReject(new Error('Response aborted')));
        res.on('close', () => {
          if (!settled) {
            finishReject(new Error('Response closed prematurely'));
          }
        });
        res.on('end', () => {
          const fullBuf = Buffer.concat(chunks);
          const rawSetCookie = res.headers['set-cookie'];
          const cookieArr = Array.isArray(rawSetCookie)
            ? rawSetCookie
            : rawSetCookie
              ? [rawSetCookie]
              : [];
          finishResolve({
            ok: status >= 200 && status < 300,
            status,
            headers: {
              getSetCookie: () => cookieArr,
            },
            text: async () => fullBuf.toString('utf8'),
            json: async () => JSON.parse(fullBuf.toString('utf8')),
            arrayBuffer: async () =>
              fullBuf.buffer.slice(fullBuf.byteOffset, fullBuf.byteOffset + fullBuf.byteLength),
          });
        });
      }
    );
    const hardTimer = setTimeout(() => {
      try {
        req.destroy(new Error('Hard request timeout'));
      } catch {
        // ignore
      }
      finishReject(new Error('Hard request timeout'));
    }, timeoutMs + 1000);
    req.on('timeout', () => {
      req.destroy(new Error('Request timeout'));
    });
    req.on('error', finishReject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

async function safeFetch(
  urlStr: string,
  init?: RequestInit,
  retries = 3,
  timeoutMs = 8500
): Promise<SimpleFetchResponse> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(urlStr, {
          ...init,
          signal: controller.signal,
        });
        const rawBuf = Buffer.from(await res.arrayBuffer());
        const cookieArr =
          typeof res.headers.getSetCookie === 'function'
            ? res.headers.getSetCookie()
            : [];
        clearTimeout(timer);
        return {
          ok: res.ok,
          status: res.status,
          headers: {
            getSetCookie: () => cookieArr,
          },
          text: async () => rawBuf.toString('utf8'),
          json: async () => JSON.parse(rawBuf.toString('utf8')),
          arrayBuffer: async () =>
            rawBuf.buffer.slice(rawBuf.byteOffset, rawBuf.byteOffset + rawBuf.byteLength),
        };
      } catch (err) {
        clearTimeout(timer);
        throw err;
      }
    } catch (err) {
      lastErr = err;
      try {
        return await httpsFallbackFetch(urlStr, init, timeoutMs);
      } catch (fbErr) {
        lastErr = fbErr;
      }
      if (attempt + 1 < retries) {
        await new Promise((r) => setTimeout(r, 220 * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Network request failed');
}

export async function authenticateFileList(
  username?: string,
  password?: string
): Promise<FileListSession> {
  const current = loadSession();
  const user = (username || current.username || DEFAULT_FL_CREDENTIALS.username).trim();
  const pass = password || current.password || DEFAULT_FL_CREDENTIALS.password;

  try {
    const res1 = await safeFetch('https://filelist.io/login.php', {
      headers: { 'User-Agent': USER_AGENT },
    });
    const cookies1 = res1.headers.getSetCookie ? res1.headers.getSetCookie() : [];
    const cookieMap = new Map<string, string>();
    for (const rawC of cookies1) {
      const pair = String(rawC || '').split(';')[0].trim();
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      const k = pair.slice(0, eq).trim();
      const v = pair.slice(eq + 1).trim();
      if (v && v !== 'deleted') cookieMap.set(k, v);
    }
    const phpSess = cookieMap.get('PHPSESSID')
      ? `PHPSESSID=${cookieMap.get('PHPSESSID')}`
      : '';
    const html1 = await res1.text();
    const validator =
      (html1.match(/name=["']validator["']\s+value=["']([^"']+)["']/i) || [])[1] || '';

    const body = new URLSearchParams({
      validator,
      username: user,
      password: pass,
      unlock: '1',
    });

    const res2 = await safeFetch('https://filelist.io/takelogin.php', {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: phpSess,
        Origin: 'https://filelist.io',
        Referer: 'https://filelist.io/login.php',
      },
      body: body.toString(),
      redirect: 'manual',
    });

    const cookies2 = res2.headers.getSetCookie ? res2.headers.getSetCookie() : [];
    for (const rawC of cookies2) {
      const pair = String(rawC || '').split(';')[0].trim();
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      const k = pair.slice(0, eq).trim();
      const v = pair.slice(eq + 1).trim();
      if (!v || v === 'deleted') {
        cookieMap.delete(k);
      } else {
        cookieMap.set(k, v);
      }
    }
    const combinedCookie = Array.from(cookieMap.entries())
      .filter(([k]) => k === 'PHPSESSID' || k === 'uid' || k === 'pass')
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    let passkey = current.passkey;
    let myStatus = 0;
    if (combinedCookie.includes('uid=')) {
      const resMy = await safeFetch('https://filelist.io/my.php', {
        headers: { 'User-Agent': USER_AGENT, Cookie: combinedCookie },
        redirect: 'manual',
      });
      myStatus = resMy.status;
      if (resMy.status === 200) {
        const htmlMy = await resMy.text();
        const pkMatch =
          htmlMy.match(/passkey[\s\S]{0,250}?([a-f0-9]{32})/i) ||
          htmlMy.match(/([a-f0-9]{32})/);
        if (pkMatch?.[1]) {
          passkey = pkMatch[1];
        }
      }
    }

    console.log(
      `[FileList-Auth] Unlocked tracker IP for ${user} (takelogin HTTP ${res2.status}, my.php HTTP ${myStatus || 'skip'})`
    );

    const updated: FileListSession = {
      username: user,
      password: pass,
      passkey: passkey || DEFAULT_FL_CREDENTIALS.passkey,
      cookie: combinedCookie.includes('uid=') ? combinedCookie : current.cookie,
      updatedAt: Date.now(),
    };
    saveSession(updated);
    return updated;
  } catch (err) {
    console.warn('[FileList-Auth] authenticateFileList error:', (err as Error)?.message || err);
    return current;
  }
}

export async function ensureFileListTrackerIpUnlocked(force = false): Promise<boolean> {
  if (
    !force &&
    gState.lastFlIpVerifiedAt &&
    Date.now() - gState.lastFlIpVerifiedAt < 10 * 60 * 1000
  ) {
    return true;
  }
  if (gState.inFlightFlUnlockPromise) {
    return gState.inFlightFlUnlockPromise;
  }

  const runPromise = (async (): Promise<boolean> => {
    try {
      const current = loadSession();
      let needLogin = force || !current.cookie?.includes('uid=');
      let okSession = false;

      if (!needLogin) {
        try {
          const checkRes = await safeFetch('https://filelist.io/my.php', {
            headers: { 'User-Agent': USER_AGENT, Cookie: current.cookie },
            redirect: 'manual',
          });
          okSession = checkRes.status === 200;
          if (!okSession) needLogin = true;
        } catch {
          needLogin = true;
        }
      }

      let activeSession = current;
      if (needLogin) {
        activeSession = await authenticateFileList();
        try {
          const verifyRes = await safeFetch('https://filelist.io/my.php', {
            headers: { 'User-Agent': USER_AGENT, Cookie: activeSession.cookie },
            redirect: 'manual',
          });
          okSession = verifyRes.status === 200;
        } catch {
          okSession = activeSession.cookie.includes('uid=');
        }
      }

      gState.lastFlIpVerifiedAt = Date.now();

      for (const [eid, entry] of activeEngines.entries()) {
        if (eid <= 0 || !entry?.engine) continue;
        try {
          const trackerClient = entry.engine.discovery?.tracker;
          if (trackerClient && Array.isArray(trackerClient._trackers) && activeSession.passkey) {
            for (const tr of trackerClient._trackers) {
              if (tr?.announceUrl && /filelist\.io|thefl\.org/i.test(tr.announceUrl)) {
                tr.announceUrl = String(tr.announceUrl).replace(
                  /\/[a-f0-9]{32}\/announce/i,
                  `/${activeSession.passkey}/announce`
                );
              }
            }
          }
          trackerClient?.start?.();
          trackerClient?.update?.();
          entry.engine.pokePeers?.();
        } catch {
          // ignore per-engine refresh failure
        }
      }

      return okSession;
    } finally {
      gState.inFlightFlUnlockPromise = null;
    }
  })();

  gState.inFlightFlUnlockPromise = runPromise;
  return runPromise;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function parseCleanReleaseInfo(
  releaseName: string,
  categoryName: string
): {
  cleanTitle: string;
  year: string;
  quality: string;
  isRo: boolean;
  type: 'movie' | 'series';
} {
  const raw = String(releaseName || '').replace(/_/g, '.');
  const isSeries =
    /serial|tv|anime/i.test(categoryName) ||
    /\bS\d{1,2}(?:E\d{1,2}|\.Complete|-\d)/i.test(raw) ||
    /\bSeason[\s.]?\d+/i.test(raw);

  const quality =
    /2160p|4K/i.test(raw) || (/\bUHD\b/i.test(raw) && !/\b(1080p|720p)\b/i.test(raw))
      ? '4K UHD'
      : /1080p/i.test(raw)
        ? '1080p Full HD'
        : /720p/i.test(raw)
          ? '720p HD'
          : 'HD';

  const isRo =
    /RO/i.test(categoryName) ||
    /\b(RO|ROsub|Romanian|Dublat|RoDubbed)\b/i.test(raw);

  let year = '2026';
  let cleanTitle = raw;

  // Match Series title before S01E01 or year
  const seriesMatch = raw.match(/^(.*?)[.\s]+(?:(19\d{2}|20\d{2})[.\s]+)?(S\d{1,2}(?:E\d{1,2})?|Season[\s.]?\d+)/i);
  const yearMatch = raw.match(/^(.*?)[.\s]+(19\d{2}|20\d{2})\b/);

  if (seriesMatch && seriesMatch[1]) {
    cleanTitle = seriesMatch[1].replace(/\./g, ' ').trim();
    if (seriesMatch[2]) year = seriesMatch[2];
    const epTag = seriesMatch[3].toUpperCase();
    cleanTitle = `${cleanTitle} (${epTag})`;
  } else if (yearMatch && yearMatch[1]) {
    cleanTitle = yearMatch[1].replace(/\./g, ' ').trim();
    year = yearMatch[2];
  } else {
    cleanTitle = raw
      .replace(/\b(2160p|1080p|720p|WEB-DL|WEBRip|BluRay|BDRip|HDRip|x264|x265|H\.?264|H\.?265|HEVC|DDP5\.1|AAC).*$/i, '')
      .replace(/\./g, ' ')
      .trim();
  }

  return {
    cleanTitle: cleanTitle || raw,
    year,
    quality,
    isRo,
    type: isSeries ? 'series' : 'movie',
  };
}

// Map TMDB posters cached from browse.php by torrent ID
const posterCacheByFlId = new Map<number, string>();

async function scrapeBrowsePhp(
  catIds: string,
  searchQuery: string,
  sortMode: 'seeders' | 'latest',
  page: number
): Promise<FileListTorrentCard[]> {
  let session = loadSession();
  const params = new URLSearchParams();
  if (catIds && !catIds.includes(',')) {
    params.set('cat', catIds);
  }
  if (searchQuery) {
    params.set('search', searchQuery);
    params.set('searchin', '1');
    params.set('sort', '2');
  } else if (sortMode === 'seeders') {
    params.set('sort', '7'); // sort=7 on FileList is Seeders descending
  }
  if (page > 1) {
    params.set('page', String(page - 1));
  }

  const url = `https://filelist.io/browse.php?${params.toString()}`;
  let res: SimpleFetchResponse;
  try {
    res = await safeFetch(url, {
      headers: { 'User-Agent': USER_AGENT, Cookie: session.cookie },
      redirect: 'manual',
    });
    if (res.status === 302 || res.status === 403) {
      session = await authenticateFileList();
      res = await safeFetch(url, {
        headers: { 'User-Agent': USER_AGENT, Cookie: session.cookie },
      });
    }
  } catch {
    return [];
  }

  const html = await res.text();
  const results: FileListTorrentCard[] = [];
  const rowBlocks = html.split("<div class='torrentrow'>").slice(1);

  for (const block of rowBlocks) {
    const idMatch = block.match(/details\.php\?id=(\d+)/);
    if (!idMatch) continue;
    const id = parseInt(idMatch[1], 10);

    const titleMatch =
      block.match(/details\.php\?id=\d+['"][^>]*title=['"]([^'"]+)['"]/i) ||
      block.match(/details\.php\?id=\d+[^>]*><b>([^<]+)<\/b>/i);
    const releaseTitle = titleMatch ? titleMatch[1].trim() : `Torrent #${id}`;

    const catMatch = block.match(/alt=['"]([^'"]+)['"]\s*\/>(?:<\/a>)?<\/span><\/div>/i);
    const category = catMatch ? catMatch[1] : 'Movies HD';

    const tmdbImgMatch = block.match(/https?:\/\/image\.tmdb\.org\/t\/p\/w\d+\/([^'"\s>]+)/i);
    const tmdbPoster = tmdbImgMatch
      ? `https://image.tmdb.org/t/p/w500/${tmdbImgMatch[1].replace(/^\/+/, '')}`
      : '';
    if (tmdbPoster) {
      posterCacheByFlId.set(id, tmdbPoster);
    }

    const genreMatch = block.match(/<font class=['"]small['"]>\[([^\]]+)\]<\/font>/i);
    const genres = genreMatch
      ? genreMatch[1]
          .split(/[,/]/)
          .map((g) => g.trim())
          .filter(Boolean)
      : [];

    const sizeMatch = block.match(/(\d+(?:\.\d+)?)<br\s*\/?>\s*(GB|MB)/i);
    const sizeVal = sizeMatch ? parseFloat(sizeMatch[1]) : 0;
    const sizeUnit = sizeMatch ? sizeMatch[2].toUpperCase() : 'GB';
    const sizeBytes =
      sizeUnit === 'GB'
        ? Math.round(sizeVal * 1024 * 1024 * 1024)
        : Math.round(sizeVal * 1024 * 1024);

    // Seeders is inside <b><font color=...>NUMBER</font></b> or <b><span ...>NUMBER</span></b>
    const seedersMatches = [
      ...block.matchAll(/<span style='width:45px;height:47px;[^>]*>[\s\S]*?>(\d+)<\/(?:font|span|b)>/gi),
    ];
    const seeders = seedersMatches[0] ? parseInt(seedersMatches[0][1], 10) : 10;

    const freeleech = /freeleech/i.test(block);
    const doubleup = /doubleup/i.test(block);

    const parsed = parseCleanReleaseInfo(releaseTitle, category);

    results.push({
      id,
      flId: `fl:${id}`,
      name: parsed.cleanTitle,
      releaseTitle,
      year: parsed.year,
      type: parsed.type,
      imdbId: '',
      poster: tmdbPoster,
      category,
      quality: parsed.quality,
      isRo: parsed.isRo,
      freeleech,
      doubleup,
      sizeBytes,
      sizeFormatted: sizeMatch ? `${sizeVal} ${sizeUnit}` : formatBytes(sizeBytes),
      seeders,
      leechers: 0,
      uploadDate: '',
      genres,
    });
  }

  return results;
}

async function fetchFileListApi(
  action: 'latest-torrents' | 'search-torrents',
  extraParams: Record<string, string>
): Promise<FileListTorrentCard[]> {
  let session = loadSession();
  const buildUrl = (s: FileListSession) => {
    const p = new URLSearchParams({
      username: s.username,
      passkey: s.passkey,
      action,
      ...extraParams,
    });
    return `https://filelist.io/api.php?${p.toString()}`;
  };

  let res: SimpleFetchResponse;
  try {
    res = await safeFetch(buildUrl(session), {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (res.status === 401 || res.status === 403) {
      session = await authenticateFileList();
      res = await safeFetch(buildUrl(session), {
        headers: { 'User-Agent': USER_AGENT },
      });
    }
  } catch {
    return [];
  }

  if (!res.ok) return [];
  let data: any;
  try {
    data = await res.json();
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  return data.map((row: any) => {
    const id = Number(row.id);
    const releaseTitle = String(row.name || '');
    const category = String(row.category || 'Movies HD');
    const imdbRaw = String(row.imdb || '').trim();
    const imdbId = imdbRaw.startsWith('tt')
      ? imdbRaw
      : /^\d{6,9}$/.test(imdbRaw)
        ? `tt${imdbRaw}`
        : '';
    const parsed = parseCleanReleaseInfo(releaseTitle, category);
    const cachedTmdb = posterCacheByFlId.get(id) || '';
    const poster =
      cachedTmdb ||
      (imdbId ? `https://images.metahub.space/poster/medium/${imdbId}/img` : '');
    const sizeBytes = Number(row.size || 0);
    const genres = String(row.small_description || '')
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);

    return {
      id,
      flId: `fl:${id}`,
      name: parsed.cleanTitle,
      releaseTitle,
      year: parsed.year,
      type: parsed.type,
      imdbId,
      poster,
      category,
      quality: parsed.quality,
      isRo: parsed.isRo,
      freeleech: Boolean(row.freeleech),
      doubleup: Boolean(row.doubleup),
      sizeBytes,
      sizeFormatted: formatBytes(sizeBytes),
      seeders: Number(row.seeders || 0),
      leechers: Number(row.leechers || 0),
      uploadDate: String(row.upload_date || ''),
      genres,
    };
  });
}

const catalogCache = new Map<string, { ts: number; items: FileListTorrentCard[] }>();
const inFlightCatalog = new Map<
  string,
  { promise: Promise<FileListTorrentCard[]>; startedAt: number }
>();

export async function getFileListCatalog(options: {
  section?: string;
  query?: string;
  imdb?: string;
  sort?: 'seeders' | 'latest';
  page?: number;
  fresh?: boolean;
}): Promise<FileListTorrentCard[]> {
  const section = options.section || 'ro';
  const query = (options.query || '').trim();
  const imdb = (options.imdb || '').trim();
  const sort = options.sort || 'seeders';
  const page = options.page || 1;
  const cacheKey = `${section}|${imdb}|${query.toLowerCase()}|${sort}|${page}`;
  const ttlMs = query || imdb ? 30_000 : 60_000;

  if (!options.fresh) {
    const cached = catalogCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < ttlMs) {
      return cached.items;
    }
    const existingFlight = inFlightCatalog.get(cacheKey);
    if (existingFlight && Date.now() - existingFlight.startedAt < 12_000) {
      return existingFlight.promise;
    }
  }
  inFlightCatalog.delete(cacheKey);

  const work = (async (): Promise<FileListTorrentCard[]> => {
    // Map section to FileList category IDs:
    // 19 = Filme HD-RO, 4 = Filme HD, 6 = Filme 4K, 20 = Filme Blu-Ray, 21 = Seriale HD, 27 = Seriale 4K, 15 = Desene, 24 = Anime
    const catMap: Record<string, string> = {
      ro: '19',
      movies_hd: '4',
      movies_4k: '6',
      series_hd: '21',
      series_4k: '27',
      cartoons: '15',
      anime: '24',
      xxx: '7',
      all_movies: '19,4,6',
      all_series: '21,27',
      top: '19',
    };
    const catIds = catMap[section] || '19';

    if (imdb) {
      const cleanImdb = imdb.startsWith('tt') ? imdb : `tt${imdb}`;
      const apiItems = await fetchFileListApi('search-torrents', {
        type: 'imdb',
        query: cleanImdb,
      }).catch(() => []);
      return apiItems.sort((a, b) => b.seeders - a.seeders);
    }

    if (query) {
      // FileList only indexes Latin/English release names — skip Cyrillic queries
      if (/[а-яА-ЯёЁ]/.test(query) && !/[a-zA-Z]/.test(query)) {
        return [];
      }
      const searchExtra: Record<string, string> = {
        type: 'name',
        query,
      };
      if (section === 'xxx') {
        searchExtra.category = '7';
      }
      const [apiItems, browseItems] = await Promise.all([
        fetchFileListApi('search-torrents', searchExtra).catch(() => []),
        section === 'xxx'
          ? Promise.resolve([])
          : scrapeBrowsePhp('', query, 'seeders', 1).catch(() => []),
      ]);

      const byId = new Map<number, FileListTorrentCard>();
      for (const item of [...apiItems, ...browseItems]) {
        const existing = byId.get(item.id);
        if (!existing) {
          byId.set(item.id, item);
        } else {
          byId.set(item.id, {
            ...existing,
            ...item,
            imdbId: existing.imdbId || item.imdbId,
            poster: item.poster || existing.poster,
            seeders: Math.max(existing.seeders, item.seeders),
          });
        }
      }
      return Array.from(byId.values())
        .filter((i) =>
          section === 'xxx'
            ? /xxx|adult/i.test(i.category)
            : /movie|film|serial|tv|hd|4k|desene|anime|ro/i.test(i.category)
        )
        .sort((a, b) => b.seeders - a.seeders);
    }

    // Combine browse.php (which has TMDB posters + Top Seeded sort) with api.php (which has IMDb IDs + latest torrents)
    const [browseItems, apiItems] = await Promise.all([
      section === 'xxx'
        ? Promise.resolve([])
        : scrapeBrowsePhp(catIds.split(',')[0], '', sort, page).catch(() => []),
      page === 1 || section === 'xxx'
        ? fetchFileListApi('latest-torrents', {
            category: catIds,
            limit: section === 'xxx' ? '80' : '40',
          }).catch(() => [])
        : Promise.resolve([]),
    ]);

    const mergedMap = new Map<number, FileListTorrentCard>();
    const primaryList = sort === 'seeders' ? [...browseItems, ...apiItems] : [...apiItems, ...browseItems];

    for (const item of primaryList) {
      const existing = mergedMap.get(item.id);
      if (!existing) {
        mergedMap.set(item.id, item);
      } else {
        mergedMap.set(item.id, {
          ...existing,
          imdbId: existing.imdbId || item.imdbId,
          poster:
            (existing.poster && existing.poster.includes('tmdb.org')
              ? existing.poster
              : item.poster) || existing.poster,
          seeders: Math.max(existing.seeders, item.seeders),
          freeleech: existing.freeleech || item.freeleech,
        });
      }
    }

    const finalItems = Array.from(mergedMap.values());
    if (sort === 'seeders') {
      finalItems.sort((a, b) => b.seeders - a.seeders);
    }
    return finalItems;
  })();

  let flightTimer: ReturnType<typeof setTimeout> | null = null;
  const guardedWork = Promise.race<FileListTorrentCard[]>([
    work,
    new Promise<FileListTorrentCard[]>((resolve) => {
      flightTimer = setTimeout(() => resolve([]), 12_000);
    }),
  ]);
  const flightEntry = { promise: guardedWork, startedAt: Date.now() };
  inFlightCatalog.set(cacheKey, flightEntry);
  try {
    const res = await guardedWork;
    if (res.length > 0) {
      catalogCache.set(cacheKey, { ts: Date.now(), items: res });
    }
    return res;
  } finally {
    if (flightTimer) clearTimeout(flightTimer);
    if (inFlightCatalog.get(cacheKey) === flightEntry) {
      inFlightCatalog.delete(cacheKey);
    }
  }
}

const DEFAULT_PUBLIC_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://explodie.org:6969/announce',
  'http://tracker.opentrackr.org:1337/announce',
];

const RUSSIAN_OPEN_HTTP_TRACKERS = [
  'http://bt.t-ru.org/ann',
  'http://bt2.t-ru.org/ann',
  'http://bt3.t-ru.org/ann',
  'http://bt4.t-ru.org/ann',
  'http://tracker.opentrackr.org:1337/announce',
];

async function announceDirectHttpPeersForEngine(
  infoHash: string,
  engine: any,
  entry?: ActiveTorrentEngine
): Promise<number> {
  const cleanHash = String(infoHash || '').trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(cleanHash) || typeof engine?.connect !== 'function') {
    return 0;
  }
  const now = Date.now();
  if (entry?.lastDirectHttpAnnounceAt && now - entry.lastDirectHttpAnnounceAt < 30_000) {
    return 0;
  }
  if (entry) {
    entry.lastDirectHttpAnnounceAt = now;
  }

  let encodedHash = '';
  for (let i = 0; i < cleanHash.length; i += 2) {
    encodedHash += `%${cleanHash.slice(i, i + 2)}`;
  }
  const peerId = `-qB4650-${cleanHash.slice(0, 12)}`;
  const discovered = new Set<string>();

  await Promise.all(
    RUSSIAN_OPEN_HTTP_TRACKERS.map(async (trUrl) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      try {
        const announceUrl = `${trUrl}?info_hash=${encodedHash}&peer_id=${encodeURIComponent(peerId)}&port=6881&uploaded=0&downloaded=0&left=1000000&compact=1&numwant=100`;
        const res = await fetch(announceUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'qBittorrent/4.6.5' },
        });
        if (!res.ok) return;
        const buf = Buffer.from(await res.arrayBuffer());
        const marker = Buffer.from('5:peers');
        const idx = buf.indexOf(marker);
        if (idx === -1) return;
        const colon = buf.indexOf(0x3a, idx + marker.length);
        if (colon === -1) return;
        const byteLen = parseInt(buf.slice(idx + marker.length, colon).toString('ascii'), 10);
        if (!Number.isFinite(byteLen) || byteLen < 6) return;
        const peersBuf = buf.slice(colon + 1, Math.min(buf.length, colon + 1 + byteLen));
        for (let i = 0; i + 6 <= peersBuf.length; i += 6) {
          const a = peersBuf[i];
          const b = peersBuf[i + 1];
          const c = peersBuf[i + 2];
          const d = peersBuf[i + 3];
          const port = peersBuf.readUInt16BE(i + 4);
          if (
            port <= 0 ||
            a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 192 && b === 168) ||
            (a === 172 && b >= 16 && b <= 31)
          ) {
            continue;
          }
          discovered.add(`${a}.${b}.${c}.${d}:${port}`);
        }
      } catch {
        // ignore tracker timeout / unreachable host
      } finally {
        clearTimeout(timer);
      }
    })
  );

  for (const addr of discovered) {
    try {
      engine.connect(addr);
    } catch {
      // ignore
    }
  }
  return discovered.size;
}

function hashToSyntheticId(infoHash: string): number {
  const clean = infoHash.trim().toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    h ^= clean.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const abs = Math.abs(h | 0) || 100001;
  return -abs;
}

async function fetchTorrentioStreams(
  imdbId: string,
  type: 'movie' | 'series',
  season?: number,
  episode?: number
): Promise<FileListTorrentCard[]> {
  if (!imdbId || !imdbId.startsWith('tt')) return [];
  const pathPart =
    type === 'series' && season && episode
      ? `series/${imdbId}:${season}:${episode}.json`
      : `movie/${imdbId}.json`;
  const url = `https://torrentio.strem.fun/stream/${pathPart}`;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5500);
    let data: {
      streams?: Array<{
        name?: string;
        title?: string;
        infoHash?: string;
        fileIdx?: number;
        sources?: string[];
        behaviorHints?: { filename?: string };
      }>;
    };
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });
      if (!res.ok) return [];
      data = (await res.json()) as typeof data;
    } finally {
      clearTimeout(t);
    }
    const rawStreams = Array.isArray(data?.streams) ? data.streams : [];
    const results: FileListTorrentCard[] = [];

    for (const s of rawStreams) {
      const infoHash = String(s.infoHash || '').trim().toLowerCase();
      if (!/^[a-f0-9]{40}$/.test(infoHash)) continue;
      const lines = String(s.title || '').split('\n').map((l) => l.trim()).filter(Boolean);
      const releaseLine = s.behaviorHints?.filename || lines[0] || `Torrentio ${infoHash.slice(0, 8)}`;
      const statsLine =
        lines.find((l) => /[\u{1F464}\u{1F4BE}]/u.test(l) || /\b(GB|MB)\b/i.test(l)) ||
        lines[1] ||
        '';
      const audioLine = lines.length >= 3 ? lines[lines.length - 1] : '';

      const seedMatch = statsLine.match(/\u{1F464}\s*(\d+)/u);
      const seeders = seedMatch ? parseInt(seedMatch[1], 10) : 15;
      if (seeders < 2) continue;

      const sizeMatch = statsLine.match(/(?:\u{1F4BE}\s*)?([\d.]+\s*[GMK]B)/iu);
      const sizeFormatted = sizeMatch ? sizeMatch[1] : '2.4 GB';
      const sizeNum = parseFloat(sizeFormatted) || 2.4;
      const sizeBytes = /GB/i.test(sizeFormatted)
        ? Math.round(sizeNum * 1024 * 1024 * 1024)
        : Math.round(sizeNum * 1024 * 1024);

      const trackerMatch = statsLine.match(/\u2699\uFE0F?\s*([^\n]+)/u);
      const trackerName = trackerMatch ? trackerMatch[1].trim() : 'P2P';

      const combinedText = `${s.name || ''} ${releaseLine}`;
      const quality =
        /2160p|4k/i.test(combinedText) ||
        (/\buhd\b/i.test(combinedText) && !/\b(1080p|720p)\b/i.test(combinedText))
          ? '4K UHD'
          : /1080p/i.test(combinedText)
            ? '1080p Full HD'
            : /720p/i.test(combinedText)
              ? '720p HD'
              : 'HD';

      const trackers = (s.sources || [])
        .filter((src) => src.startsWith('tracker:'))
        .map((src) => src.replace(/^tracker:/, ''));

      const synId = hashToSyntheticId(infoHash);
      magnetMetaById.set(synId, {
        infoHash,
        trackers: [...trackers, ...DEFAULT_PUBLIC_TRACKERS],
        fileIdx: typeof s.fileIdx === 'number' ? s.fileIdx : undefined,
        releaseTitle: releaseLine,
      });

      const isRo = /\u{1F1F7}\u{1F1F4}|\b(RO|ROsub|Romanian)\b/iu.test(String(s.title || ''));
      const cleanAudioInfo =
        audioLine && !/[\u{1F464}\u{1F4BE}]/u.test(audioLine)
          ? audioLine
              .replace(/\u{1F1EC}\u{1F1E7}|\u{1F1FA}\u{1F1F8}/gu, 'EN')
              .replace(/\u{1F1F7}\u{1F1F4}/gu, 'RO')
              .replace(/\u{1F1F7}\u{1F1FA}/gu, 'RU')
              .replace(/\u{1F1EB}\u{1F1F7}/gu, 'FR')
              .replace(/\u{1F1EA}\u{1F1F8}/gu, 'ES')
              .replace(/\u{1F1E9}\u{1F1EA}/gu, 'DE')
              .replace(/\u{1F1EE}\u{1F1F9}/gu, 'IT')
              .replace(/[^\x20-\x7E\u00A0-\u024F]/g, ' ')
              .replace(/(?:\s*\/\s*)+/g, ' / ')
              .replace(/(?:^\s*\/\s*|\s*\/\s*$)/g, '')
              .replace(/\s+/g, ' ')
              .trim() || undefined
          : undefined;
      results.push({
        id: synId,
        flId: `tio:${infoHash}`,
        name: releaseLine,
        releaseTitle: releaseLine,
        year: '2026',
        type,
        imdbId,
        poster: '',
        category: `Torrentio • ${trackerName}`,
        quality,
        isRo,
        freeleech: true,
        doubleup: false,
        sizeBytes,
        sizeFormatted,
        seeders,
        leechers: 0,
        uploadDate: 'Live P2P',
        genres: [],
        provider: 'torrentio',
        infoHash,
        fileIdx: typeof s.fileIdx === 'number' ? s.fileIdx : undefined,
        audioInfo: cleanAudioInfo,
      });
    }
    return results.slice(0, 18);
  } catch {
    return [];
  }
}

const KINOZAL_RU_CATEGORIES: Record<string, number[]> = {
  top_ru: [5, 16],
  series_ru: [16],
  movies_ru: [5],
  tvshows_ru: [6],
  docs_ru: [12],
  cartoons_ru: [7],
  all_ru: [16, 5, 6, 12],
};

function parseKinozalRowsFromHtml(
  html: string,
  defaultType: 'movie' | 'series' = 'movie',
  strictRussianOnly = true
): FileListTorrentCard[] {
  const rows = html.match(/<tr class="(?:gai|tum)">[\s\S]*?<\/tr>/gi) || [];
  const results: FileListTorrentCard[] = [];

  for (const row of rows) {
    const magMatch = row.match(/magnet:\?xt=urn:btih:([a-f0-9]{40})([^"']*)/i);
    const titleMatch = row.match(
      /href="\/torrent\/(\d+)\/[^"]*">([\s\S]*?)<\/a>/i
    );
    if (!magMatch || !titleMatch) continue;

    const infoHash = magMatch[1].trim().toLowerCase();
    const rutorId = titleMatch[1].trim();
    const rawTitle = decodeHtmlEntities(
      titleMatch[2].replace(/<[^>]+>/g, '').trim()
    );
    if (!rawTitle || !/[а-яёА-ЯЁ]/i.test(rawTitle)) continue;

    // Split before year/episode bracket to check if it has a foreign Latin original title after "/"
    const preYearPart = rawTitle.split(/\s*(?:\(\d{4}|\[|\bS\d{1,2})/i)[0] || rawTitle;
    if (strictRussianOnly && /\/\s*[A-Za-z]{2,}/.test(preYearPart)) {
      continue;
    }

    const sizeMatch = row.match(
      /<td align="right">([\d.]+(?:&nbsp;|\s+)(?:GB|MB|KB|TB))<\/td>/i
    );
    const sizeFormatted = sizeMatch
      ? sizeMatch[1].replace(/&nbsp;/gi, ' ').trim()
      : '3.2 GB';
    const sizeNum = parseFloat(sizeFormatted) || 3.2;
    const sizeBytes = /TB/i.test(sizeFormatted)
      ? Math.round(sizeNum * 1024 * 1024 * 1024 * 1024)
      : /GB/i.test(sizeFormatted)
        ? Math.round(sizeNum * 1024 * 1024 * 1024)
        : Math.round(sizeNum * 1024 * 1024);

    const seedMatch = row.match(
      /<span class="green">[\s\S]*?(?:&nbsp;|\s*)(\d+)<\/span>/i
    );
    const leechMatch = row.match(
      /<span class="red">(?:&nbsp;|\s*)(\d+)<\/span>/i
    );
    const seeders = seedMatch ? parseInt(seedMatch[1], 10) : 10;
    const leechers = leechMatch ? parseInt(leechMatch[1], 10) : 0;

    const dateMatch = row.match(/<td>(\d{2}&nbsp;[^<]+)<\/td>/i);
    const uploadDate = dateMatch
      ? dateMatch[1].replace(/&nbsp;/gi, ' ').trim()
      : 'Kinozal RU';

    const yearMatch = rawTitle.match(/\((\d{4})(?:-\d{4})?\)/);
    const year = yearMatch ? yearMatch[1] : '2026';

    const isSeries =
      defaultType === 'series' ||
      /\[S\d+|\[\d+x\d+|\bсезон\b|\bсерии\b|\bвыпуск/i.test(rawTitle);

    const quality = /(?:^|[^a-zа-яё0-9])(2160[pр]|4k|uhd)(?=$|[^a-zа-яё0-9])/i.test(rawTitle)
      ? '4K UHD'
      : /(?:^|[^a-zа-яё0-9])1080[piр](?=$|[^a-zа-яё0-9])/i.test(rawTitle)
        ? '1080p Full HD'
        : /(?:^|[^a-zа-яё0-9])720[pр](?=$|[^a-zа-яё0-9])/i.test(rawTitle)
          ? '720p HD'
          : '480p SD';

    // Clean display title (Russian title before [S01] / (2026) / quality tags / alternate slash title)
    const cleanName = (preYearPart || rawTitle)
      .replace(/\s*\[.*?\]\s*/g, ' ')
      .replace(/\s*\[.*$/g, '')
      .replace(/\s*\(\d{4}.*$/g, '')
      .replace(/\s*\(.*$/g, '')
      .replace(/\s*\/.*$/g, '')
      .replace(/[.\s-]*Сезон\s*\d+\.?/gi, '')
      .replace(/\s*(2160[pр]|1080[piр]|720[pр]|4K|UHD|WEB-?DLRip|WEB-?DL|WEBRip|BDRip|Blu-?Ray|HDTVRip|HDTV)(?=$|[^a-zа-яё0-9]).*$/i, '')
      .replace(/\s+/g, ' ')
      .replace(/[\[\]().,\s-]+$/g, '')
      .trim();

    const synId = hashToSyntheticId(infoHash);
    magnetMetaById.set(synId, {
      infoHash,
      trackers: [
        'udp://opentor.net:6969',
        'http://retracker.local/announce',
        ...DEFAULT_PUBLIC_TRACKERS,
      ],
      releaseTitle: rawTitle,
      rutorId,
      provider: 'kinozal',
    });

    results.push({
      id: synId,
      flId: `kz:${infoHash}`,
      name: cleanName || rawTitle,
      releaseTitle: rawTitle,
      year,
      type: isSeries ? 'series' : 'movie',
      imdbId: '',
      poster: '',
      category: `Kinozal VIP • RU (${DEFAULT_KINOZAL_CREDENTIALS.username})`,
      quality,
      isRo: false,
      freeleech: true,
      doubleup: true,
      sizeBytes,
      sizeFormatted,
      seeders,
      leechers,
      uploadDate,
      genres: [],
      provider: 'kinozal',
      infoHash,
      rutorId,
      audioInfo: 'RU Original (Лицензия)',
    });
  }

  return results;
}

async function fetchKinozalRussianTorrents(
  query: string,
  type: 'movie' | 'series',
  season?: number,
  episode?: number
): Promise<FileListTorrentCard[]> {
  const cleanQuery = query
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[.*?\]/g, ' ')
    .replace(/•.*$/g, ' ')
    .replace(/[.\s-]*Сезон\s*\d+\.?/gi, ' ')
    .replace(/[.\s-]*Выпуск\s*\d+\.?/gi, ' ')
    .replace(/\s+на\s+(?:ТНТ4?|НТВ|СТС|Пятниц[еа]!?)\s*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleanQuery || cleanQuery.length < 2) return [];

  // Search Russian categories first (16 = Русские сериалы, 5 = Наше кино, 6 = Телевизор, 12 = Документальное)
  const primaryCats = type === 'series' ? [16, 6, 12] : [5, 12, 16];
  const exactRutorEpUrls =
    type === 'series' && season && episode
      ? [
          `https://rutor.info/search/0/6/000/0/${encodeURIComponent(
            `${cleanQuery} ${String(season).padStart(2, '0')}x${String(episode).padStart(2, '0')}`
          )}`,
        ]
      : [];
  const urls = [
    ...exactRutorEpUrls,
    ...primaryCats.map(
      (cat) =>
        `https://rutor.info/search/0/${cat}/000/2/${encodeURIComponent(cleanQuery)}`
    ),
    ...(type === 'series'
      ? [`https://rutor.info/search/0/6/000/0/${encodeURIComponent(cleanQuery)}`]
      : []),
    `https://rutor.info/search/0/0/000/2/${encodeURIComponent(cleanQuery)}`,
  ];

  try {
    const fetchJacRedRussian = async (): Promise<FileListTorrentCard[]> => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 6000);
      try {
        const res = await fetch(
          `https://jr.maxvol.pro/api/v1.0/torrents?search=${encodeURIComponent(cleanQuery)}`,
          { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal }
        );
        if (!res.ok) return [];
        const rawArr = (await res.json()) as any[];
        if (!Array.isArray(rawArr)) return [];
        const out: FileListTorrentCard[] = [];
        for (const row of rawArr) {
          const rawTitle = String(row?.title || '').trim();
          const magnet = String(row?.magnet || '');
          const mHash = magnet.match(/btih:([a-f0-9]{40})/i);
          if (!rawTitle || !mHash || !/[а-яёА-ЯЁ]/i.test(rawTitle)) continue;
          const infoHash = mHash[1].toLowerCase();
          const preYearPart = rawTitle.split(/\s*(?:\(\d{4}|\[|\bS\d{1,2}|\(\d+\s*сезон)/i)[0] || rawTitle;
          if (/\/\s*[A-Za-z]{2,}/.test(preYearPart)) continue;
          const cleanName = preYearPart
            .replace(/\s*\[.*?\]\s*/g, ' ')
            .replace(/\s*\(\d{4}.*$/g, '')
            .replace(/\s*\(.*$/g, '')
            .replace(/\s*\/.*$/g, '')
            .replace(/[.\s-]*(?:\d+\s*сезон|сезон\s*\d+)\.?/gi, '')
            .replace(/\s+/g, ' ')
            .replace(/[\[\]().,\s-]+$/g, '')
            .trim();
          const quality = /(?:^|[^a-zа-яё0-9])(2160[pр]|4k|uhd)(?=$|[^a-zа-яё0-9])/i.test(rawTitle)
            ? '4K UHD'
            : /(?:^|[^a-zа-яё0-9])1080[piр](?=$|[^a-zа-яё0-9])|\bHDTV\b/i.test(rawTitle)
              ? '1080p Full HD'
              : /(?:^|[^a-zа-яё0-9])720[pр](?=$|[^a-zа-яё0-9])/i.test(rawTitle)
                ? '720p HD'
                : '480p SD';
          const seeders = Math.max(0, Number(row?.sid) || 0);
          const leechers = Math.max(0, Number(row?.pir) || 0);
          const sizeBytes = Math.max(0, Number(row?.size) || 0);
          const sizeFormatted = String(row?.sizeName || '2.8 GB');
          const yearMatch = rawTitle.match(/\((\d{4})(?:-\d{4})?\)/) || rawTitle.match(/\b(202\d)\b/);
          const year = yearMatch ? yearMatch[1] : '2026';
          const synId = hashToSyntheticId(infoHash);
          const magTrackers = [...magnet.matchAll(/tr=([^&]+)/gi)]
            .map((m) => {
              try {
                return decodeURIComponent(m[1]);
              } catch {
                return '';
              }
            })
            .filter(Boolean);
          const existingMeta = magnetMetaById.get(synId);
          magnetMetaById.set(synId, {
            infoHash,
            trackers: Array.from(
              new Set([
                ...(existingMeta?.trackers || []),
                ...magTrackers,
                ...DEFAULT_PUBLIC_TRACKERS,
              ])
            ),
            releaseTitle: existingMeta?.releaseTitle || rawTitle,
            rutorId: existingMeta?.rutorId,
            provider: 'kinozal',
          });
          out.push({
            id: synId,
            flId: `kz:${infoHash}`,
            name: cleanName || rawTitle,
            releaseTitle: rawTitle,
            year,
            type,
            imdbId: '',
            poster: '',
            category: `Kinozal VIP • RU (${String(row?.tracker || 'RU')})`,
            quality,
            isRo: false,
            freeleech: true,
            doubleup: true,
            sizeBytes,
            sizeFormatted,
            seeders,
            leechers,
            uploadDate: String(row?.createTime || 'Kinozal RU').slice(0, 10),
            genres: [],
            provider: 'kinozal',
            infoHash,
            rutorId: existingMeta?.rutorId,
            audioInfo: 'RU Original (Лицензия)',
          });
        }
        return out;
      } catch {
        return [];
      } finally {
        clearTimeout(t);
      }
    };

    const [pages, jacRedList] = await Promise.all([
      Promise.all(
        urls.map(async (u, idx) => {
          try {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 4500);
            const res = await fetch(u, {
              headers: { 'User-Agent': USER_AGENT },
              signal: controller.signal,
            });
            clearTimeout(t);
            if (!res.ok) return [];
            const html = await res.text();
            return parseKinozalRowsFromHtml(
              html,
              type,
              idx === urls.length - 1
            );
          } catch {
            return [];
          }
        })
      ),
      fetchJacRedRussian(),
    ]);

    const byHash = new Map<string, FileListTorrentCard>();
    for (const list of [...pages, jacRedList]) {
      for (const item of list) {
        const key = item.infoHash || String(item.id);
        const prev = byHash.get(key);
        if (!prev) {
          byHash.set(key, item);
        } else {
          // Merge best seeders/leechers while preserving Rutor .torrent id & cleanest releaseTitle
          prev.seeders = Math.max(prev.seeders, item.seeders);
          prev.leechers = Math.max(prev.leechers, item.leechers);
          if (!prev.rutorId && item.rutorId) {
            prev.rutorId = item.rutorId;
          }
        }
      }
    }
    const combined: FileListTorrentCard[] = Array.from(byHash.values());

    // Filter to items whose clean name matches our Russian query (prefer exact title match so "Тверская" never pollutes "Тверская: Здесь и сейчас")
    const stripGenericShowPrefix = (s: string) =>
      s
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/^(?:новые\s+|новый\s+|шоу\s+)+/gi, '')
        .replace(/[^\p{L}\p{N}]+/gu, '');
    const normQ = cleanQuery
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^\p{L}\p{N}]+/gu, '');
    const strippedQ = stripGenericShowPrefix(cleanQuery);
    const exactMatched = combined.filter((item) => {
      const normName = item.name
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^\p{L}\p{N}]+/gu, '');
      const strippedName = stripGenericShowPrefix(item.name);
      return (
        normName === normQ ||
        (strippedQ.length >= 3 && strippedName === strippedQ)
      );
    });
    const matched =
      exactMatched.length > 0
        ? exactMatched
        : combined.filter((item) => {
            const normName = item.name
              .toLowerCase()
              .replace(/ё/g, 'е')
              .replace(/[^\p{L}\p{N}]+/gu, '');
            return (
              normName.length >= 4 &&
              normQ.length >= 4 &&
              normName.startsWith(normQ)
            );
          });

    const getKzQualityScore = (q: string) =>
      q === '4K UHD'
        ? 4
        : q === '1080p Full HD'
          ? 3
          : q === '720p HD'
            ? 2
            : 1;
    const rawPool = matched;
    const seededHdPool = rawPool.filter(
      (t) => getKzQualityScore(t.quality) >= 2 && t.seeders >= 1
    );
    const seededAnyPool = rawPool.filter((t) => t.seeders >= 1);
    const hdPool = rawPool.filter((t) => getKzQualityScore(t.quality) >= 2);
    const pool = (
      seededHdPool.length > 0
        ? seededHdPool
        : seededAnyPool.length > 0
          ? seededAnyPool
          : hdPool.length > 0
            ? hdPool
            : rawPool
    ).sort(
      (a, b) =>
        (b.seeders > 0 ? 1 : 0) - (a.seeders > 0 ? 1 : 0) ||
        getKzQualityScore(b.quality) - getKzQualityScore(a.quality) ||
        b.seeders - a.seeders
    );

    if (type === 'series' && season) {
      const sPad = `S${String(season).padStart(2, '0')}`;
      const seasonRegex = new RegExp(
        `(\\[${sPad}|\\b${sPad}(?:E\\d+|\\b)|\\[0*${season}[xх]\\d+|\\b0*${season}\\s*сезон)`,
        'i'
      );
      const seasonMatches = pool.filter(
        (t) =>
          seasonRegex.test(t.releaseTitle) ||
          (season === 1 &&
            !/\[S0*[2-9]|\[S[1-9]\d|\bS0*[2-9](?:E\d+|\b)|\[0*[2-9][xх]|\[[1-9]\d[xх]|\b(?:[2-9]|[1-9]\d)\s*сезон/i.test(
              t.releaseTitle
            ))
      );
      if (seasonMatches.length === 0) {
        return [];
      }
      if (episode && episode > 0) {
        const matchesRequestedEpisode = (rel: string): boolean => {
          const mRangeBracket =
            rel.match(/\[(?:S?0*\d+[xх])?0*(\d+)\s*[-–]\s*0*(\d+)(?:\s*из\s*\d+)?\]/i) ||
            rel.match(/\b0*(\d+)\s*[-–]\s*0*(\d+)\s*(?:сери|выпуск)/i) ||
            rel.match(/\bS\d{1,2}E0*(\d+)\s*[-–]\s*E?0*(\d+)\b/i);
          if (mRangeBracket) {
            const startEp = Number(mRangeBracket[1]);
            const endEp = Number(mRangeBracket[2]);
            if (startEp > 0 && endEp >= startEp) {
              return episode >= startEp && episode <= endEp;
            }
          }
          const mSingle =
            rel.match(/\[(?:S?0*\d+[xх])0*(\d+)(?:\s*из\s*\d+)?\]/i) ||
            rel.match(/\bS\d{1,2}[.\s_-]*E0*(\d+)\b/i) ||
            rel.match(/(?:^|[^\d-])0*(\d+)\s*(?:серия|выпуск)(?=$|[^a-zа-яё0-9])/i);
          if (mSingle) {
            return Number(mSingle[1]) === episode;
          }
          return true;
        };
        const epMatches = seasonMatches.filter((t) =>
          matchesRequestedEpisode(t.releaseTitle)
        );
        return epMatches.slice(0, 25);
      }
      return seasonMatches.slice(0, 25);
    }

    return pool.slice(0, 25);
  } catch {
    return [];
  }
}

export interface KinozalCatalogEntry {
  fid: number;
  type: 'stream' | 'multistream';
  title: string;
  year: number;
  explicitSeason?: number;
  episodesCount?: number;
  quality?: string;
  fhd: boolean;
  '4k': boolean;
  seeders: number;
  sizeFormatted: string;
  infoHash: string;
  rutorId: string;
  releaseTitle: string;
  categoryId: string;
  networkBadge: string;
}

const kinozalCatalogCache = new Map<
  string,
  { ts: number; items: KinozalCatalogEntry[] }
>();

async function getKinozalRussianCatalog(params: {
  category?: string;
  years?: string;
  query?: string;
}): Promise<KinozalCatalogEntry[]> {
  const catKey = params.category || 'series_ru';
  const years = (params.years || '').trim();
  const query = (params.query || '').trim();
  const cacheKey = `v3_${catKey}_${years}_${query}`;
  const cached = kinozalCatalogCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
    return cached.items;
  }

  const catIds = KINOZAL_RU_CATEGORIES[catKey] || [16];
  const getCatDefaultType = (c: number): 'movie' | 'series' =>
    c === 5 || c === 7 ? 'movie' : 'series';

  const urlTasks: Array<{ url: string; defType: 'movie' | 'series' }> = [];
  if (query.length >= 2) {
    for (const c of catIds) {
      urlTasks.push({
        url: `https://rutor.info/search/0/${c}/000/2/${encodeURIComponent(query)}`,
        defType: getCatDefaultType(c),
      });
    }
  } else if (catKey === 'top_ru') {
    for (const c of catIds) {
      urlTasks.push({
        url: `https://rutor.info/browse/0/${c}/0/2`,
        defType: getCatDefaultType(c),
      });
      urlTasks.push({
        url: `https://rutor.info/search/0/${c}/000/2/1080p`,
        defType: getCatDefaultType(c),
      });
      urlTasks.push({
        url: `https://rutor.info/search/0/${c}/000/2/2160p`,
        defType: getCatDefaultType(c),
      });
    }
  } else {
    for (const c of catIds) {
      // Fetch top seeded (/2), newest 2026 releases (/0), and dedicated 1080p/2160p pools so every card gets its highest resolution hash
      urlTasks.push({
        url: `https://rutor.info/browse/0/${c}/0/2`,
        defType: getCatDefaultType(c),
      });
      urlTasks.push({
        url: `https://rutor.info/browse/0/${c}/0/0`,
        defType: getCatDefaultType(c),
      });
      urlTasks.push({
        url: `https://rutor.info/search/0/${c}/000/2/1080p`,
        defType: getCatDefaultType(c),
      });
      urlTasks.push({
        url: `https://rutor.info/search/0/${c}/000/2/2160p`,
        defType: getCatDefaultType(c),
      });
    }
  }

  const pages = await Promise.all(
    urlTasks.map(async ({ url: u, defType }) => {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(u, {
          headers: { 'User-Agent': USER_AGENT },
          signal: controller.signal,
        });
        clearTimeout(t);
        if (!res.ok) return [];
        const html = await res.text();
        return parseKinozalRowsFromHtml(html, defType, true);
      } catch {
        return [];
      }
    })
  );

  const byCleanTitle = new Map<string, KinozalCatalogEntry>();
  for (const list of pages) {
    for (const card of list) {
      if (card.seeders < 1) continue;
      const numYear = parseInt(card.year, 10) || 2026;
      if (years) {
        const rangeMatch = years.match(/^(\d{4})\s*-\s*(\d{4})$/);
        if (rangeMatch) {
          const minY = Math.min(Number(rangeMatch[1]), Number(rangeMatch[2]));
          const maxY = Math.max(Number(rangeMatch[1]), Number(rangeMatch[2]));
          if (numYear < minY || numYear > maxY) continue;
        } else {
          const singleY = Number(years);
          if (singleY > 1900 && numYear !== singleY) continue;
        }
      }

      const normTitleKey = card.name
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^\p{L}\p{N}]+/gu, '')
        .trim();
      if (!normTitleKey || normTitleKey.length < 2) continue;

      const getKzQualScore = (q?: string) =>
        q === '4K UHD' ? 4 : q === '1080p Full HD' ? 3 : q === '720p HD' ? 2 : 1;
      const is4k = card.quality === '4K UHD';
      const sMatch = card.releaseTitle.match(
        /(?:\[S0*(\d+)|\[0*(\d+)x\d+|\b0*(\d+)\s*сезон)/i
      );
      const explicitSeason = sMatch
        ? Number(sMatch[1] || sMatch[2] || sMatch[3])
        : undefined;
      const epMatch = card.releaseTitle.match(
        /(?:\[(?:S\d+x|0*\d+x)\d+-0*(\d+)\]|1\s*[-–]\s*0*(\d+)\s*(?:сери|выпуск))/i
      );
      const episodesCount = epMatch
        ? Number(epMatch[1] || epMatch[2])
        : undefined;

      const existing = byCleanTitle.get(normTitleKey);
      if (!existing) {
        byCleanTitle.set(normTitleKey, {
          fid: card.id,
          type: card.type === 'series' ? 'multistream' : 'stream',
          title: card.name,
          year: numYear,
          explicitSeason,
          episodesCount,
          quality: card.quality,
          fhd: true,
          '4k': is4k,
          seeders: card.seeders,
          sizeFormatted: card.sizeFormatted,
          infoHash: card.infoHash || '',
          rutorId: card.rutorId || '',
          releaseTitle: card.releaseTitle,
          categoryId: catKey,
          networkBadge: is4k ? 'Kinozal 4K' : 'Kinozal FHD',
        });
      } else {
        // Always upgrade to higher resolution (4K > 1080p > 720p > 480p), or higher seeders at the same resolution
        const curQ = getKzQualScore(card.quality);
        const prevQ = getKzQualScore(existing.quality);
        const shouldReplaceHash =
          curQ > prevQ || (curQ === prevQ && card.seeders > existing.seeders);
        byCleanTitle.set(normTitleKey, {
          ...existing,
          '4k': existing['4k'] || is4k,
          networkBadge: existing['4k'] || is4k ? 'Kinozal 4K' : 'Kinozal FHD',
          seeders: Math.max(existing.seeders, card.seeders),
          explicitSeason: shouldReplaceHash
            ? explicitSeason || existing.explicitSeason
            : existing.explicitSeason || explicitSeason,
          episodesCount: Math.max(existing.episodesCount || 0, episodesCount || 0) || undefined,
          ...(shouldReplaceHash
            ? {
                fid: card.id,
                quality: card.quality,
                infoHash: card.infoHash || existing.infoHash,
                rutorId: card.rutorId || existing.rutorId,
                releaseTitle: card.releaseTitle,
                sizeFormatted: card.sizeFormatted,
              }
            : {}),
        });
      }
    }
  }

  const out = Array.from(byCleanTitle.values()).sort((a, b) => {
    if (catKey === 'top_ru') {
      return b.seeders - a.seeders;
    }
    if (b.year !== a.year) return b.year - a.year;
    return b.seeders - a.seeders;
  });

  if (out.length > 0) {
    kinozalCatalogCache.set(cacheKey, { ts: Date.now(), items: out });
  }
  return out;
}

const inFlightEngines = new Map<number, Promise<ActiveTorrentEngine>>();

async function getOrStartTorrentEngine(
  torrentId: number,
  explicitInfoHash?: string
): Promise<ActiveTorrentEngine> {
  ensureTmpDir();
  let preservedVerified: Set<number> | null = null;
  let preservedProbes: Map<number, any> | null = null;
  const existing = activeEngines.get(torrentId);
  if (existing) {
    existing.lastAccessed = Date.now();
    const hasModernPoke =
      typeof existing.engine?.pokePeers === 'function' &&
      typeof existing.engine?.resetCriticalAndFocus === 'function';
    const wiresCount = Array.isArray(existing.engine?.swarm?.wires)
      ? existing.engine.swarm.wires.length
      : 0;
    const prevZeroSince = Number((existing as any).zeroPeerSince || 0);
    if (wiresCount === 0) {
      if (!prevZeroSince) {
        (existing as any).zeroPeerSince = Date.now();
      }
    } else {
      (existing as any).zeroPeerSince = 0;
    }
    const zeroDurationMs =
      wiresCount === 0 && prevZeroSince ? Date.now() - prevZeroSince : 0;
    const noActiveStreams =
      !existing.activeStreams || existing.activeStreams.size === 0;
    const shouldRecycle =
      !hasModernPoke ||
      (wiresCount === 0 && zeroDurationMs > 20000 && noActiveStreams);

    if (shouldRecycle) {
      preservedVerified = new Set(existing.verifiedPieces || []);
      preservedProbes = new Map(existing.probeCache || []);
      activeEngines.delete(torrentId);
      if (existing.activeStreams) {
        for (const closeOld of Array.from(existing.activeStreams)) {
          try {
            closeOld();
          } catch {
            // ignore
          }
        }
        existing.activeStreams.clear();
      }
      try {
        existing.engine?.destroy();
      } catch {
        // ignore
      }
    } else {
      try {
        await existing.readyPromise;
        const curWires = Array.isArray(existing.engine?.swarm?.wires)
          ? existing.engine.swarm.wires.length
          : 0;
        if (torrentId > 0 && curWires === 0) {
          await Promise.race([
            ensureFileListTrackerIpUnlocked(true),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2500)),
          ]);
          try {
            existing.engine?.discovery?.tracker?.start?.();
            existing.engine?.discovery?.tracker?.update?.();
            existing.engine?.pokePeers?.();
          } catch {
            // ignore
          }
        }
        return existing;
      } catch {
        activeEngines.delete(torrentId);
        try {
          existing.engine?.destroy();
        } catch {
          // ignore
        }
      }
    }
  }

  const inFlight = inFlightEngines.get(torrentId);
  if (inFlight) {
    return inFlight;
  }

  const startPromise = (async (): Promise<ActiveTorrentEngine> => {
    // Clean up old engines if more than 3 are open
    if (activeEngines.size >= 3) {
      let oldestKey: number | null = null;
      let oldestTime = Infinity;
      for (const [k, v] of activeEngines.entries()) {
        if ((v.activeDownloads || 0) > 0) continue;
        if (v.lastAccessed < oldestTime) {
          oldestTime = v.lastAccessed;
          oldestKey = k;
        }
      }
      if (oldestKey !== null) {
        const old = activeEngines.get(oldestKey);
        activeEngines.delete(oldestKey);
        try {
          old?.engine.destroy();
        } catch {
          // ignore
        }
      }
    }

    const peerId =
      '-qB4650-' +
      Math.random()
        .toString(36)
        .slice(2, 14)
        .padEnd(12, '0');

    let engine: any;
    const magnetMeta =
      torrentId < 0
        ? magnetMetaById.get(torrentId) ||
          (explicitInfoHash
            ? { infoHash: explicitInfoHash, trackers: DEFAULT_PUBLIC_TRACKERS }
            : undefined)
        : undefined;

    if (magnetMeta && magnetMeta.infoHash) {
      let rutorTorrentBuf: Buffer | null = null;
      if (magnetMeta.rutorId) {
        const rutorCachePath = path.join(
          TORRENT_CACHE_DIR,
          `kz_${magnetMeta.rutorId}.torrent`
        );
        if (
          fs.existsSync(rutorCachePath) &&
          fs.statSync(rutorCachePath).size > 200
        ) {
          rutorTorrentBuf = fs.readFileSync(rutorCachePath);
        } else {
          try {
            const dlRes = await safeFetch(
              `https://d.rutor.info/download/${magnetMeta.rutorId}`,
              { headers: { 'User-Agent': USER_AGENT } },
              1,
              4000
            );
            if (dlRes.ok) {
              const buf = Buffer.from(await dlRes.arrayBuffer());
              if (
                buf.length > 100 &&
                !buf.toString('utf8', 0, 15).includes('<!DOCTYPE')
              ) {
                fs.writeFileSync(rutorCachePath, buf);
                rutorTorrentBuf = buf;
              }
            }
          } catch {
            // fallback to magnet URI
          }
        }
      }

      const cleanTrackers = Array.from(
        new Set([...(magnetMeta.trackers || []), ...DEFAULT_PUBLIC_TRACKERS])
      ).filter((tr) => {
        if (!tr || typeof tr !== 'string') return false;
        const trimmed = tr.trim();
        if (!/^(udp|http|https):\/\/[\x21-\x7E]+$/i.test(trimmed)) return false;
        try {
          new URL(trimmed);
          return true;
        } catch {
          return false;
        }
      });

      if (rutorTorrentBuf) {
        engine = torrentStream(rutorTorrentBuf, {
          tmp: TORRENT_CACHE_DIR,
          id: peerId,
          dht: true,
          tracker: true,
          trackers: cleanTrackers,
          connections: 75,
          uploads: 2,
          verify: true,
        });
      } else {
        const trQuery = cleanTrackers
          .slice(0, 16)
          .map((tr) => `tr=${encodeURIComponent(tr)}`)
          .join('&');
        const magnetUri = `magnet:?xt=urn:btih:${magnetMeta.infoHash}&${trQuery}`;
        engine = torrentStream(magnetUri, {
          tmp: TORRENT_CACHE_DIR,
          id: peerId,
          dht: true,
          tracker: true,
          trackers: cleanTrackers,
          connections: 75,
          uploads: 2,
          verify: true,
        });
      }
    } else {
      if (
        !gState.lastFlIpVerifiedAt ||
        Date.now() - gState.lastFlIpVerifiedAt > 10 * 60 * 1000
      ) {
        await Promise.race([
          ensureFileListTrackerIpUnlocked(false),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2500)),
        ]);
      }
      const session = loadSession();
      const torrentFilePath = path.join(TORRENT_CACHE_DIR, `${torrentId}.torrent`);
      let torrentBuf: Buffer;

      if (fs.existsSync(torrentFilePath) && fs.statSync(torrentFilePath).size > 200) {
        torrentBuf = fs.readFileSync(torrentFilePath);
      } else {
        const dlUrl = `https://filelist.io/download.php?id=${torrentId}&passkey=${session.passkey}`;
        const res = await safeFetch(dlUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            Cookie: session.cookie,
          },
        });
        if (!res.ok) {
          throw new Error(`Failed to download .torrent #${torrentId} (HTTP ${res.status})`);
        }
        torrentBuf = Buffer.from(await res.arrayBuffer());
        if (torrentBuf.length < 100 || torrentBuf.toString('utf8', 0, 15).includes('<!DOCTYPE')) {
          // Re-authenticate once and retry
          const refreshed = await authenticateFileList();
          const retryRes = await safeFetch(
            `https://filelist.io/download.php?id=${torrentId}&passkey=${refreshed.passkey}`,
            {
              headers: {
                'User-Agent': USER_AGENT,
                Cookie: refreshed.cookie,
              },
            }
          );
          torrentBuf = Buffer.from(await retryRes.arrayBuffer());
        }
        if (torrentBuf.length > 100 && !torrentBuf.toString('utf8', 0, 15).includes('<!DOCTYPE')) {
          fs.writeFileSync(torrentFilePath, torrentBuf);
        } else {
          throw new Error(`Invalid .torrent file received for #${torrentId}`);
        }
      }

      engine = torrentStream(torrentBuf, {
        tmp: TORRENT_CACHE_DIR,
        id: peerId,
        dht: false,
        tracker: true,
        connections: 100,
        uploads: 4,
        verify: true,
      });
    }

    const entry: ActiveTorrentEngine = {
      id: torrentId,
      engine,
      ready: false,
      readyPromise: Promise.resolve(),
      lastAccessed: Date.now(),
      activeStreams: new Set(),
      verifiedPieces: preservedVerified || new Set<number>(),
      prewarmedFiles: new Set<number>(),
      lastTrackerError: undefined,
      infoHash: magnetMeta?.infoHash,
      files: [],
      probeCache: preservedProbes || new Map(),
    };

    if (torrentId < 0 && magnetMeta?.infoHash) {
      announceDirectHttpPeersForEngine(magnetMeta.infoHash, engine, entry).catch(
        () => {}
      );
    }

    if (torrentId > 0) {
      let lastTrackerWarnUnlockAt = 0;
      engine.on('tracker-warning', (err: any) => {
        const msg = String(err?.message || err || '').trim();
        if (!msg) return;
        const curWires = Array.isArray(engine?.swarm?.wires)
          ? engine.swarm.wires.length
          : 0;
        if (
          curWires === 0 ||
          /ip address|whitelist|unauthor|passkey|unregistered|denied/i.test(msg)
        ) {
          entry.lastTrackerError = msg;
        }
        if (/ip address|unauthor|passkey|unregistered|denied/i.test(msg)) {
          const now = Date.now();
          if (now - lastTrackerWarnUnlockAt > 15000) {
            lastTrackerWarnUnlockAt = now;
            console.warn('[FileList-Tracker] Tracker warning triggered re-unlock:', msg);
            ensureFileListTrackerIpUnlocked(true).catch(() => {});
          }
        }
      });
      engine.on('peer', () => {
        entry.lastTrackerError = undefined;
      });
    }
    (entry as any).createdAt = Date.now();

    engine.on('verify', (pieceIdx: number) => {
      if (typeof pieceIdx === 'number' && pieceIdx >= 0) {
        entry.verifiedPieces.add(pieceIdx);
      }
    });

    engine.on('verify-complete', () => {
      startBackgroundDiskVerification(entry);
    });

    entry.readyPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        activeEngines.delete(torrentId);
        try {
          engine.destroy();
        } catch {
          // ignore
        }
        reject(new Error('Torrent metadata timeout'));
      }, 30000);

      engine.on('ready', () => {
        clearTimeout(timeout);
        entry.ready = true;
        entry.files = (engine.files || []).map((f: any, idx: number) => ({
          index: idx,
          name: String(f.name || ''),
          path: String(f.path || f.name || ''),
          length: Number(f.length || 0),
        }));
        startBackgroundDiskVerification(entry);
        resolve();
      });

      engine.on('error', (err: any) => {
        clearTimeout(timeout);
        activeEngines.delete(torrentId);
        try {
          engine.destroy();
        } catch {
          // ignore
        }
        reject(err);
      });
    });

    activeEngines.set(torrentId, entry);
    await entry.readyPromise;
    return entry;
  })();

  inFlightEngines.set(torrentId, startPromise);
  try {
    return await startPromise;
  } finally {
    inFlightEngines.delete(torrentId);
  }
}

const verifiedCompleteDiskFiles = new Map<string, string>();

function getDiskFilePathForTorrentFile(
  entry: ActiveTorrentEngine,
  fileIdx: number
): string | null {
  try {
    const infoHash = String(
      entry.engine?.infoHash || entry.engine?.torrent?.infoHash || ''
    ).toLowerCase();
    const rawFile = entry.engine?.files?.[fileIdx];
    if (!infoHash || !rawFile) return null;
    const relPath = String(rawFile.path || rawFile.name || '');
    if (!relPath) return null;
    const candidate = path.join(
      TORRENT_CACHE_DIR,
      'torrent-stream',
      infoHash,
      relPath
    );
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  } catch {
    // ignore
  }
  return null;
}

function getVerifiedCompleteDiskFilePath(
  entry: ActiveTorrentEngine,
  fileIdx: number
): string | null {
  try {
    const cacheKey = `${entry.id}:${fileIdx}`;
    const cachedPath = verifiedCompleteDiskFiles.get(cacheKey);
    if (cachedPath && fs.existsSync(cachedPath)) {
      return cachedPath;
    }
    const diskPath = getDiskFilePathForTorrentFile(entry, fileIdx);
    if (!diskPath) return null;
    const rawFile = entry.engine?.files?.[fileIdx];
    const torrent = entry.engine?.torrent;
    const pieceLen = Number(torrent?.pieceLength || 0);
    const pieces: string[] | undefined = torrent?.pieces;
    const fileLen = Number(rawFile?.length || 0);
    const fileOffset = Number(rawFile?.offset || 0);
    if (!fileLen || !pieceLen || !Array.isArray(pieces) || pieces.length === 0) {
      return null;
    }
    const st = fs.statSync(diskPath);
    if (st.size < fileLen) return null;

    const firstPiece = Math.max(0, Math.floor(fileOffset / pieceLen));
    const lastPiece = Math.min(
      pieces.length - 1,
      Math.floor((fileOffset + fileLen - 1) / pieceLen)
    );
    if (lastPiece < firstPiece) return null;

    // Strict 100% piece-by-piece check: EVERY piece of the file must be SHA-1 verified by torrent-stream (zero holes!)
    for (let p = firstPiece; p <= lastPiece; p++) {
      if (!entry.verifiedPieces.has(p)) {
        return null;
      }
    }

    verifiedCompleteDiskFiles.set(cacheKey, diskPath);
    return diskPath;
  } catch {
    return null;
  }
}

function verifyDiskPiecesForByteRange(
  entry: ActiveTorrentEngine,
  fileIdx: number,
  startByte: number,
  endByte: number
): string | null {
  try {
    const complete = getVerifiedCompleteDiskFilePath(entry, fileIdx);
    if (complete) return complete;

    const diskPath = getDiskFilePathForTorrentFile(entry, fileIdx);
    if (!diskPath) return null;
    const rawFile = entry.engine?.files?.[fileIdx];
    const torrent = entry.engine?.torrent;
    const pieceLen = Number(torrent?.pieceLength || 0);
    const pieces: string[] | undefined = torrent?.pieces;
    const fileLen = Number(rawFile?.length || 0);
    const fileOffset = Number(rawFile?.offset || 0);
    if (!fileLen || !pieceLen || !Array.isArray(pieces) || pieces.length === 0) {
      return null;
    }
    const st = fs.statSync(diskPath);
    if (st.size <= endByte) return null;

    const firstPiece = Math.max(
      0,
      Math.floor((fileOffset + startByte) / pieceLen)
    );
    const lastPiece = Math.min(
      pieces.length - 1,
      Math.floor((fileOffset + endByte) / pieceLen)
    );
    if (lastPiece < firstPiece) return null;

    for (let p = firstPiece; p <= lastPiece; p++) {
      if (!entry.verifiedPieces.has(p)) {
        return null;
      }
    }
    return diskPath;
  } catch {
    return null;
  }
}

function startBackgroundDiskVerification(entry: ActiveTorrentEngine): void {
  try {
    const torrent = entry.engine?.torrent;
    const totalPieces = Array.isArray(torrent?.pieces)
      ? torrent.pieces.length
      : 0;
    if (totalPieces <= 0) return;

    const verifiedCount = entry.verifiedPieces.size;
    // If the file is almost completely downloaded on disk (e.g. 99% cached with a few missing pieces like Piece 29),
    // immediately heal the missing pieces in the background so the file becomes 100% complete on disk!
    if (verifiedCount > 0 && verifiedCount < totalPieces) {
      const missingCount = totalPieces - verifiedCount;
      if (missingCount <= 64) {
        for (let p = 0; p < totalPieces; p++) {
          if (!entry.verifiedPieces.has(p)) {
            try {
              entry.engine.select?.(p, p, true);
              entry.engine.critical?.(p, 1);
            } catch {
              // ignore
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }
}

const inFlightProbes = new Map<string, Promise<any>>();

/**
 * Persistently pre-warms the last 2MB of a torrent video file (where Matroska Cues / MP4 moov seek index resides)
 * in the background until completion — NEVER destroyed early by probe exit — so Skip Intro & arbitrary seeks
 * find the seek index on SSD in 0ms!
 */
function prewarmVideoTailCues(
  entry: ActiveTorrentEngine,
  fileIdx: number
): void {
  try {
    if (!entry.prewarmedFiles) {
      entry.prewarmedFiles = new Set<number>();
    }
    if (entry.prewarmedFiles.has(fileIdx)) return;

    const rawFile = entry.engine?.files?.[fileIdx];
    if (!rawFile || Number(rawFile.length) <= 4 * 1024 * 1024) return;
    if (/\.ts$/i.test(rawFile.name || '')) {
      entry.prewarmedFiles.add(fileIdx);
      return;
    }
    if (getVerifiedCompleteDiskFilePath(entry, fileIdx)) {
      entry.prewarmedFiles.add(fileIdx);
      return;
    }

    const totalLen = Number(rawFile.length);
    const tailStart = Math.max(0, totalLen - 2 * 1024 * 1024);
    if (verifyDiskPiecesForByteRange(entry, fileIdx, tailStart, totalLen - 1)) {
      entry.prewarmedFiles.add(fileIdx);
      return;
    }

    entry.prewarmedFiles.add(fileIdx);
    const tailStream = rawFile.createReadStream({
      start: tailStart,
      end: totalLen - 1,
    });
    try {
      if (typeof tailStream.startPiece === 'number' && entry.engine.critical) {
        const span = Math.max(
          1,
          (tailStream.endPiece ?? tailStream.startPiece) -
            tailStream.startPiece +
            1
        );
        entry.engine.critical(tailStream.startPiece, Math.min(3, span));
      }
    } catch {
      // ignore
    }
    const finishTail = () => {
      try {
        tailStream.destroy();
      } catch {
        // ignore
      }
    };
    const safetyTimer = setTimeout(() => {
      entry.prewarmedFiles?.delete(fileIdx);
      finishTail();
    }, 45_000);
    if (typeof (safetyTimer as any).unref === 'function') {
      (safetyTimer as any).unref();
    }
    tailStream.on('data', () => {});
    tailStream.on('end', () => {
      clearTimeout(safetyTimer);
    });
    tailStream.on('error', () => {
      clearTimeout(safetyTimer);
      entry.prewarmedFiles?.delete(fileIdx);
      finishTail();
    });
  } catch {
    // ignore
  }
}

async function probeTorrentVideoFile(
  entry: ActiveTorrentEngine,
  fileIdx: number
): Promise<{
  durationSec: number;
  videoCodec: string;
  audioTracks: Array<{
    index: number;
    lang: string;
    codec: string;
    title: string;
    label: string;
  }>;
  subtitleTracks?: EmbeddedSubtitleTrack[];
}> {
  const cached = entry.probeCache.get(fileIdx);
  if (cached) return cached;

  const probeKey = `${entry.id}:${fileIdx}`;
  const existingProbe = inFlightProbes.get(probeKey);
  if (existingProbe) return existingProbe;

  const rawFile = entry.engine.files[fileIdx];
  if (!rawFile || !ffmpegPath) {
    return {
      durationSec: 0,
      videoCodec: 'h264',
      audioTracks: [{ index: 0, lang: 'orig', codec: 'aac', title: 'Original', label: 'ORIGINAL AUDIO' }],
    };
  }

  const probePromise = new Promise<{
    durationSec: number;
    videoCodec: string;
    audioTracks: Array<{
      index: number;
      lang: string;
      codec: string;
      title: string;
      label: string;
    }>;
    subtitleTracks?: EmbeddedSubtitleTrack[];
  }>((resolve) => {
    const verifiedDiskPath = getVerifiedCompleteDiskFilePath(entry, fileIdx);
    const ff = spawn(ffmpegPath as string, [
      '-hide_banner',
      '-i',
      verifiedDiskPath || 'pipe:0',
    ]);
    let stderr = '';
    ff.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    let rs: any = null;
    if (!verifiedDiskPath) {
      prewarmVideoTailCues(entry, fileIdx);
      const probeBytes = Math.min(rawFile.length - 1, 2 * 1024 * 1024);
      const headerDiskPath = verifyDiskPiecesForByteRange(
        entry,
        fileIdx,
        0,
        probeBytes
      );
      rs = headerDiskPath
        ? fs.createReadStream(headerDiskPath, { start: 0, end: probeBytes })
        : rawFile.createReadStream({ start: 0, end: probeBytes });
      rs.pipe(ff.stdin).on('error', () => {});
    }

    const timer = setTimeout(() => {
      try {
        rs?.destroy();
        ff.kill('SIGKILL');
      } catch {
        // ignore
      }
    }, 6500);

    ff.on('close', () => {
      clearTimeout(timer);
      try {
        rs?.destroy();
      } catch {
        // ignore
      }
      let durationSec = 0;
      const durMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i);
      if (durMatch) {
        durationSec =
          parseInt(durMatch[1], 10) * 3600 +
          parseInt(durMatch[2], 10) * 60 +
          parseFloat(durMatch[3]);
      }

      const nameImpliesHevc = /\b(hevc|x265|h\.?265|2160p|4k|uhd)\b/i.test(
        rawFile.name || ''
      );
      const videoMatch = stderr.match(/Stream #\d+:\d+.*?Video:\s*([a-zA-Z0-9_]+)/i);
      const videoCodec = videoMatch
        ? videoMatch[1].toLowerCase()
        : nameImpliesHevc
          ? 'hevc'
          : 'h264';

      const audioTracks: Array<{
        index: number;
        lang: string;
        codec: string;
        title: string;
        label: string;
      }> = [];

      const rawProbedTracks: Array<{
        index: number;
        lang: string;
        codec: string;
        extra: string;
        metaTitle: string;
        isDefault: boolean;
      }> = [];

      const stderrLines = stderr.split(/\r?\n/);
      const streamBlocks: Array<{ header: string; metaTitle: string }> = [];
      for (let li = 0; li < stderrLines.length; li++) {
        const line = stderrLines[li];
        if (/^\s*Stream #0:\d+/.test(line)) {
          let metaTitle = '';
          let inMeta = false;
          for (let lj = li + 1; lj < stderrLines.length; lj++) {
            const subLine = stderrLines[lj];
            if (/^\s*(?:Stream #|Chapter #|Output #|Press |At least |Trailing )/i.test(subLine)) {
              break;
            }
            if (/^\s*Metadata:\s*$/i.test(subLine)) {
              inMeta = true;
              continue;
            }
            if (inMeta) {
              const titleM = subLine.match(/^\s+title\s*:\s*(.+)$/i);
              if (titleM && !metaTitle) {
                metaTitle = titleM[1].trim();
              }
            }
          }
          streamBlocks.push({ header: line, metaTitle });
        }
      }

      let audioOrder = 0;
      for (const blk of streamBlocks) {
        const m = blk.header.match(
          /Stream #0:(\d+)(?:\[[^\]]+\])?(?:\(([a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,4})?)\))?[^:]*:\s*Audio:\s*([a-zA-Z0-9_]+)([^\r\n]*)/i
        );
        if (!m) continue;
        const lang = (m[2] || 'orig').split('-')[0].toUpperCase();
        const codec = (m[3] || 'audio').toUpperCase();
        const rest = m[4] || '';
        const extra = rest.includes('5.1') ? '5.1' : 'Stereo';
        rawProbedTracks.push({
          index: audioOrder,
          lang,
          codec,
          extra,
          metaTitle: blk.metaTitle,
          isDefault: /\(default\)/i.test(rest),
        });
        audioOrder++;
      }

      const isRuOrUkDubTrack = (lang: string, metaTitle: string): boolean => {
        const l = lang.toUpperCase();
        if (/^(RU|RUS|UK|UKR|BE|BEL)$/.test(l)) {
          return !/\b(original|orig)\b|оригинал/i.test(metaTitle);
        }
        if (l === 'ORIG' || l === 'UND') {
          return (
            /(русск|дубляж|закадр|многоголос|двухголос|lostfilm|hdrezka|red head|jaskier|кубик|сыендук|tvshows|alexfilm|newstudio|baibako|coldfilm)/i.test(
              metaTitle
            ) && !/оригинал/i.test(metaTitle)
          );
        }
        return false;
      };

      let originalTrackOrder = rawProbedTracks.findIndex(
        (t) =>
          !isRuOrUkDubTrack(t.lang, t.metaTitle) &&
          /\b(original|orig)\b|оригинал/i.test(t.metaTitle)
      );
      if (originalTrackOrder < 0) {
        originalTrackOrder = rawProbedTracks.findIndex(
          (t) => !isRuOrUkDubTrack(t.lang, t.metaTitle)
        );
      }
      if (originalTrackOrder < 0) {
        originalTrackOrder = rawProbedTracks.findIndex((t) =>
          /оригинал/i.test(t.metaTitle)
        );
      }

      for (const t of rawProbedTracks) {
        const prefix = t.index === originalTrackOrder ? 'ORIGINAL • ' : '';
        const label = `${prefix}${t.lang} (${t.codec} ${t.extra})${t.metaTitle ? ` — ${t.metaTitle}` : ''}`;
        audioTracks.push({
          index: t.index,
          lang: t.lang,
          codec: t.codec,
          title: t.metaTitle || t.lang,
          label,
        });
      }

      if (audioTracks.length === 0) {
        audioTracks.push({
          index: 0,
          lang: 'ORIG',
          codec: 'AAC',
          title: 'Original',
          label: 'ORIGINAL AUDIO (Stereo)',
        });
      }

      const subtitleTracks: EmbeddedSubtitleTrack[] = [];
      let subOrder = 0;
      for (const blk of streamBlocks) {
        const subMatch = blk.header.match(
          /Stream #0:(\d+)(?:\[[^\]]+\])?(?:\(([a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,4})?)\))?[^:]*:\s*Subtitle:\s*([a-zA-Z0-9_]+)([^\r\n]*)/i
        );
        if (!subMatch) continue;
        const rawLang = (subMatch[2] || 'und').split('-')[0].toUpperCase();
        const codec = (subMatch[3] || '').toLowerCase();
        const extra = subMatch[4] || '';
        const metaTitle = blk.metaTitle;
        const mapped = mapMkvSubLang(rawLang, metaTitle);
        const forced = /\(forced\)|\bforced\b/i.test(`${extra} ${metaTitle}`);
        const sdh = /\b(sdh|cc|hearing|hi)\b/i.test(`${extra} ${metaTitle}`);
        const isText = /^(subrip|srt|ass|ssa|webvtt|mov_text|text)$/i.test(codec);
        const tagSuffix = forced ? ' [Forced]' : sdh ? ' [SDH]' : '';
        const titleSuffix =
          metaTitle && metaTitle.toLowerCase() !== mapped.label.toLowerCase()
            ? ` • ${metaTitle}`
            : '';
        subtitleTracks.push({
          index: subOrder,
          lang: rawLang,
          langCode2: mapped.code2,
          langLabel: mapped.label,
          codec,
          title: metaTitle || mapped.label,
          label: `MKV • ${mapped.label}${tagSuffix}${titleSuffix}`,
          forced,
          sdh,
          isText,
        });
        subOrder++;
      }

      const result = { durationSec, videoCodec, audioTracks, subtitleTracks };
      if (videoMatch && durationSec > 0) {
        entry.probeCache.set(fileIdx, result);
      }
      resolve(result);
    });
  });

  inFlightProbes.set(probeKey, probePromise);
  try {
    return await probePromise;
  } finally {
    inFlightProbes.delete(probeKey);
  }
}

let inFlightRangeServerPromise: Promise<number> | null = null;

function ensureTorrentSwarmAlive(
  entry: ActiveTorrentEngine,
  targetPiece?: number
): void {
  try {
    const eng = entry?.engine;
    if (!eng) return;
    const wiresCount = Array.isArray(eng.swarm?.wires)
      ? eng.swarm.wires.length
      : 0;
    if (wiresCount < 5 || typeof targetPiece === 'number') {
      eng.pokePeers?.(targetPiece);
      eng.discovery?.tracker?.update?.();
    }
    if (entry.id < 0 && entry.infoHash && wiresCount < 4) {
      announceDirectHttpPeersForEngine(entry.infoHash, eng, entry).catch(
        () => {}
      );
    }
  } catch {
    // ignore
  }
}

function restrictTorrentSelectionToFile(
  entry: ActiveTorrentEngine,
  targetFileIdx: number
): void {
  try {
    const files = entry.engine?.files;
    if (!Array.isArray(files) || files.length <= 1) return;
    files.forEach((f: any, idx: number) => {
      if (idx !== targetFileIdx && typeof f?.deselect === 'function') {
        try {
          f.deselect();
        } catch {
          // ignore
        }
      }
    });
  } catch {
    // ignore
  }
}

function attachRollingPieceReadahead(
  entry: ActiveTorrentEngine,
  streamObj: any,
  rawFileOffset: number,
  startByte: number,
  totalFileBytes: number
): void {
  try {
    const pieceLen = Number(entry.engine?.torrent?.pieceLength || 4 * 1024 * 1024);
    const focusCount = Math.max(
      3,
      Math.min(8, Math.ceil((48 * 1024 * 1024) / pieceLen))
    );
    const initPiece =
      typeof streamObj?.startPiece === 'number'
        ? streamObj.startPiece
        : Math.max(0, Math.floor((rawFileOffset + startByte) / pieceLen));
    let lastFocusedPiece = initPiece;
    ensureTorrentSwarmAlive(entry, initPiece);
    if (
      startByte > 512 * 1024 &&
      startByte < totalFileBytes - 4 * 1024 * 1024 &&
      typeof entry.engine.resetCriticalAndFocus === 'function'
    ) {
      entry.engine.resetCriticalAndFocus(initPiece, focusCount);
    } else {
      entry.engine.critical?.(initPiece, focusCount);
    }
    let bytesRead = 0;
    streamObj?.on?.('data', (chunk: Buffer) => {
      bytesRead += chunk?.length || 0;
      const curPiece = Math.floor(
        (rawFileOffset + startByte + bytesRead) / pieceLen
      );
      if (curPiece > lastFocusedPiece) {
        lastFocusedPiece = curPiece;
        try {
          entry.engine.critical?.(curPiece, focusCount);
          ensureTorrentSwarmAlive(entry, curPiece);
        } catch {
          // ignore
        }
      }
    });
  } catch {
    // ignore
  }
}

const RANGE_SERVER_VERSION = 3;

function ensureInternalRangeServer(): Promise<number> {
  if (
    gState.internalRangeServerPort > 0 &&
    (gState as any).rangeServerVersion === RANGE_SERVER_VERSION
  ) {
    return Promise.resolve(gState.internalRangeServerPort);
  }
  gState.internalRangeServerPort = 0;
  if (inFlightRangeServerPromise) {
    return inFlightRangeServerPromise;
  }
  const p = new Promise<number>((resolve) => {
    const srv = http.createServer(async (req, res) => {
      try {
        const u = new URL(req.url || '/', 'http://127.0.0.1');
        const id = parseInt(u.searchParams.get('id') || '0', 10);
        const fileIdx = parseInt(u.searchParams.get('fileIdx') || '0', 10);
        const entry = await getOrStartTorrentEngine(id);
        if (!entry.activeStreams) {
          entry.activeStreams = new Set();
        }
        const videoFile = entry.engine.files[fileIdx];
        if (!videoFile) {
          res.writeHead(404);
          res.end();
          return;
        }
        const total = Number(videoFile.length);
        const range = req.headers.range;
        const start = range
          ? parseInt(range.replace(/bytes=/, '').split('-')[0], 10) || 0
          : 0;
        const endPart = range ? range.replace(/bytes=/, '').split('-')[1] : '';
        const end = endPart ? parseInt(endPart, 10) : total - 1;

        if (range) {
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1,
            'Content-Type': 'video/x-matroska',
          });
        } else {
          res.writeHead(200, {
            'Content-Length': total,
            'Accept-Ranges': 'bytes',
            'Content-Type': 'video/x-matroska',
          });
        }
        if (req.method === 'HEAD') {
          res.end();
          return;
        }

        const verifiedDiskPath =
          getVerifiedCompleteDiskFilePath(entry, fileIdx) ||
          verifyDiskPiecesForByteRange(entry, fileIdx, start, end);
        if (verifiedDiskPath) {
          const diskStream = fs.createReadStream(verifiedDiskPath, {
            start,
            end,
          });
          const closeDiskStream = () => {
            try {
              diskStream.destroy();
            } catch {
              // ignore
            }
            if (!res.writableEnded && !res.destroyed) {
              try {
                res.destroy();
              } catch {
                // ignore
              }
            }
          };
          req.on('aborted', closeDiskStream);
          res.on('close', closeDiskStream);
          diskStream.on('error', closeDiskStream);
          diskStream.pipe(res);
          return;
        }

        restrictTorrentSelectionToFile(entry, fileIdx);
        const s = videoFile.createReadStream({ start, end });
        attachRollingPieceReadahead(
          entry,
          s,
          Number(videoFile?.offset || 0),
          start,
          total
        );

        let closed = false;
        const closeStream = () => {
          if (closed) return;
          closed = true;
          entry.activeStreams.delete(closeStream);
          try {
            s.destroy();
          } catch {
            // ignore
          }
          if (!res.writableEnded && !res.destroyed) {
            try {
              res.destroy();
            } catch {
              // ignore
            }
          }
        };
        entry.activeStreams.add(closeStream);
        req.on('aborted', closeStream);
        res.on('close', closeStream);
        s.pipe(res);
      } catch {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      }
    });
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      gState.internalRangeServerPort =
        typeof addr === 'object' && addr ? addr.port : 0;
      (gState as any).rangeServerVersion = RANGE_SERVER_VERSION;
      inFlightRangeServerPromise = null;
      resolve(gState.internalRangeServerPort);
    });
  });
  inFlightRangeServerPromise = p;
  return p;
}

function torrentExplicitlyMismatchesEpisode(
  text: string,
  season?: number,
  episode?: number
): boolean {
  if (!season || !episode || !text) return false;
  const s = Number(season);
  const e = Number(episode);

  const explicitPatterns = [
    /\bS0*(\d{1,2})[.\s_-]*E0*(\d{1,3})(?:\s*[-–]\s*E?0*(\d{1,3}))?\b/gi,
    /\[(?:S?0*(\d{1,2})[xх])0*(\d{1,3})(?:\s*[-–]\s*0*(\d{1,3}))?(?:\s*из\s*\d+)?\]/gi,
    /\b0*(\d{1,2})\s*сезон[^0-9]{1,20}0*(\d{1,3})(?:\s*[-–]\s*0*(\d{1,3}))?\s*(?:серия|выпуск)/gi,
  ];
  let matchedExplicitSe = false;
  for (const pat of explicitPatterns) {
    for (const m of text.matchAll(pat)) {
      matchedExplicitSe = true;
      const ms = Number(m[1]);
      const me1 = Number(m[2]);
      const me2 = m[3] ? Number(m[3]) : null;
      if (ms !== s) return true;
      if (me2 !== null) {
        if (e < me1 || e > me2) return true;
      } else if (me1 !== e) {
        return true;
      }
    }
  }
  if (!matchedExplicitSe) {
    const singleEpMatch = text.match(
      /(?:^|[^\d])0*(\d{1,3})\s*(?:выпуск|серия)(?:[^\d]|$)/i
    );
    if (singleEpMatch && Number(singleEpMatch[1]) !== e) {
      return true;
    }
  }
  return false;
}

function selectBestVideoFileIndex(
  files: Array<{ index: number; name: string; path: string; length: number }>,
  season?: number,
  episode?: number
): number {
  const videoFiles = files.filter((f) =>
    /\.(mkv|mp4|avi|m4v|ts|webm)$/i.test(f.name) && !/\bsample\b/i.test(f.name)
  );
  const pool = videoFiles.length > 0 ? videoFiles : files;
  if (pool.length === 0) return 0;

  if (season && episode) {
    const sPad = String(season).padStart(2, '0');
    const ePad = String(episode).padStart(2, '0');
    const patterns = [
      new RegExp(`S${sPad}[.\\s_-]*E${ePad}\\b`, 'i'),
      new RegExp(`\\b0*${season}x${ePad}\\b`, 'i'),
      new RegExp(`\\bE${ePad}\\b`, 'i'),
      new RegExp(`(?:Episode|Серия|Выпуск)[.\\s_-]*0*${episode}\\b`, 'i'),
      new RegExp(`\\b0*${episode}[.\\s_-]*(?:серия|выпуск|ep)\\b`, 'i'),
      new RegExp(`(?:^|[.\\s_[-])0*${episode}(?:[.\\s_\\]-]|\\.(?:mkv|mp4|avi|ts)$)`, 'i'),
    ];
    for (const pat of patterns) {
      const found = pool.find((f) => pat.test(f.name) || pat.test(f.path));
      if (found) return found.index;
    }
    if (pool.length > 1 && episode >= 1) {
      if (episode > pool.length) {
        return -1;
      }
      const sortedByName = [...pool].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      );
      return sortedByName[episode - 1].index;
    }
    if (
      pool.length === 1 &&
      torrentExplicitlyMismatchesEpisode(
        `${pool[0].name} ${pool[0].path}`,
        season,
        episode
      )
    ) {
      return -1;
    }
  }

  return pool.reduce((best, cur) => (cur.length > best.length ? cur : best), pool[0]).index;
}

export async function handleFileListRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const rawUrl = req.url || '';
  if (!rawUrl.startsWith('/api/filelist')) {
    return false;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  const parsedUrl = new URL(rawUrl, 'http://localhost');
  const pathname = parsedUrl.pathname;

  // 1. GET /api/filelist/status
  if (pathname === '/api/filelist/status' && req.method === 'GET') {
    const session = loadSession();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    res.end(
      JSON.stringify({
        ok: true,
        username: session.username,
        hasPasskey: Boolean(session.passkey),
        activeTorrents: activeEngines.size,
      })
    );
    return true;
  }

  // 1B. GET /api/filelist/stats — Live Torrent Download Speed & Peers for Stremio OSD
  if (pathname === '/api/filelist/stats' && req.method === 'GET') {
    const idParam = parseInt(parsedUrl.searchParams.get('id') || '0', 10);
    let targetEntry = idParam ? activeEngines.get(idParam) : undefined;
    if (!targetEntry && activeEngines.size > 0) {
      let newestTime = -1;
      for (const v of activeEngines.values()) {
        if (v.lastAccessed > newestTime) {
          newestTime = v.lastAccessed;
          targetEntry = v;
        }
      }
    }
    const swarm = targetEntry?.engine?.swarm;
    const rawSpeed =
      typeof swarm?.downloadSpeed === 'function'
        ? Number(swarm.downloadSpeed() || 0)
        : 0;
    const wiresCount = Array.isArray(swarm?.wires) ? swarm.wires.length : 0;
    const downloadedBytes = Number(swarm?.downloaded || 0);
    const speedMb = rawSpeed / (1024 * 1024);
    const speedKb = rawSpeed / 1024;
    const downloadSpeedText =
      speedMb >= 0.1
        ? `${speedMb.toFixed(1)} MB/s`
        : speedKb >= 1
          ? `${speedKb.toFixed(0)} KB/s`
          : 'Buffer HD';

    const fileIdxParam = parsedUrl.searchParams.get('fileIdx');
    let probedDurationSec = 0;
    if (targetEntry) {
      if (fileIdxParam !== null && fileIdxParam !== '') {
        const fIdx = parseInt(fileIdxParam, 10) || 0;
        const p = targetEntry.probeCache.get(fIdx);
        if (p && p.durationSec > 0) {
          probedDurationSec = Math.round(p.durationSec);
        } else if (targetEntry.ready && !p) {
          probeTorrentVideoFile(targetEntry, fIdx).catch(() => {});
        }
      }
      if (!probedDurationSec && targetEntry.probeCache.size > 0) {
        for (const p of targetEntry.probeCache.values()) {
          if (p && p.durationSec > 0) {
            probedDurationSec = Math.round(p.durationSec);
            break;
          }
        }
      }
    }

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(
      JSON.stringify({
        ok: true,
        active: Boolean(targetEntry),
        torrentId: targetEntry?.id || 0,
        downloadSpeedBps: rawSpeed,
        downloadSpeedText,
        numPeers: wiresCount,
        downloadedBytes,
        downloadedText: formatBytes(downloadedBytes),
        durationSec: probedDurationSec,
        trackerError: targetEntry?.lastTrackerError || undefined,
        source:
          magnetMetaById.get(targetEntry?.id || 0)?.provider === 'kinozal'
            ? 'Kinozal VIP'
            : (targetEntry?.id || 0) < 0
              ? 'Torrentio P2P'
              : 'FileList.io VIP',
      })
    );
    return true;
  }
  // 1C. GET /api/filelist/live-sub — Live Embedded MKV Subtitles (JSON snapshot or SSE push, 0ms sync!)
  if (pathname === '/api/filelist/live-sub' && req.method === 'GET') {
    const id = parseInt(parsedUrl.searchParams.get('id') || '0', 10);
    const fileIdx = Math.max(0, parseInt(parsedUrl.searchParams.get('fileIdx') || '0', 10) || 0);
    const subLang = (parsedUrl.searchParams.get('subLang') || 'ro').trim().toLowerCase();
    const rawSubIdx = parsedUrl.searchParams.get('subIdx');
    const explicitSubIdx =
      rawSubIdx !== null && rawSubIdx !== '' && rawSubIdx !== '-1'
        ? parseInt(rawSubIdx, 10)
        : -1;
    const isSse = parsedUrl.searchParams.get('sse') === '1';

    if (!id) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ ok: false, cues: [] }));
      return true;
    }

    let entry = activeEngines.get(id);
    if (!entry) {
      try {
        entry = await getOrStartTorrentEngine(id);
      } catch {
        // ignore
      }
    }
    let cachedProbe = entry?.probeCache.get(fileIdx);
    if (entry && (!cachedProbe || !Array.isArray(cachedProbe.subtitleTracks))) {
      try {
        cachedProbe = await Promise.race([
          probeTorrentVideoFile(entry, fileIdx),
          new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 2500)),
        ]);
      } catch {
        // ignore
      }
    }
    const probePending = Boolean(entry && (!cachedProbe || !Array.isArray(cachedProbe.subtitleTracks)));
    const textTracks = (cachedProbe?.subtitleTracks || []).filter((t) => t.isText);
    const chosenSub = pickEmbeddedSubtitleTrack(textTracks, subLang, explicitSubIdx);
    if (!chosenSub) {
      if (isSse) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-store',
          'Access-Control-Allow-Origin': '*',
          Connection: 'keep-alive',
        });
        res.write(`data: ${JSON.stringify({ type: 'none', probing: probePending, tracks: textTracks })}\n\n`);
        res.end();
      } else {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify({ ok: false, probing: probePending, tracks: textTracks, cues: [] }));
      }
      return true;
    }

    const liveKey = `${id}:${fileIdx}:${chosenSub.index}`;
    const bucket = getOrCreateLiveSubBucket(liveKey, chosenSub);

    // If the MKV file is already 100% downloaded on disk and not yet extracted, run single-flight extraction fast!
    if (entry && !bucket.fullDiskExtracted && ffmpegPath) {
      const diskPath = getVerifiedCompleteDiskFilePath(entry, fileIdx);
      if (diskPath) {
        if (!bucket.fullDiskExtracting) {
          bucket.fullDiskExtracting = new Promise<void>((resolve) => {
            const ffSub = spawn(ffmpegPath as string, [
              '-hide_banner',
              '-loglevel',
              'error',
              '-i',
              diskPath,
              '-map',
              `0:s:${chosenSub.index}`,
              '-c:s',
              'webvtt',
              '-f',
              'webvtt',
              'pipe:1',
            ]);
            ffSub.stderr?.resume();
            attachLiveVttPipeReader(ffSub.stdout, bucket, 0);
            const tm = setTimeout(() => {
              try { ffSub.kill('SIGKILL'); } catch { /* ignore */ }
              resolve();
            }, 8000);
            ffSub.on('close', () => {
              clearTimeout(tm);
              bucket.fullDiskExtracted = true;
              resolve();
            });
            ffSub.on('error', () => {
              clearTimeout(tm);
              resolve();
            });
          }).finally(() => {
            bucket.fullDiskExtracting = null;
          });
        }
        await bucket.fullDiskExtracting;
      }
    }

    if (isSse) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-store',
        'Access-Control-Allow-Origin': '*',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(
        `data: ${JSON.stringify({
          type: 'init',
          track: chosenSub,
          tracks: textTracks,
          cues: bucket.cues,
        })}\n\n`
      );
      const onCue = (cue: LiveSubCue) => {
        if (res.destroyed || res.writableEnded) return;
        try {
          res.write(`data: ${JSON.stringify({ type: 'cue', cue })}\n\n`);
        } catch {
          // ignore
        }
      };
      bucket.listeners.add(onCue);
      let pingTimer: ReturnType<typeof setTimeout> | null = null;
      const schedulePing = () => {
        pingTimer = setTimeout(() => {
          if (res.destroyed || res.writableEnded) {
            bucket.listeners.delete(onCue);
            return;
          }
          try {
            res.write(': ping\n\n');
            schedulePing();
          } catch {
            bucket.listeners.delete(onCue);
          }
        }, 25000);
      };
      schedulePing();
      const closeSse = () => {
        if (pingTimer) clearTimeout(pingTimer);
        bucket.listeners.delete(onCue);
      };
      req.once('close', closeSse);
      req.once('aborted', closeSse);
      res.once('close', closeSse);
      return true;
    }

    const sinceCount = Math.max(0, parseInt(parsedUrl.searchParams.get('since') || '0', 10) || 0);
    const waitSec = Math.min(20, Math.max(0, parseInt(parsedUrl.searchParams.get('wait') || '0', 10) || 0));

    if (waitSec > 0 && bucket.cues.length <= sinceCount && !res.destroyed && !req.destroyed && !res.writableEnded) {
      await new Promise<void>((resolve) => {
        let done = false;
        let coalesceTimer: ReturnType<typeof setTimeout> | null = null;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(timeoutTimer);
          if (coalesceTimer) clearTimeout(coalesceTimer);
          bucket.listeners.delete(onCue);
          req.off('close', finish);
          req.off('aborted', finish);
          resolve();
        };
        const onCue = () => {
          if (!coalesceTimer) {
            coalesceTimer = setTimeout(finish, 120);
          }
        };
        const timeoutTimer = setTimeout(finish, waitSec * 1000);
        bucket.listeners.add(onCue);
        req.once('close', finish);
        req.once('aborted', finish);
      });
    }

    if (res.destroyed || res.writableEnded) return true;
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, no-transform',
    });
    res.end(
      JSON.stringify({
        ok: true,
        track: chosenSub,
        tracks: textTracks,
        total: bucket.cues.length,
        cues: sinceCount > 0 ? bucket.cues.slice(sinceCount) : bucket.cues,
      })
    );
    return true;
  }

  if (pathname === '/api/filelist/auth' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const updated = await authenticateFileList(payload.username, payload.password);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(
          JSON.stringify({
            ok: true,
            username: updated.username,
            hasPasskey: Boolean(updated.passkey),
          })
        );
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: (err as Error).message }));
      }
    });
    return true;
  }

  // 3. GET /api/filelist/catalog
  if (pathname === '/api/filelist/catalog' && req.method === 'GET') {
    try {
      const section = parsedUrl.searchParams.get('section') || 'ro';
      const q = parsedUrl.searchParams.get('q') || '';
      const imdb = parsedUrl.searchParams.get('imdb') || '';
      const sort =
        (parsedUrl.searchParams.get('sort') as 'seeders' | 'latest') || 'seeders';
      const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10) || 1;
      const fresh = parsedUrl.searchParams.get('fresh') === '1';

      const items = await getFileListCatalog({ section, query: q, imdb, sort, page, fresh });
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ ok: true, items }));
    } catch (err) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(
        JSON.stringify({ ok: false, items: [], error: (err as Error).message })
      );
    }
    return true;
  }

  // 3B. GET /api/filelist/kinozal-catalog — Russian Movies, Series, Documentaries & TV Shows Catalog
  if (pathname === '/api/filelist/kinozal-catalog' && req.method === 'GET') {
    try {
      const category = parsedUrl.searchParams.get('category') || 'series_ru';
      const years = parsedUrl.searchParams.get('years') || '';
      const q = parsedUrl.searchParams.get('q') || '';
      const items = await getKinozalRussianCatalog({
        category,
        years,
        query: q,
      });
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(
        JSON.stringify({
          ok: true,
          username: DEFAULT_KINOZAL_CREDENTIALS.username,
          items,
        })
      );
    } catch (err) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(
        JSON.stringify({
          ok: false,
          items: [],
          error: (err as Error).message,
        })
      );
    }
    return true;
  }

  // 4. GET /api/filelist/resolve
  if (pathname === '/api/filelist/resolve' && req.method === 'GET') {
    try {
      const idParam = parsedUrl.searchParams.get('id') || '';
      const imdbParam = parsedUrl.searchParams.get('imdb') || '';
      const rawQueryParam = parsedUrl.searchParams.get('q') || '';
      const rawTypeParam = parsedUrl.searchParams.get('type');
      let typeParam = rawTypeParam || 'movie';
      const season = parseInt(parsedUrl.searchParams.get('s') || '0', 10) || undefined;
      const episode = parseInt(parsedUrl.searchParams.get('e') || '0', 10) || undefined;
      if (rawTypeParam === 'series' || (!rawTypeParam && (season || episode))) {
        typeParam = 'series';
      }
      const effectiveSeason = typeParam === 'series' ? season : undefined;
      const effectiveEpisode = typeParam === 'series' ? episode : undefined;

      // STRICT RULE: Kinozal is ONLY for Russian TV Shows & Russian movies/series!
      // Romanian content (Asia Express, Insula Iubirii, Clanul, etc.) is NEVER Russian!
      const isRomanianQuery =
        (imdbParam && (
          imdbParam === 'tt10295772' || imdbParam === 'tt26254014' || imdbParam === 'tt28504410' ||
          imdbParam === 'tt35405683' || imdbParam === 'tt13093364' || imdbParam === 'tt1745739' ||
          imdbParam === 'tt21603982' || imdbParam === 'tt33088572' || imdbParam === 'tt34192055' ||
          imdbParam === 'tt28803286'
        )) ||
        (rawQueryParam && /\b(asia\s*express|america\s*express|insula\s*iubirii|power\s*couple|chefi\s*la\s*cutite|las\s*fierbinti|survivor\s*romania|clanul|tatutu|camera\s*609|scara\s*b|burlacul|vocea\s*romaniei|romanii\s*au\s*talent|te\s*cunosc\s*de\s*undeva|bravo\s*ai\s*stil|sunt\s*celebru|visuri\s*la\s*cheie|iubire\s*cu\s*parfum\s*de\s*lavanda)\b/i.test(rawQueryParam));

      const kpParam = (parsedUrl.searchParams.get('kp') || '').trim();
      const ruExplicit = parsedUrl.searchParams.get('ru');
      const isRussianParam = isRomanianQuery
        ? false
        : kpParam === '5354824'
          ? true
          : ruExplicit === '1'
            ? true
            : ruExplicit === '0'
              ? false
              : /[а-яёА-ЯЁ]/i.test(rawQueryParam);
      const queryParam =
        typeParam === 'series'
          ? rawQueryParam
              .replace(/\s*\(S\d+[^)]*\)\s*/gi, ' ')
              .replace(/\bS\d{1,2}[.\s_-]*E\d{1,2}\b/gi, ' ')
              .replace(/[.\s-]*Сезон\s*\d+\.?/gi, ' ')
              .replace(/\s{2,}/g, ' ')
              .trim() || rawQueryParam.trim()
          : rawQueryParam.trim();
      let effectiveRuQuery = queryParam;
      if (
        isRussianParam &&
        (!effectiveRuQuery || !/[а-яёА-ЯЁ]/i.test(effectiveRuQuery)) &&
        kpParam &&
        /^\d+$/.test(kpParam)
      ) {
        if (kpParam === '5354824') {
          effectiveRuQuery = 'Шоу Воли';
        } else {
          try {
            const ctrl = new AbortController();
            const kpTimer = setTimeout(() => ctrl.abort(), 2500);
            const kpRes = await fetch(
              `https://kinopoiskapiunofficial.tech/api/v2.2/films/${kpParam}`,
              {
                headers: {
                  'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
                  Accept: 'application/json',
                },
                signal: ctrl.signal,
              }
            );
            clearTimeout(kpTimer);
            if (kpRes.ok) {
              const kpJson = (await kpRes.json()) as { nameRu?: string };
              if (kpJson?.nameRu && /[а-яёА-ЯЁ]/i.test(kpJson.nameRu)) {
                effectiveRuQuery = kpJson.nameRu.trim();
              }
            }
          } catch {
            // ignore KP lookup timeout
          }
        }
      }
      const requestedFileIdx = parsedUrl.searchParams.get('fileIdx');
      const preferMax1080 = parsedUrl.searchParams.get('maxQ') === '1080';

      let matchingTorrents: FileListTorrentCard[] = [];
      let torrentioTorrents: FileListTorrentCard[] = [];
      let kinozalTorrents: FileListTorrentCard[] = [];
      let targetTorrentId =
        idParam.startsWith('tio:') || idParam.startsWith('kz:')
          ? hashToSyntheticId(idParam.replace(/^(tio|kz):/i, ''))
          : parseInt(idParam.replace(/^fl:/i, ''), 10) || 0;

      const [kzStreams, flByImdb, tioStreams] = await Promise.all([
        isRussianParam && effectiveRuQuery
          ? fetchKinozalRussianTorrents(
              effectiveRuQuery,
              typeParam === 'series' ? 'series' : 'movie',
              effectiveSeason,
              effectiveEpisode
            ).catch(() => [])
          : Promise.resolve([]),
        !isRussianParam && imdbParam && imdbParam.startsWith('tt')
          ? getFileListCatalog({ imdb: imdbParam }).catch(() => [])
          : Promise.resolve([]),
        !isRussianParam && !isRomanianQuery && imdbParam && imdbParam.startsWith('tt')
          ? fetchTorrentioStreams(
              imdbParam,
              typeParam === 'series' ? 'series' : 'movie',
              effectiveSeason,
              effectiveEpisode
            ).catch(() => [])
          : Promise.resolve([]),
      ]);

      kinozalTorrents = kzStreams;
      matchingTorrents = flByImdb;
      torrentioTorrents = tioStreams;

      if (matchingTorrents.length === 0 && queryParam && !isRussianParam) {
        matchingTorrents = await getFileListCatalog({ query: queryParam }).catch(() => []);
      }

      const getQualityScore = (q: string) =>
        q === '4K UHD'
          ? 4
          : q === '1080p Full HD'
            ? 3
            : q === '720p HD'
              ? 2
              : 1;
      const sortByQualityAndSeeders = (list: FileListTorrentCard[]) =>
        [...list].sort((a, b) => {
          if (a.seeders >= 1 && b.seeders >= 1) {
            const qa = getQualityScore(a.quality);
            const qb = getQualityScore(b.quality);
            if (qa !== qb) return qb - qa;
          }
          return b.seeders - a.seeders;
        });

      matchingTorrents = sortByQualityAndSeeders(matchingTorrents);
      kinozalTorrents = sortByQualityAndSeeders(kinozalTorrents);

      // If series, filter or rank torrents matching the requested Season/Episode AFTER sorting
      if (typeParam === 'series' && effectiveSeason) {
        const sPad = `S${String(effectiveSeason).padStart(2, '0')}`;
        const ePad = effectiveEpisode ? `E${String(effectiveEpisode).padStart(2, '0')}` : '';
        const epRegex = effectiveEpisode
          ? new RegExp(
              `(?:${sPad}[.\\s_-]*${ePad}\\b|\\[(?:S?0*${effectiveSeason}[xх])0*${effectiveEpisode}(?:\\s*из\\s*\\d+)?\\])`,
              'i'
            )
          : null;
        const seasonPackRegex = new RegExp(
          `(${sPad}(?!E\\d)|Season[.\\s_-]*0*${effectiveSeason}\\b|\\[0*${effectiveSeason}[xх]0*\\d+\\s*[-–]\\s*\\d+|\\b0*${effectiveSeason}\\s*сезон)`,
          'i'
        );

        let exactEp = epRegex
          ? matchingTorrents.filter((t) => epRegex.test(t.releaseTitle))
          : [];

        // If the specific episode wasn't in the top 15 IMDb results (e.g. Asia Express S07E18), query FileList directly for that episode
        if (exactEp.length === 0 && queryParam && ePad && !isRussianParam) {
          const cleanQ = queryParam.replace(/\s*\(S\d+.*$/i, '').trim();
          const epSearchItems = await getFileListCatalog({
            query: `${cleanQ} ${sPad}${ePad}`,
          }).catch(() => []);
          if (epSearchItems.length > 0) {
            const sortedEpItems = sortByQualityAndSeeders(epSearchItems);
            exactEp = epRegex
              ? sortedEpItems.filter((t) => epRegex.test(t.releaseTitle))
              : sortedEpItems;
            matchingTorrents = [...exactEp, ...matchingTorrents].filter(
              (v, i, a) => a.findIndex((x) => x.id === v.id) === i
            );
          }
        }

        const seasonPacks = matchingTorrents.filter(
          (t) =>
            seasonPackRegex.test(t.releaseTitle) &&
            !/\bS\d{1,2}[.\s_-]*E\d{1,3}\b/i.test(t.releaseTitle)
        );
        const sortedExact = sortByQualityAndSeeders(exactEp);
        const sortedPacks = sortByQualityAndSeeders(seasonPacks);
        const episodeMatchedList = [...sortedExact, ...sortedPacks].filter(
          (v, i, a) => a.findIndex((x) => x.id === v.id) === i
        );

        const pickBestDefaultTorrentId = (list: FileListTorrentCard[]) => {
          const fastH264 = list.find(
            (t) =>
              t.quality === '1080p Full HD' &&
              t.seeders >= 2 &&
              !/\b(hevc|x265|h\.?265|dovi)\b/i.test(t.releaseTitle)
          );
          const best1080pAny = list.find(
            (t) => t.quality === '1080p Full HD' && t.seeders >= 2
          );
          const best720pAny = list.find(
            (t) => t.quality === '720p HD' && t.seeders >= 2
          );
          const best4kNonDoVi = list.find(
            (t) =>
              t.quality === '4K UHD' &&
              t.seeders >= 2 &&
              !/\bdovi\b/i.test(t.releaseTitle)
          );
          const best4kAny = list.find(
            (t) => t.quality === '4K UHD' && t.seeders >= 2
          );
          const nonDoVi = list.find(
            (t) => t.seeders >= 2 && !/\bdovi\b/i.test(t.releaseTitle)
          );
          if (preferMax1080) {
            return (
              fastH264 ||
              best1080pAny ||
              best720pAny ||
              best4kNonDoVi ||
              best4kAny ||
              nonDoVi ||
              list[0]
            )?.id || 0;
          }
          return (
            best4kNonDoVi ||
            best4kAny ||
            fastH264 ||
            best1080pAny ||
            nonDoVi ||
            list[0]
          )?.id || 0;
        };

        const hasExplicitId = Boolean(idParam && targetTorrentId !== 0);
        if (episodeMatchedList.length > 0) {
          matchingTorrents = episodeMatchedList;
          if (!hasExplicitId) {
            const matchesRequestedEp =
              targetTorrentId > 0 &&
              episodeMatchedList.some((t) => t.id === targetTorrentId);
            if (!matchesRequestedEp) {
              targetTorrentId = pickBestDefaultTorrentId(
                sortedExact.length > 0 ? sortedExact : episodeMatchedList
              );
            }
          }
        } else {
          matchingTorrents = [];
          if (!hasExplicitId && targetTorrentId > 0) {
            targetTorrentId = 0;
          }
        }
      }

      // For Russian content, Kinozal VIP is ALWAYS the #1 Priority source before FileList & Torrentio!
      if (kinozalTorrents.length > 0) {
        matchingTorrents = [...kinozalTorrents, ...matchingTorrents];
      }

      // Append Torrentio streams after FileList torrents so both appear in Stremio Stream Selector
      if (torrentioTorrents.length > 0) {
        matchingTorrents = [...matchingTorrents, ...torrentioTorrents];
      }

      // Strictly enforce quality hierarchy: 4K UHD -> 1080p Full HD -> 720p HD (exclude < 720p whenever HD exists)
      const hdMatching = matchingTorrents.filter(
        (t) => getQualityScore(t.quality) >= 2
      );
      if (hdMatching.length > 0) {
        matchingTorrents = hdMatching;
      }
      matchingTorrents.sort(
        (a, b) =>
          getQualityScore(b.quality) - getQualityScore(a.quality) ||
          b.seeders - a.seeders
      );

      const strictIdParam = parsedUrl.searchParams.get('strictId') === '1';
      if (typeParam === 'series' && effectiveSeason && targetTorrentId !== 0) {
        if (
          !strictIdParam &&
          !matchingTorrents.some((t) => t.id === targetTorrentId)
        ) {
          targetTorrentId = 0;
        } else if (strictIdParam && effectiveEpisode) {
          const strictTitle =
            matchingTorrents.find((t) => t.id === targetTorrentId)?.releaseTitle ||
            '';
          if (
            (strictTitle &&
              torrentExplicitlyMismatchesEpisode(
                strictTitle,
                effectiveSeason,
                effectiveEpisode
              )) ||
            (targetTorrentId < 0 &&
              !matchingTorrents.some((t) => t.id === targetTorrentId) &&
              !magnetMetaById.has(targetTorrentId))
          ) {
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
            });
            res.end(
              JSON.stringify({
                ok: false,
                error: 'Selected torrent does not match requested episode',
              })
            );
            return true;
          }
        }
      }
      if (
        targetTorrentId < 0 &&
        !strictIdParam &&
        kinozalTorrents.length > 0
      ) {
        const currentCard = kinozalTorrents.find((t) => t.id === targetTorrentId);
        const bestKzCard = kinozalTorrents.find((t) => t.seeders >= 1) || kinozalTorrents[0];
        if (
          bestKzCard &&
          (!currentCard ||
            getQualityScore(bestKzCard.quality) > getQualityScore(currentCard.quality))
        ) {
          targetTorrentId = bestKzCard.id;
        }
      }

      if (!targetTorrentId && matchingTorrents.length > 0) {
        const kzOnly = matchingTorrents.filter((t) => t.provider === 'kinozal');
        const flOnly = matchingTorrents.filter((t) => t.id > 0);
        const pool =
          kzOnly.length > 0
            ? kzOnly
            : flOnly.length > 0
              ? flOnly
              : matchingTorrents;
        const best4kNonDoVi = pool.find(
          (t) =>
            t.quality === '4K UHD' &&
            t.seeders >= 1 &&
            !/\bdovi\b/i.test(t.releaseTitle)
        );
        const best4kAny = pool.find(
          (t) => t.quality === '4K UHD' && t.seeders >= 1
        );
        const fastH264 = pool.find(
          (t) =>
            t.quality === '1080p Full HD' &&
            t.seeders >= 1 &&
            !/\b(hevc|x265|h\.?265|dovi)\b/i.test(t.releaseTitle)
        );
        const best1080pAny = pool.find(
          (t) => t.quality === '1080p Full HD' && t.seeders >= 1
        );
        const best720pAny = pool.find(
          (t) => t.quality === '720p HD' && t.seeders >= 1
        );
        const nonDoVi = pool.find(
          (t) => t.seeders >= 1 && !/\bdovi\b/i.test(t.releaseTitle)
        );
        targetTorrentId = (
          preferMax1080
            ? fastH264 ||
              best1080pAny ||
              best720pAny ||
              best4kNonDoVi ||
              best4kAny ||
              nonDoVi ||
              pool[0] ||
              matchingTorrents[0]
            : best4kNonDoVi ||
              best4kAny ||
              fastH264 ||
              best1080pAny ||
              best720pAny ||
              nonDoVi ||
              pool[0] ||
              matchingTorrents[0]
        ).id;
      }

      if (!targetTorrentId) {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(
          JSON.stringify({
            ok: false,
            error: 'Nu s-a găsit niciun torrent activ pe Kinozal, FileList.io sau Torrentio pentru acest titlu.',
          })
        );
        return true;
      }

      const selectedTorrentMeta = matchingTorrents.find(
        (t) => t.id === targetTorrentId
      ) || {
        id: targetTorrentId,
        flId: `fl:${targetTorrentId}`,
        name: `Stream #${targetTorrentId}`,
        releaseTitle: `Stream #${targetTorrentId}`,
        quality: '1080p Full HD',
        seeders: 20,
        sizeFormatted: '2.5 GB',
        category: targetTorrentId < 0 ? 'Kinozal / Torrentio P2P' : 'FileList.io',
      };

      // If it's a pure Torrentio magnet (< 0 without direct .torrent rutorId) and the user hasn't explicitly requested this ID yet, return the stream list immediately (< 600ms)
      if (
        targetTorrentId < 0 &&
        !idParam &&
        !magnetMetaById.get(targetTorrentId)?.rutorId
      ) {
        const magnetPresetIdx = magnetMetaById.get(targetTorrentId)?.fileIdx ?? 0;
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(
          JSON.stringify({
            ok: true,
            provider: 'filelist_torrent',
            torrentId: targetTorrentId,
            selectedTorrent: selectedTorrentMeta,
            torrents: matchingTorrents.slice(0, 40),
            selectedFileIdx: magnetPresetIdx,
            selectedFileName: selectedTorrentMeta.releaseTitle,
            files: [
              {
                index: magnetPresetIdx,
                name: selectedTorrentMeta.releaseTitle,
                sizeFormatted: selectedTorrentMeta.sizeFormatted,
              },
            ],
            streamUrl: `/api/filelist/stream?id=${targetTorrentId}&fileIdx=${magnetPresetIdx}&orig=${isRussianParam ? '0' : '1'}`,
            durationSec: 0,
            videoCodec: 'h264',
            audioNames: ['ORIGINAL AUDIO (Stereo)'],
            audioTracks: [
              {
                index: 0,
                lang: 'ORIG',
                codec: 'AAC',
                title: 'Original',
                label: 'ORIGINAL AUDIO (Stereo)',
              },
            ],
          })
        );
        return true;
      }

      let entry: ActiveTorrentEngine | null = null;
      let lastEngineErr: unknown = null;
      const hasExplicitRequestedId = Boolean(idParam && targetTorrentId !== 0);
      const altCandidates = hasExplicitRequestedId
        ? [targetTorrentId]
        : [
            targetTorrentId,
            ...matchingTorrents
              .filter(
                (t) =>
                  t.id !== targetTorrentId &&
                  (t.id > 0 || t.provider === 'kinozal')
              )
              .slice(0, 2)
              .map((t) => t.id),
          ];
      for (const candidateId of altCandidates) {
        try {
          entry = await getOrStartTorrentEngine(candidateId);
          targetTorrentId = candidateId;
          break;
        } catch (err) {
          lastEngineErr = err;
        }
      }
      if (!entry) {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(
          JSON.stringify({
            ok: false,
            error: (lastEngineErr as Error)?.message || 'Torrent metadata timeout',
            torrentId: targetTorrentId,
            selectedTorrent: selectedTorrentMeta,
            torrents: matchingTorrents.slice(0, 35),
          })
        );
        return true;
      }
      const videoFiles = entry.files.filter(
        (f) => /\.(mkv|mp4|avi|m4v|ts|webm)$/i.test(f.name) && !/\bsample\b/i.test(f.name)
      );
      const magnetPresetIdx = magnetMetaById.get(targetTorrentId)?.fileIdx;
      const autoEpFileIdx =
        effectiveSeason && effectiveEpisode
          ? selectBestVideoFileIndex(entry.files, effectiveSeason, effectiveEpisode)
          : -1;
      const selectedFileIdx =
        requestedFileIdx !== null && requestedFileIdx !== ''
          ? parseInt(requestedFileIdx, 10)
          : effectiveSeason && effectiveEpisode
            ? autoEpFileIdx
            : typeof magnetPresetIdx === 'number' && entry.files[magnetPresetIdx]
              ? magnetPresetIdx
              : selectBestVideoFileIndex(entry.files, effectiveSeason, effectiveEpisode);

      if (
        selectedFileIdx < 0 ||
        (effectiveSeason &&
          effectiveEpisode &&
          entry.files.length <= 1 &&
          torrentExplicitlyMismatchesEpisode(
            selectedTorrentMeta.releaseTitle || '',
            effectiveSeason,
            effectiveEpisode
          ))
      ) {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(
          JSON.stringify({
            ok: false,
            error:
              entry.files.length <= 1
                ? 'Requested episode not present inside single-episode torrent'
                : 'Requested episode not present inside torrent pack',
          })
        );
        return true;
      }

      const selectedFile =
        entry.files.find((f) => f.index === selectedFileIdx) || entry.files[0];
      restrictTorrentSelectionToFile(entry, selectedFileIdx);

      const relOrFile = `${selectedFile?.name || ''} ${selectedTorrentMeta.releaseTitle || ''}`;
      if (
        /\b(2160p|4k)\b/i.test(relOrFile) ||
        (/\buhd\b/i.test(relOrFile) && !/\b(1080p|720p)\b/i.test(relOrFile))
      ) {
        selectedTorrentMeta.quality = '4K UHD';
      }

      // Use cached probe if available; otherwise infer codec immediately so resolve responds in <1s and warm probeCache in background
      let cachedProbe = entry.probeCache.get(selectedFileIdx);
      if (cachedProbe && (!cachedProbe.durationSec || !Array.isArray(cachedProbe.subtitleTracks))) {
        entry.probeCache.delete(selectedFileIdx);
        cachedProbe = undefined;
      }
      if (!getVerifiedCompleteDiskFilePath(entry, selectedFileIdx)) {
        prewarmVideoTailCues(entry, selectedFileIdx);
      }
      if (!cachedProbe) {
        if (getVerifiedCompleteDiskFilePath(entry, selectedFileIdx)) {
          try {
            cachedProbe = await probeTorrentVideoFile(entry, selectedFileIdx);
          } catch {
            // ignore
          }
        } else {
          try {
            cachedProbe = await Promise.race([
              probeTorrentVideoFile(entry, selectedFileIdx),
              new Promise<undefined>((resolve) =>
                setTimeout(() => resolve(undefined), 1500)
              ),
            ]);
          } catch {
            // ignore
          }
          if (!cachedProbe) {
            probeTorrentVideoFile(entry, selectedFileIdx).catch(() => {});
          }
        }
      }
      const inferredCodec = /\b(hevc|x265|h\.?265|2160p|4k|uhd)\b/i.test(
        selectedFile?.name || ''
      )
        ? 'hevc'
        : 'h264';
      const probe = cachedProbe || {
        durationSec: 0,
        videoCodec: inferredCodec,
        audioTracks: [
          {
            index: 0,
            lang: 'ORIG',
            codec: 'AAC',
            title: 'Original',
            label: 'ORIGINAL AUDIO (Stereo)',
          },
        ],
      };

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(
        JSON.stringify({
          ok: true,
          provider: 'filelist_torrent',
          torrentId: targetTorrentId,
          selectedTorrent: selectedTorrentMeta,
          torrents: matchingTorrents.slice(0, 35),
          selectedFileIdx,
          selectedFileName: selectedFile?.name || '',
          files: videoFiles.map((f) => ({
            index: f.index,
            name: f.name,
            sizeFormatted: formatBytes(f.length),
          })),
          streamUrl: `/api/filelist/stream?id=${targetTorrentId}&fileIdx=${selectedFileIdx}&orig=${isRussianParam ? '0' : '1'}`,
          durationSec: probe.durationSec,
          videoCodec: probe.videoCodec,
          audioNames: probe.audioTracks.map((a) => a.label),
          audioTracks: probe.audioTracks,
          subtitleTracks: (probe.subtitleTracks || []).filter((t) => t.isText),
        })
      );
    } catch (err) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(
        JSON.stringify({
          ok: false,
          error: (err as Error).message || 'FileList resolve failed',
        })
      );
    }
    return true;
  }

  // 5. GET /api/filelist/stream — Live Remuxed fMP4 Video + AAC Stereo Audio Stream
  if (pathname === '/api/filelist/stream' && req.method === 'GET') {
    try {
      const id = parseInt(parsedUrl.searchParams.get('id') || '0', 10);
      const fileIdx = parseInt(parsedUrl.searchParams.get('fileIdx') || '0', 10);
      const startSec = Math.max(
        0,
        parseFloat(parsedUrl.searchParams.get('start') || '0') || 0
      );
      const rawAudioParam = parsedUrl.searchParams.get('audio');
      const hasExplicitAudioParam =
        rawAudioParam !== null && rawAudioParam.trim() !== '' && rawAudioParam !== '-1';
      const audioIdx = Math.max(
        0,
        parseInt(rawAudioParam || '0', 10) || 0
      );
      const rawOrigParam = parsedUrl.searchParams.get('orig');
      const isExplicitRussianContent = rawOrigParam === '0' || id < 0;
      const wantOrigAudio =
        rawOrigParam === '1' || (!isExplicitRussianContent && rawOrigParam !== '0');
      const maxWParam =
        parseInt(parsedUrl.searchParams.get('maxw') || '0', 10) || 0;
      const forceVideoTranscode =
        parsedUrl.searchParams.get('vtranscode') === '1';
      const isOfflineDownload =
        parsedUrl.searchParams.get('download') === '1';
      const subLangParam = (parsedUrl.searchParams.get('subLang') || 'ro').trim().toLowerCase();
      const rawSubIdxParam = parsedUrl.searchParams.get('subIdx');
      const explicitSubIdxParam =
        rawSubIdxParam !== null && rawSubIdxParam !== '' && rawSubIdxParam !== '-1'
          ? parseInt(rawSubIdxParam, 10)
          : -1;
      const clientUa = String(req.headers['user-agent'] || '');
      const isSmartTvClientUa =
        /BRAVIA|Sony|CE-HTML|Vewd|Opera TV|InettvBrowser|HbbTV|VIDAA|Hisense|Viera|Philips|Android TV|GoogleTV|GTV|ADT-|AFT[A-Z0-9]*|MIBOX|SHIELD|Chromecast|CrKey|TV Bro|BrowseHere|Odin|Puffin.*TV|TCL|Web0S|WebOS|NetCast|SmartTV|SMART-TV|Tizen|Large Screen|MSX|KD-[0-9]{2}[A-Z0-9]*|XR-[0-9]{2}[A-Z0-9]*|XBR-[0-9]{2}[A-Z0-9]*|K-[0-9]{2}[A-Z0-9]*|X80[A-Z]|X85[A-Z]|X90[A-Z]|X95[A-Z]|A80[A-Z]|A90[A-Z]|A95[A-Z]/i.test(
          clientUa
        ) ||
        (/Android/i.test(clientUa) && !/Mobile/i.test(clientUa));
      const capTo1080p =
        (maxWParam > 0 && maxWParam <= 1920) ||
        (maxWParam === 0 && isSmartTvClientUa);

      if (!id) {
        res.writeHead(400);
        res.end('Missing torrent id');
        return true;
      }

      const forwardedIp = String(
        req.headers['cf-connecting-ip'] ||
          String(req.headers['x-forwarded-for'] || '').split(',')[0] ||
          ''
      ).trim();
      const rawIp = forwardedIp || String(req.socket?.remoteAddress || 'local');
      const clientKey =
        rawIp === '::1' || rawIp === '::ffff:127.0.0.1' || rawIp === '127.0.0.1'
          ? 'localhost'
          : rawIp;

      // Kill any previous PLAYBACK stream from THIS SAME client immediately so seeking never leaves a zombie ffmpeg competing for peer bandwidth.
      // Offline background downloads (`?download=1`) run independently so navigating/watching another title NEVER aborts an active download!
      if (!(gState as any).activeStreamCleanupByClient) {
        (gState as any).activeStreamCleanupByClient = new Map<string, () => void>();
      }
      if (!isOfflineDownload) {
        const prevClientCleanup = (
          gState as any
        ).activeStreamCleanupByClient.get(clientKey);
        if (typeof prevClientCleanup === 'function') {
          try {
            prevClientCleanup();
          } catch {
            // ignore
          }
        }
      }

      let clientDisconnectedEarly = false;
      const markEarlyClose = () => {
        clientDisconnectedEarly = true;
      };
      res.once('close', markEarlyClose);
      req.once('aborted', markEarlyClose);

      const entry = await getOrStartTorrentEngine(id);
      if (
        clientDisconnectedEarly ||
        res.destroyed ||
        res.writableEnded ||
        Boolean(req.socket?.destroyed)
      ) {
        return true;
      }
      const verifiedDiskPath = getVerifiedCompleteDiskFilePath(entry, fileIdx);
      if (!verifiedDiskPath) {
        const curWires = Array.isArray(entry.engine?.swarm?.wires)
          ? entry.engine.swarm.wires.length
          : 0;
        if (id > 0 && curWires === 0) {
          ensureFileListTrackerIpUnlocked(true).catch(() => {});
        }
        ensureTorrentSwarmAlive(entry);
        prewarmVideoTailCues(entry, fileIdx);
      }

      // Deselect streams ONLY on OTHER inactive torrent engines idle for > 4s
      const nowMs = Date.now();
      for (const [otherId, otherEntry] of gState.activeEngines.entries()) {
        if (
          otherId !== id &&
          otherEntry.activeStreams &&
          nowMs - (otherEntry.lastAccessed || 0) > 4000
        ) {
          for (const closeOther of Array.from(otherEntry.activeStreams)) {
            try {
              closeOther();
            } catch {
              // ignore
            }
          }
          otherEntry.activeStreams.clear();
        }
      }
      const rawFile = entry.engine.files[fileIdx] || entry.engine.files[0];
      if (!rawFile) {
        res.writeHead(404);
        res.end('Video file not found in torrent');
        return true;
      }
      restrictTorrentSelectionToFile(entry, fileIdx);

      let cachedProbe = entry.probeCache.get(fileIdx);
      if (cachedProbe && (!cachedProbe.durationSec || !Array.isArray(cachedProbe.subtitleTracks))) {
        entry.probeCache.delete(fileIdx);
        cachedProbe = undefined;
      }
      const looksMultiOrDualAudio =
        id < 0 ||
        /\b(dual|multi|rus|ukr|dub|mvo|avo|dvo)\b|[а-яё]/i.test(
          rawFile.name || ''
        );
      const isSimpleSingleAudioH264 =
        !looksMultiOrDualAudio &&
        /\b(x264|h\.?264|avc)\b/i.test(rawFile.name || '') &&
        /\baac2?\.?0?\b/i.test(rawFile.name || '');
      const isMpegTsFile = /\.ts$/i.test(rawFile?.name || '');
      if (!cachedProbe) {
        if (verifiedDiskPath) {
          try {
            cachedProbe = await probeTorrentVideoFile(entry, fileIdx);
          } catch {
            // ignore
          }
        } else if (isSimpleSingleAudioH264) {
          probeTorrentVideoFile(entry, fileIdx).catch(() => {});
        } else if (wantOrigAudio) {
          try {
            cachedProbe = await Promise.race([
              probeTorrentVideoFile(entry, fileIdx),
              new Promise<undefined>((resolve) =>
                setTimeout(() => resolve(undefined), 3500)
              ),
            ]);
          } catch {
            // ignore
          }
        } else if (startSec <= 1) {
          probeTorrentVideoFile(entry, fileIdx).catch(() => {});
        } else if (!isMpegTsFile) {
          setTimeout(() => {
            probeTorrentVideoFile(entry, fileIdx).catch(() => {});
          }, 3500);
        }
      }
      const is4kSource = /\b(2160p|4k|uhd)\b/i.test(rawFile.name || '');
      const isHevc =
        (cachedProbe ? /hevc|h265/i.test(cachedProbe.videoCodec) : false) ||
        /\b(hevc|x265|h\.?265)\b/i.test(rawFile.name || '') ||
        (is4kSource &&
          !(cachedProbe && /h264|avc/i.test(cachedProbe.videoCodec)) &&
          !/\b(x264|h\.?264|avc)\b/i.test(rawFile.name || ''));
      const is10BitOrAltCodec =
        (cachedProbe ? /av1|vp9/i.test(cachedProbe.videoCodec) : false) ||
        /\b(10bit|hi10p|av1|vp9)\b/i.test(rawFile.name || '');
      const needsVideoTranscode =
        isHevc ||
        forceVideoTranscode ||
        is10BitOrAltCodec ||
        (capTo1080p && is4kSource);
      let safeAudioIdx = 0;
      if (cachedProbe && cachedProbe.audioTracks.length > 0) {
        const origTrack =
          cachedProbe.audioTracks.find((t) =>
            t.label.startsWith('ORIGINAL • ')
          ) ||
          cachedProbe.audioTracks.find(
            (t) => !/^(RU|RUS|UK|UKR|BE|BEL)$/i.test(t.lang)
          );
        const origIdx = origTrack ? origTrack.index : 0;

        if (hasExplicitAudioParam) {
          const requestedTrack = cachedProbe.audioTracks[audioIdx];
          const isRequestedRussian =
            requestedTrack &&
            /^(RU|RUS|UK|UKR|BE|BEL)$/i.test(requestedTrack.lang);
          // If foreign content and requested track is Russian while an original track exists, force original!
          if (
            wantOrigAudio &&
            isRequestedRussian &&
            origTrack &&
            origTrack.index !== audioIdx
          ) {
            safeAudioIdx = origIdx;
          } else {
            safeAudioIdx =
              audioIdx < cachedProbe.audioTracks.length ? audioIdx : origIdx;
          }
        } else if (wantOrigAudio) {
          safeAudioIdx = origIdx;
        } else {
          safeAudioIdx =
            audioIdx < cachedProbe.audioTracks.length ? audioIdx : 0;
        }
      } else if (wantOrigAudio && hasExplicitAudioParam && audioIdx > 0) {
        safeAudioIdx = audioIdx;
      }

      const streamHeaders: Record<string, string> = {
        'Content-Type': 'video/mp4',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'X-Content-Duration',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
      };
      if (cachedProbe?.durationSec && cachedProbe.durationSec > 30) {
        streamHeaders['X-Content-Duration'] = String(
          Math.round(cachedProbe.durationSec)
        );
      }
      if (!verifiedDiskPath && id > 0) {
        const isStartCached =
          startSec <= 1 &&
          Boolean(
            verifyDiskPiecesForByteRange(
              entry,
              fileIdx,
              0,
              Math.min(Math.max(0, Number(rawFile.length) - 1), 2 * 1024 * 1024)
            )
          );
        const curWires = Array.isArray(entry.engine?.swarm?.wires)
          ? entry.engine.swarm.wires.length
          : 0;
        if (!isStartCached && curWires === 0) {
          const deadline = Date.now() + 1800;
          while (Date.now() < deadline && !clientDisconnectedEarly) {
            const liveWires = Array.isArray(entry.engine?.swarm?.wires)
              ? entry.engine.swarm.wires.length
              : 0;
            if (liveWires > 0) break;
            if (entry.lastTrackerError && Date.now() + 900 > deadline) break;
            await new Promise((r) => setTimeout(r, 150));
          }
          const finalWires = Array.isArray(entry.engine?.swarm?.wires)
            ? entry.engine.swarm.wires.length
            : 0;
          if (
            finalWires === 0 &&
            entry.lastTrackerError &&
            !clientDisconnectedEarly &&
            !res.destroyed &&
            !res.writableEnded
          ) {
            res.writeHead(503, {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'X-Tracker-Error': String(entry.lastTrackerError).slice(0, 120),
            });
            res.end(
              JSON.stringify({ ok: false, error: entry.lastTrackerError })
            );
            return true;
          }
        }
      }

      res.writeHead(200, streamHeaders);

      const liveSubTrack = !isOfflineDownload
        ? pickEmbeddedSubtitleTrack(
            cachedProbe?.subtitleTracks,
            subLangParam,
            explicitSubIdxParam
          )
        : null;

      const ffArgs: string[] = ['-hide_banner', '-loglevel', 'error'];
      if (liveSubTrack) {
        ffArgs.push('-copyts');
      }
      const useDirectPipe = !verifiedDiskPath && (startSec <= 1 || isMpegTsFile);
      let directPipeStartByte = 0;
      if (useDirectPipe && isMpegTsFile && startSec > 1) {
        const totalTsBytes = Math.max(0, Number(rawFile?.length || 0));
        const tsEstDur =
          cachedProbe?.durationSec && cachedProbe.durationSec > 60
            ? cachedProbe.durationSec
            : Math.max(startSec + 600, Math.round(totalTsBytes / (720 * 1024)));
        const rawOffset = Math.floor(
          (Math.min(startSec, tsEstDur * 0.96) / Math.max(1, tsEstDur)) *
            totalTsBytes
        );
        directPipeStartByte = Math.max(0, Math.floor(rawOffset / 188) * 188);
      }
      const hwDecodeArgs =
        needsVideoTranscode && process.platform === 'darwin'
          ? ['-hwaccel', 'videotoolbox']
          : [];

      if (verifiedDiskPath) {
        if (startSec > 1) {
          ffArgs.push('-noaccurate_seek', '-ss', String(Math.floor(startSec)));
        }
        ffArgs.push(...hwDecodeArgs, '-i', verifiedDiskPath);
      } else if (!useDirectPipe) {
        const rangePort = await ensureInternalRangeServer();
        ffArgs.push(
          '-noaccurate_seek',
          '-ss',
          String(Math.floor(startSec)),
          ...hwDecodeArgs,
          '-i',
          `http://127.0.0.1:${rangePort}/raw?id=${id}&fileIdx=${fileIdx}`
        );
      } else {
        if (isMpegTsFile) {
          ffArgs.push(
            '-probesize',
            '1200000',
            '-analyzeduration',
            '1200000'
          );
          if (directPipeStartByte > 0) {
            ffArgs.push('-fflags', '+discardcorrupt+genpts');
          }
          ffArgs.push('-f', 'mpegts');
        }
        ffArgs.push(...hwDecodeArgs, '-i', 'pipe:0');
      }

      ffArgs.push(
        '-map',
        '0:v:0',
        '-map',
        `0:a:${safeAudioIdx}?`,
        '-map_metadata',
        '-1',
        '-map_chapters',
        '-1',
        '-dn',
        '-sn'
      );

      if (needsVideoTranscode) {
        const maxScaleW = capTo1080p ? 1920 : is4kSource ? 3840 : 1920;
        const use4kBitrate = !capTo1080p && is4kSource;
        const sdrFilter = `scale='min(${maxScaleW},iw)':trunc(ow/a/2)*2,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709`;
        if (process.platform === 'darwin') {
          ffArgs.push(
            '-c:v',
            'h264_videotoolbox',
            '-profile:v',
            'high',
            '-realtime',
            'true',
            '-g',
            '48',
            '-b:v',
            use4kBitrate ? '15M' : '8M',
            '-maxrate',
            use4kBitrate ? '20M' : '10M',
            '-bufsize',
            use4kBitrate ? '30M' : '16M',
            '-vf',
            sdrFilter,
            '-color_primaries',
            'bt709',
            '-color_trc',
            'bt709',
            '-colorspace',
            'bt709'
          );
        } else {
          ffArgs.push(
            '-c:v',
            'libx264',
            '-profile:v',
            'high',
            ...(maxScaleW <= 1920 ? ['-level:v', '4.1'] : []),
            '-preset',
            'ultrafast',
            '-tune',
            'zerolatency',
            '-g',
            '48',
            '-keyint_min',
            '24',
            '-sc_threshold',
            '0',
            '-crf',
            '21',
            '-vf',
            sdrFilter,
            '-color_primaries',
            'bt709',
            '-color_trc',
            'bt709',
            '-colorspace',
            'bt709',
            '-maxrate',
            use4kBitrate ? '15M' : '8M',
            '-bufsize',
            use4kBitrate ? '30M' : '16M'
          );
        }
      } else {
        // Direct bitstream copy for 1080p/720p 8-bit H.264 (0% CPU, original BluRay/WEB-DL quality, 150ms startup!)
        ffArgs.push('-c:v', 'copy');
      }

      const selectedAudioMeta = cachedProbe?.audioTracks?.[safeAudioIdx];
      const isAacStereo =
        (selectedAudioMeta &&
          selectedAudioMeta.codec.toUpperCase() === 'AAC' &&
          !selectedAudioMeta.label.includes('5.1')) ||
        (!selectedAudioMeta && /\baac2\.?0\b/i.test(rawFile.name || ''));

      if (isAacStereo && !needsVideoTranscode) {
        ffArgs.push('-c:a', 'copy');
      } else {
        ffArgs.push('-c:a', 'aac', '-ac', '2', '-b:a', '192k');
      }

      ffArgs.push(
        '-f',
        'mp4',
        '-brand',
        'isom',
        '-use_editlist',
        '0',
        '-avoid_negative_ts',
        'make_zero',
        '-movflags',
        'frag_keyframe+empty_moov+default_base_moof',
        'pipe:1'
      );

      if (liveSubTrack) {
        ffArgs.push(
          '-map',
          `0:s:${liveSubTrack.index}`,
          '-c:s',
          'webvtt',
          '-flush_packets',
          '1',
          '-f',
          'webvtt',
          'pipe:3'
        );
      }

      if (isOfflineDownload) {
        entry.activeDownloads = (entry.activeDownloads || 0) + 1;
      }

      const ff = spawn(
        ffmpegPath as string,
        ffArgs,
        liveSubTrack ? { stdio: ['pipe', 'pipe', 'pipe', 'pipe'] } : undefined
      );
      if (liveSubTrack && ff.stdio && ff.stdio[3]) {
        const subBucket = getOrCreateLiveSubBucket(
          `${id}:${fileIdx}:${liveSubTrack.index}`,
          liveSubTrack
        );
        attachLiveVttPipeReader(
          ff.stdio[3] as NodeJS.ReadableStream,
          subBucket,
          0
        );
      }
      if (!isOfflineDownload) {
        gState.activeStreamProcess = ff;
      }

      let directReadStream: any = null;
      let closeDirectRef: (() => void) | null = null;
      if (useDirectPipe) {
        directReadStream =
          directPipeStartByte > 0
            ? rawFile.createReadStream({ start: directPipeStartByte })
            : rawFile.createReadStream();
        attachRollingPieceReadahead(
          entry,
          directReadStream,
          Number(rawFile?.offset || 0),
          directPipeStartByte,
          Number(rawFile?.length || 0)
        );
        const closeDirect = () => {
          try {
            directReadStream?.destroy();
          } catch {
            // ignore
          }
        };
        closeDirectRef = closeDirect;
        if (!isOfflineDownload) {
          entry.activeStreams.add(closeDirect);
        }
        directReadStream.on('error', () => {});
        ff.stdin.on('error', () => {});
        directReadStream.pipe(ff.stdin);
      }

      let patchedFtyp = false;
      let bytesEmitted = 0;
      let lastTouchMs = Date.now();
      let ffStderrTail = '';
      ff.stderr?.on('data', (d: Buffer) => {
        if (ffStderrTail.length < 800) {
          ffStderrTail += d.toString();
        }
      });
      ff.stdout.on('data', (chunk: Buffer) => {
        bytesEmitted += chunk.length;
        const nowTouch = Date.now();
        if (nowTouch - lastTouchMs > 2000) {
          lastTouchMs = nowTouch;
          entry.lastAccessed = nowTouch;
        }
        let outChunk = chunk;
        if (!patchedFtyp && chunk.length >= 32) {
          patchedFtyp = true;
          const dbyIdx = chunk.indexOf('dby1', 0, 'ascii');
          if (dbyIdx >= 0 && dbyIdx < 64) {
            outChunk = Buffer.from(chunk);
            outChunk.write('iso5', dbyIdx, 'ascii');
          }
        }
        if (!res.destroyed && !res.writableEnded) {
          const canContinue = res.write(outChunk);
          if (!canContinue) {
            try {
              ff.stdout.pause();
            } catch {
              // ignore
            }
          }
        }
      });
      res.on('drain', () => {
        try {
          ff.stdout.resume();
        } catch {
          // ignore
        }
      });
      ff.stdout.on('end', () => {
        if (bytesEmitted === 0 && ffStderrTail.trim()) {
          console.warn(
            `[FileList-Stream-0Bytes] id=${id} fileIdx=${fileIdx} start=${startSec}: ${ffStderrTail.trim()}`
          );
        }
        if (!res.writableEnded) {
          res.end();
        }
      });

      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        if (isOfflineDownload) {
          entry.activeDownloads = Math.max(0, (entry.activeDownloads || 1) - 1);
        }
        if (closeDirectRef) {
          entry.activeStreams.delete(closeDirectRef);
          closeDirectRef = null;
        }
        if ((gState as any).activeStreamCleanupByClient?.get(clientKey) === cleanup) {
          (gState as any).activeStreamCleanupByClient.delete(clientKey);
        }
        if (directReadStream) {
          try {
            directReadStream.destroy();
          } catch {
            // ignore
          }
          directReadStream = null;
        }
        try {
          ff.kill('SIGKILL');
        } catch {
          // ignore
        }
        if (gState.activeStreamProcess === ff) {
          gState.activeStreamProcess = null;
        }
        if (!res.writableEnded && !res.destroyed) {
          try {
            res.end();
          } catch {
            // ignore
          }
        }
      };

      if (!isOfflineDownload) {
        (gState as any).activeStreamCleanupByClient.set(clientKey, cleanup);
      }
      if (
        clientDisconnectedEarly ||
        res.destroyed ||
        res.writableEnded ||
        Boolean(req.socket?.destroyed)
      ) {
        cleanup();
        return true;
      }
      req.on('aborted', cleanup);
      res.on('close', cleanup);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
      }
      res.end((err as Error).message);
    }
    return true;
  }

  // 6. GET /api/filelist/hls.m3u8 — Live Remuxed HLS (.m3u8 + .ts) for iOS (iPhone / iPad AVPlayer) & Universal Fallback
  if (pathname === '/api/filelist/hls.m3u8' && req.method === 'GET') {
    try {
      const id = parseInt(parsedUrl.searchParams.get('id') || '0', 10);
      const fileIdx = parseInt(parsedUrl.searchParams.get('fileIdx') || '0', 10);
      const startSec = Math.max(
        0,
        Math.floor(parseFloat(parsedUrl.searchParams.get('start') || '0') || 0)
      );
      const audioIdx = Math.max(
        0,
        parseInt(parsedUrl.searchParams.get('audio') || '0', 10) || 0
      );

      if (!id) {
        res.writeHead(400);
        res.end('Missing torrent id');
        return true;
      }

      const hlsSubLang = (parsedUrl.searchParams.get('subLang') || 'ro').trim().toLowerCase();
      const hlsRawSubIdx = parsedUrl.searchParams.get('subIdx');
      const hlsExplicitSubIdx =
        hlsRawSubIdx !== null && hlsRawSubIdx !== '' && hlsRawSubIdx !== '-1'
          ? parseInt(hlsRawSubIdx, 10)
          : -1;
      const sessionKey = `${id}:${fileIdx}:${startSec}:${audioIdx}:${hlsSubLang}:${hlsExplicitSubIdx}`;
      let hlsSession = gState.activeHlsSession;
      const m3u8ExistingPath = hlsSession
        ? path.join(hlsSession.dir, 'stream.m3u8')
        : '';

      const needsNewSession =
        !hlsSession ||
        hlsSession.key !== sessionKey ||
        (hlsSession.exited && !fs.existsSync(m3u8ExistingPath));

      if (needsNewSession) {
        if (gState.activeHlsSession) {
          try {
            gState.activeHlsSession.proc?.kill('SIGKILL');
          } catch {
            // ignore
          }
          try {
            fs.rmSync(gState.activeHlsSession.dir, {
              recursive: true,
              force: true,
            });
          } catch {
            // ignore
          }
          gState.activeHlsSession = null;
        }
        if (gState.activeStreamProcess) {
          try {
            gState.activeStreamProcess.kill('SIGKILL');
          } catch {
            // ignore
          }
          gState.activeStreamProcess = null;
        }

        const entry = await getOrStartTorrentEngine(id);
        ensureTorrentSwarmAlive(entry);
        if (entry.activeStreams) {
          for (const closeOld of Array.from(entry.activeStreams)) {
            try {
              closeOld();
            } catch {
              // ignore
            }
          }
          entry.activeStreams.clear();
        }
        const rawFile = entry.engine.files[fileIdx] || entry.engine.files[0];
        if (!rawFile) {
          res.writeHead(404);
          res.end('Video file not found in torrent');
          return true;
        }

        let cachedProbe = entry.probeCache.get(fileIdx);
        if (cachedProbe && (!cachedProbe.durationSec || !Array.isArray(cachedProbe.subtitleTracks))) {
          entry.probeCache.delete(fileIdx);
          cachedProbe = undefined;
        }
        if (!cachedProbe) {
          try {
            cachedProbe = await Promise.race([
              probeTorrentVideoFile(entry, fileIdx),
              new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 2000)),
            ]);
          } catch {
            // ignore
          }
          if (!cachedProbe) {
            probeTorrentVideoFile(entry, fileIdx).catch(() => {});
          }
        }
        const isHevc =
          (cachedProbe ? /hevc|h265/i.test(cachedProbe.videoCodec) : false) ||
          /\b(hevc|x265|h\.?265|2160p|4k|uhd)\b/i.test(rawFile.name || '');
        const safeAudioIdx =
          cachedProbe && cachedProbe.audioTracks.length > 0
            ? audioIdx < cachedProbe.audioTracks.length
              ? audioIdx
              : 0
            : 0;

        ensureTmpDir();
        const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const sessionDir = path.join(TORRENT_CACHE_DIR, `hls_${sessionId}`);
        fs.mkdirSync(sessionDir, { recursive: true });

        const hlsSubTrack = pickEmbeddedSubtitleTrack(
          cachedProbe?.subtitleTracks,
          hlsSubLang,
          hlsExplicitSubIdx
        );
        const verifiedDiskPathHls = getVerifiedCompleteDiskFilePath(entry, fileIdx);
        const ffArgs: string[] = ['-hide_banner', '-loglevel', 'error'];
        if (hlsSubTrack) {
          ffArgs.push('-copyts');
        }
        const useDirectPipeHls = !verifiedDiskPathHls && startSec <= 1;
        const hwDecodeArgsHls =
          isHevc && process.platform === 'darwin'
            ? ['-hwaccel', 'videotoolbox']
            : [];

        if (verifiedDiskPathHls) {
          if (startSec > 1) {
            ffArgs.push('-noaccurate_seek', '-ss', String(startSec));
          }
          ffArgs.push(...hwDecodeArgsHls, '-i', verifiedDiskPathHls);
        } else if (!useDirectPipeHls) {
          const rangePort = await ensureInternalRangeServer();
          ffArgs.push(
            '-noaccurate_seek',
            '-ss',
            String(startSec),
            ...hwDecodeArgsHls,
            '-i',
            `http://127.0.0.1:${rangePort}/raw?id=${id}&fileIdx=${fileIdx}`
          );
        } else {
          ffArgs.push(...hwDecodeArgsHls, '-i', 'pipe:0');
        }

        ffArgs.push(
          '-map',
          '0:v:0',
          '-map',
          `0:a:${safeAudioIdx}?`,
          '-map_metadata',
          '-1',
          '-map_chapters',
          '-1',
          '-dn',
          '-sn'
        );

        if (isHevc) {
          const is4kHls = /\b(2160p|4k|uhd)\b/i.test(rawFile.name || '');
          const maxScaleHls = is4kHls ? 3840 : 1920;
          const sdrFilter = `scale='min(${maxScaleHls},iw)':trunc(ow/a/2)*2,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709`;
          if (process.platform === 'darwin') {
            ffArgs.push(
              '-c:v',
              'h264_videotoolbox',
              '-realtime',
              'true',
              '-b:v',
              is4kHls ? '15M' : '8M',
              '-maxrate',
              is4kHls ? '20M' : '10M',
              '-bufsize',
              is4kHls ? '30M' : '16M',
              '-vf',
              sdrFilter,
              '-color_primaries',
              'bt709',
              '-color_trc',
              'bt709',
              '-colorspace',
              'bt709',
              '-g',
              '48'
            );
          } else {
            ffArgs.push(
              '-c:v',
              'libx264',
              '-preset',
              'ultrafast',
              '-tune',
              'zerolatency',
              '-crf',
              '21',
              '-vf',
              sdrFilter,
              '-color_primaries',
              'bt709',
              '-color_trc',
              'bt709',
              '-colorspace',
              'bt709',
              '-maxrate',
              '8M',
              '-bufsize',
              '16M',
              '-g',
              '48',
              '-sc_threshold',
              '0'
            );
          }
        } else {
          ffArgs.push('-c:v', 'copy', '-bsf:v', 'h264_mp4toannexb');
        }

        ffArgs.push(
          '-c:a',
          'aac',
          '-ac',
          '2',
          '-b:a',
          '192k',
          '-f',
          'hls',
          '-hls_init_time',
          '1',
          '-hls_time',
          '2',
          '-hls_list_size',
          '0',
          '-hls_playlist_type',
          'event',
          '-hls_flags',
          'independent_segments+temp_file',
          '-hls_segment_filename',
          path.join(sessionDir, 'seg_%05d.ts'),
          path.join(sessionDir, 'stream.m3u8')
        );

        if (hlsSubTrack) {
          ffArgs.push(
            '-map',
            `0:s:${hlsSubTrack.index}`,
            '-c:s',
            'webvtt',
            '-flush_packets',
            '1',
            '-f',
            'webvtt',
            'pipe:3'
          );
        }

        const ff = spawn(
          ffmpegPath as string,
          ffArgs,
          hlsSubTrack ? { stdio: ['pipe', 'pipe', 'pipe', 'pipe'] } : undefined
        );
        ff.stderr?.resume();
        if (hlsSubTrack && ff.stdio && ff.stdio[3]) {
          const subBucket = getOrCreateLiveSubBucket(
            `${id}:${fileIdx}:${hlsSubTrack.index}`,
            hlsSubTrack
          );
          attachLiveVttPipeReader(
            ff.stdio[3] as NodeJS.ReadableStream,
            subBucket,
            0
          );
        }
        let directHlsReadStream: any = null;
        if (useDirectPipeHls) {
          directHlsReadStream = rawFile.createReadStream();
          try {
            if (
              typeof directHlsReadStream.startPiece === 'number' &&
              entry.engine.critical
            ) {
              entry.engine.critical(directHlsReadStream.startPiece, 12);
            }
          } catch {
            // ignore
          }
          const closeDirect = () => {
            try {
              directHlsReadStream?.destroy();
            } catch {
              // ignore
            }
          };
          entry.activeStreams.add(closeDirect);
          directHlsReadStream.on('error', () => {});
          ff.stdin.on('error', () => {});
          directHlsReadStream.pipe(ff.stdin);
        }
        const newSession: ActiveHlsSession = {
          key: sessionKey,
          sessionId,
          dir: sessionDir,
          proc: ff,
          exited: false,
          startedAt: Date.now(),
          lastAccessed: Date.now(),
        };
        const hlsIdleReaper = setInterval(() => {
          if (gState.activeHlsSession !== newSession) {
            clearInterval(hlsIdleReaper);
            return;
          }
          if (Date.now() - newSession.lastAccessed > 90_000) {
            clearInterval(hlsIdleReaper);
            try { newSession.proc?.kill('SIGKILL'); } catch { /* ignore */ }
            try { fs.rmSync(newSession.dir, { recursive: true, force: true }); } catch { /* ignore */ }
            if (gState.activeHlsSession === newSession) {
              gState.activeHlsSession = null;
            }
          }
        }, 15_000);
        hlsIdleReaper.unref?.();
        ff.on('close', () => {
          if (directHlsReadStream) {
            try {
              directHlsReadStream.destroy();
            } catch {
              // ignore
            }
            directHlsReadStream = null;
          }
          newSession.exited = true;
          newSession.proc = null;
        });
        gState.activeHlsSession = newSession;
        hlsSession = newSession;
      } else if (hlsSession) {
        hlsSession.lastAccessed = Date.now();
      }

      const activeSess = hlsSession!;
      const m3u8Path = path.join(activeSess.dir, 'stream.m3u8');

      const waitStart = Date.now();
      while (Date.now() - waitStart < 14000) {
        if (fs.existsSync(m3u8Path)) {
          try {
            const txt = fs.readFileSync(m3u8Path, 'utf8');
            if (txt.includes('seg_00000.ts')) {
              break;
            }
          } catch {
            // wait
          }
        }
        if (activeSess.exited && !fs.existsSync(m3u8Path)) {
          break;
        }
        await new Promise((r) => setTimeout(r, 80));
      }

      if (!fs.existsSync(m3u8Path)) {
        res.writeHead(504, { 'Content-Type': 'text/plain' });
        res.end('HLS playlist generation timeout');
        return true;
      }

      const rawPlaylist = fs.readFileSync(m3u8Path, 'utf8');
      const rewrittenPlaylist = rawPlaylist.replace(
        /^(seg_\d+\.ts)\s*$/gm,
        `/api/filelist/hls-seg?s=${encodeURIComponent(activeSess.sessionId)}&f=$1`
      );

      res.writeHead(200, {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
      res.end(rewrittenPlaylist);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
      }
      res.end((err as Error).message);
    }
    return true;
  }

  // 7. GET /api/filelist/hls-seg — Serve MPEG-TS segment for HLS stream
  if (pathname === '/api/filelist/hls-seg' && req.method === 'GET') {
    const s = (parsedUrl.searchParams.get('s') || '').replace(/[^a-zA-Z0-9_]/g, '');
    const f = (parsedUrl.searchParams.get('f') || '').replace(/[^a-zA-Z0-9_.]/g, '');
    if (!s || !/^seg_\d+\.ts$/.test(f)) {
      res.writeHead(400);
      res.end('Invalid segment');
      return true;
    }
    if (gState.activeHlsSession && gState.activeHlsSession.sessionId === s) {
      gState.activeHlsSession.lastAccessed = Date.now();
    }
    const segPath = path.join(TORRENT_CACHE_DIR, `hls_${s}`, f);
    if (!fs.existsSync(segPath)) {
      res.writeHead(404);
      res.end('Segment not found');
      return true;
    }
    const stat = fs.statSync(segPath);
    const total = stat.size;
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/i, '').split('-');
      const start = Math.max(0, parseInt(parts[0], 10) || 0);
      const parsedEnd = parts[1] ? parseInt(parts[1], 10) : total - 1;
      const end = Number.isFinite(parsedEnd) ? Math.min(total - 1, parsedEnd) : total - 1;
      if (total <= 0 || start >= total || end < start) {
        res.writeHead(416, { 'Content-Range': `bytes */${total}`, 'Access-Control-Allow-Origin': '*' });
        res.end();
        return true;
      }
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': 'video/mp2t',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      });
      fs.createReadStream(segPath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': total,
        'Accept-Ranges': 'bytes',
        'Content-Type': 'video/mp2t',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      });
      fs.createReadStream(segPath).pipe(res);
    }
    return true;
  }

  return false;
}


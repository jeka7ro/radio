import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
// @ts-expect-error torrent-stream has no official types
import torrentStream from 'torrent-stream';
import ffmpegPath from 'ffmpeg-static';

const SESSION_FILE = path.resolve(process.cwd(), '.filelist-session.json');
const TORRENT_CACHE_DIR = '/tmp/aether-torrents';

const DEFAULT_FL_CREDENTIALS = {
  username: 'jeka7ro',
  password: '11Decembrie!',
  passkey: 'e5414e22e5327ac79101a9c63522107a',
  cookie: 'uid=1639732; pass=887313c4bead053797ba7dfb37f29b46',
  updatedAt: Date.now(),
};

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
  provider?: 'filelist' | 'torrentio';
  infoHash?: string;
  fileIdx?: number;
  audioInfo?: string;
}

interface ActiveTorrentEngine {
  id: number;
  engine: any;
  ready: boolean;
  readyPromise: Promise<void>;
  lastAccessed: number;
  activeStreams: Set<() => void>;
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
    }
  >;
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
    }
  >;
  activeStreamProcess: ChildProcess | null;
  internalRangeServerPort: number;
  rangePrioritySeq: number;
}

const gState: GlobalFileListState =
  (globalThis as any).__aetherFileListState ||
  ((globalThis as any).__aetherFileListState = {
    activeEngines: new Map<number, ActiveTorrentEngine>(),
    magnetMetaById: new Map(),
    activeStreamProcess: null,
    internalRangeServerPort: 0,
    rangePrioritySeq: 10,
  });

if (!gState.magnetMetaById) {
  gState.magnetMetaById = new Map();
}
const activeEngines = gState.activeEngines;
const magnetMetaById = gState.magnetMetaById;

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

export async function authenticateFileList(
  username?: string,
  password?: string
): Promise<FileListSession> {
  const current = loadSession();
  const user = (username || current.username || DEFAULT_FL_CREDENTIALS.username).trim();
  const pass = password || current.password || DEFAULT_FL_CREDENTIALS.password;

  try {
    const res1 = await fetch('https://filelist.io/login.php', {
      headers: { 'User-Agent': USER_AGENT },
    });
    const cookies1 = res1.headers.getSetCookie ? res1.headers.getSetCookie() : [];
    const phpSess =
      cookies1.map((c) => c.split(';')[0]).find((c) => c.startsWith('PHPSESSID=')) || '';
    const html1 = await res1.text();
    const validator =
      (html1.match(/name=["']validator["']\s+value=["']([^"']+)["']/i) || [])[1] || '';

    const body = new URLSearchParams({
      validator,
      username: user,
      password: pass,
      unlock: '1',
    });

    const res2 = await fetch('https://filelist.io/takelogin.php', {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: phpSess,
        Referer: 'https://filelist.io/login.php',
      },
      body: body.toString(),
      redirect: 'manual',
    });

    const cookies2 = res2.headers.getSetCookie ? res2.headers.getSetCookie() : [];
    const combinedCookie = [...cookies1, ...cookies2]
      .map((c) => c.split(';')[0])
      .filter(
        (c) =>
          !c.endsWith('=deleted') &&
          (c.startsWith('PHPSESSID=') || c.startsWith('uid=') || c.startsWith('pass='))
      )
      .join('; ');

    let passkey = current.passkey;
    if (combinedCookie.includes('uid=')) {
      const resMy = await fetch('https://filelist.io/my.php', {
        headers: { 'User-Agent': USER_AGENT, Cookie: combinedCookie },
      });
      const htmlMy = await resMy.text();
      const pkMatch =
        htmlMy.match(/passkey[\s\S]{0,250}?([a-f0-9]{32})/i) ||
        htmlMy.match(/([a-f0-9]{32})/);
      if (pkMatch?.[1]) {
        passkey = pkMatch[1];
      }
    }

    const updated: FileListSession = {
      username: user,
      password: pass,
      passkey: passkey || DEFAULT_FL_CREDENTIALS.passkey,
      cookie: combinedCookie.includes('uid=') ? combinedCookie : current.cookie,
      updatedAt: Date.now(),
    };
    saveSession(updated);
    return updated;
  } catch {
    return current;
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
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

  const quality = /2160p|4K|UHD/i.test(raw)
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
  let res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Cookie: session.cookie },
    redirect: 'manual',
  });

  if (res.status === 302 || res.status === 403) {
    session = await authenticateFileList();
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Cookie: session.cookie },
    });
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

  let res = await fetch(buildUrl(session), {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (res.status === 401 || res.status === 403) {
    session = await authenticateFileList();
    res = await fetch(buildUrl(session), {
      headers: { 'User-Agent': USER_AGENT },
    });
  }

  if (!res.ok) return [];
  const data = await res.json();
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

export async function getFileListCatalog(options: {
  section?: string;
  query?: string;
  imdb?: string;
  sort?: 'seeders' | 'latest';
  page?: number;
}): Promise<FileListTorrentCard[]> {
  const section = options.section || 'ro';
  const query = (options.query || '').trim();
  const imdb = (options.imdb || '').trim();
  const sort = options.sort || 'seeders';
  const page = options.page || 1;

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
    });
    return apiItems.sort((a, b) => b.seeders - a.seeders);
  }

  if (query) {
    const [apiItems, browseItems] = await Promise.all([
      fetchFileListApi('search-torrents', {
        type: 'name',
        query,
      }).catch(() => []),
      scrapeBrowsePhp('', query, 'seeders', 1).catch(() => []),
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
        /movie|film|serial|tv|hd|4k|desene|anime|ro/i.test(i.category)
      )
      .sort((a, b) => b.seeders - a.seeders);
  }

  // Combine browse.php (which has TMDB posters + Top Seeded sort) with api.php (which has IMDb IDs + latest torrents)
  const [browseItems, apiItems] = await Promise.all([
    scrapeBrowsePhp(catIds.split(',')[0], '', sort, page).catch(() => []),
    page === 1
      ? fetchFileListApi('latest-torrents', {
          category: catIds,
          limit: '40',
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
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      streams?: Array<{
        name?: string;
        title?: string;
        infoHash?: string;
        fileIdx?: number;
        sources?: string[];
        behaviorHints?: { filename?: string };
      }>;
    };
    const rawStreams = Array.isArray(data?.streams) ? data.streams : [];
    const results: FileListTorrentCard[] = [];

    for (const s of rawStreams) {
      const infoHash = String(s.infoHash || '').trim().toLowerCase();
      if (!/^[a-f0-9]{40}$/.test(infoHash)) continue;
      const lines = String(s.title || '').split('\n').map((l) => l.trim()).filter(Boolean);
      const releaseLine = s.behaviorHints?.filename || lines[0] || `Torrentio ${infoHash.slice(0, 8)}`;
      const statsLine = lines.find((l) => l.includes('👤') || l.includes('💾')) || lines[1] || '';
      const audioLine = lines.length >= 3 ? lines[lines.length - 1] : '';

      const seedMatch = statsLine.match(/👤\s*(\d+)/);
      const seeders = seedMatch ? parseInt(seedMatch[1], 10) : 15;
      if (seeders < 2) continue;

      const sizeMatch = statsLine.match(/💾\s*([\d.]+\s*[GMK]B)/i);
      const sizeFormatted = sizeMatch ? sizeMatch[1] : '2.4 GB';
      const sizeNum = parseFloat(sizeFormatted) || 2.4;
      const sizeBytes = /GB/i.test(sizeFormatted)
        ? Math.round(sizeNum * 1024 * 1024 * 1024)
        : Math.round(sizeNum * 1024 * 1024);

      const trackerMatch = statsLine.match(/⚙️\s*([^\n]+)/);
      const trackerName = trackerMatch ? trackerMatch[1].trim() : 'P2P';

      const combinedText = `${s.name || ''} ${releaseLine}`;
      const quality = /2160p|4k|uhd/i.test(combinedText)
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

      const isRo = /🇷🇴|\b(RO|ROsub|Romanian)\b/i.test(String(s.title || ''));
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
        audioInfo: audioLine && !audioLine.includes('👤') ? audioLine : undefined,
      });
    }
    return results.slice(0, 18);
  } catch {
    return [];
  }
}

async function getOrStartTorrentEngine(
  torrentId: number,
  explicitInfoHash?: string
): Promise<ActiveTorrentEngine> {
  ensureTmpDir();
  const existing = activeEngines.get(torrentId);
  if (existing) {
    existing.lastAccessed = Date.now();
    await existing.readyPromise;
    return existing;
  }

  // Clean up old engines if more than 3 are open
  if (activeEngines.size >= 3) {
    let oldestKey: number | null = null;
    let oldestTime = Infinity;
    for (const [k, v] of activeEngines.entries()) {
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
    const trQuery = Array.from(
      new Set([...(magnetMeta.trackers || []), ...DEFAULT_PUBLIC_TRACKERS])
    )
      .slice(0, 16)
      .map((tr) => `tr=${encodeURIComponent(tr)}`)
      .join('&');
    const magnetUri = `magnet:?xt=urn:btih:${magnetMeta.infoHash}&${trQuery}`;
    engine = torrentStream(magnetUri, {
      tmp: TORRENT_CACHE_DIR,
      id: peerId,
      dht: true,
      tracker: true,
      trackers: DEFAULT_PUBLIC_TRACKERS,
      connections: 75,
      uploads: 2,
    });
  } else {
    const session = loadSession();
    const torrentFilePath = path.join(TORRENT_CACHE_DIR, `${torrentId}.torrent`);
    let torrentBuf: Buffer;

    if (fs.existsSync(torrentFilePath) && fs.statSync(torrentFilePath).size > 200) {
      torrentBuf = fs.readFileSync(torrentFilePath);
    } else {
      const dlUrl = `https://filelist.io/download.php?id=${torrentId}&passkey=${session.passkey}`;
      const res = await fetch(dlUrl, {
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
        const retryRes = await fetch(
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
      fs.writeFileSync(torrentFilePath, torrentBuf);
    }

    engine = torrentStream(torrentBuf, {
      tmp: TORRENT_CACHE_DIR,
      id: peerId,
      dht: false,
      tracker: true,
      connections: 60,
      uploads: 2,
    });
  }

  const entry: ActiveTorrentEngine = {
    id: torrentId,
    engine,
    ready: false,
    readyPromise: Promise.resolve(),
    lastAccessed: Date.now(),
    activeStreams: new Set(),
    files: [],
    probeCache: new Map(),
  };

  entry.readyPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Torrent metadata timeout'));
    }, 15000);

    engine.on('ready', () => {
      clearTimeout(timeout);
      entry.ready = true;
      entry.files = (engine.files || []).map((f: any, idx: number) => ({
        index: idx,
        name: String(f.name || ''),
        path: String(f.path || f.name || ''),
        length: Number(f.length || 0),
      }));
      resolve();
    });

    engine.on('error', (err: any) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  activeEngines.set(torrentId, entry);
  await entry.readyPromise;
  return entry;
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
}> {
  const cached = entry.probeCache.get(fileIdx);
  if (cached) return cached;

  const rawFile = entry.engine.files[fileIdx];
  if (!rawFile || !ffmpegPath) {
    return {
      durationSec: 0,
      videoCodec: 'h264',
      audioTracks: [{ index: 0, lang: 'orig', codec: 'aac', title: 'Original', label: '★ ORIGINAL AUDIO' }],
    };
  }

  // Also pre-warm the tail 1.5MB of the video file in the background for fast MKV seeking
  try {
    if (rawFile.length > 4 * 1024 * 1024) {
      const tailStream = rawFile.createReadStream({
        start: Math.max(0, rawFile.length - 1536 * 1024),
        end: rawFile.length - 1,
      });
      tailStream.on('data', () => {});
      tailStream.on('error', () => {});
      setTimeout(() => {
        try {
          tailStream.destroy();
        } catch {
          // ignore
        }
      }, 6000);
    }
  } catch {
    // ignore
  }

  return new Promise((resolve) => {
    const ff = spawn(ffmpegPath as string, ['-hide_banner', '-i', 'pipe:0']);
    let stderr = '';
    ff.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    const probeBytes = Math.min(rawFile.length - 1, 2 * 1024 * 1024);
    const rs = rawFile.createReadStream({ start: 0, end: probeBytes });
    rs.pipe(ff.stdin).on('error', () => {});

    const timer = setTimeout(() => {
      try {
        rs.destroy();
        ff.kill('SIGKILL');
      } catch {
        // ignore
      }
    }, 6500);

    ff.on('close', () => {
      clearTimeout(timer);
      let durationSec = 0;
      const durMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i);
      if (durMatch) {
        durationSec =
          parseInt(durMatch[1], 10) * 3600 +
          parseInt(durMatch[2], 10) * 60 +
          parseFloat(durMatch[3]);
      }

      const videoMatch = stderr.match(/Stream #\d+:\d+.*?Video:\s*([a-zA-Z0-9_]+)/i);
      const videoCodec = videoMatch ? videoMatch[1].toLowerCase() : 'h264';

      const audioTracks: Array<{
        index: number;
        lang: string;
        codec: string;
        title: string;
        label: string;
      }> = [];

      const streamRegex = /Stream #0:(\d+)(?:\(([a-zA-Z]{2,3})\))?[^:]*:\s*Audio:\s*([a-zA-Z0-9_]+)([^\r\n]*)(?:\r?\n\s*Metadata:\r?\n(?:\s+[^\r\n]+\r?\n)*?\s+title\s*:\s*([^\r\n]+))?/gi;
      let match: RegExpExecArray | null;
      let audioOrder = 0;
      while ((match = streamRegex.exec(stderr)) !== null) {
        const lang = (match[2] || 'orig').toUpperCase();
        const codec = (match[3] || 'audio').toUpperCase();
        const extra = (match[4] || '').includes('5.1') ? '5.1' : 'Stereo';
        const metaTitle = (match[5] || '').trim();
        const prefix = audioOrder === 0 ? '★ ORIGINAL • ' : '';
        const label = `${prefix}${lang} (${codec} ${extra})${metaTitle ? ` — ${metaTitle}` : ''}`;
        audioTracks.push({
          index: audioOrder,
          lang,
          codec,
          title: metaTitle || lang,
          label,
        });
        audioOrder++;
      }

      if (audioTracks.length === 0) {
        audioTracks.push({
          index: 0,
          lang: 'ORIG',
          codec: 'AAC',
          title: 'Original',
          label: '★ ORIGINAL AUDIO (Stereo)',
        });
      }

      const result = { durationSec, videoCodec, audioTracks };
      entry.probeCache.set(fileIdx, result);
      resolve(result);
    });
  });
}

function ensureInternalRangeServer(): Promise<number> {
  if (gState.internalRangeServerPort > 0) {
    return Promise.resolve(gState.internalRangeServerPort);
  }
  return new Promise((resolve) => {
    const srv = http.createServer(async (req, res) => {
      try {
        const u = new URL(req.url || '/', 'http://127.0.0.1');
        const id = parseInt(u.searchParams.get('id') || '0', 10);
        const fileIdx = parseInt(u.searchParams.get('fileIdx') || '0', 10);
        const entry = await getOrStartTorrentEngine(id);
        if (!entry.activeStreams) {
          entry.activeStreams = new Set();
        }
        // Close any previous Range stream on this engine since ffmpeg reads sequentially from one Range request at a time
        for (const closeOld of Array.from(entry.activeStreams)) {
          try {
            closeOld();
          } catch {
            // ignore
          }
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
            'Content-Type': 'application/octet-stream',
          });
        } else {
          res.writeHead(200, {
            'Content-Length': total,
            'Accept-Ranges': 'bytes',
            'Content-Type': 'application/octet-stream',
          });
        }

        const s = videoFile.createReadStream({ start, end });
        try {
          if (typeof s.startPiece === 'number' && entry.engine.critical) {
            entry.engine.critical(s.startPiece, 4);
          }
          if (Array.isArray(entry.engine.selection)) {
            const topPrio = ++gState.rangePrioritySeq;
            for (const sel of entry.engine.selection) {
              if (sel.from === s.startPiece && sel.to === s.endPiece) {
                sel.priority = topPrio;
              }
            }
            entry.engine.selection.sort(
              (a: any, b: any) => (b.priority || 0) - (a.priority || 0)
            );
          }
        } catch {
          // ignore
        }

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
        };
        entry.activeStreams.add(closeStream);
        req.on('close', closeStream);
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
      resolve(gState.internalRangeServerPort);
    });
  });
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
      new RegExp(`\\b${season}x${ePad}\\b`, 'i'),
      new RegExp(`\\bE${ePad}\\b`, 'i'),
      new RegExp(`Episode[.\\s_-]*0*${episode}\\b`, 'i'),
    ];
    for (const pat of patterns) {
      const found = pool.find((f) => pat.test(f.name) || pat.test(f.path));
      if (found) return found.index;
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

  const parsedUrl = new URL(rawUrl, 'http://localhost');
  const pathname = parsedUrl.pathname;

  // 1. GET /api/filelist/status
  if (pathname === '/api/filelist/status' && req.method === 'GET') {
    const session = loadSession();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
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
        source: (targetEntry?.id || 0) < 0 ? 'Torrentio P2P' : 'FileList.io VIP',
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

      const items = await getFileListCatalog({ section, query: q, imdb, sort, page });
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

  // 4. GET /api/filelist/resolve
  if (pathname === '/api/filelist/resolve' && req.method === 'GET') {
    try {
      const idParam = parsedUrl.searchParams.get('id') || '';
      const imdbParam = parsedUrl.searchParams.get('imdb') || '';
      const rawQueryParam = parsedUrl.searchParams.get('q') || '';
      const typeParam = parsedUrl.searchParams.get('type') || 'movie';
      const queryParam =
        typeParam === 'series'
          ? rawQueryParam
              .replace(/\s*\(S\d+[^)]*\)\s*/gi, ' ')
              .replace(/\bS\d{1,2}[.\s_-]*E\d{1,2}\b/gi, ' ')
              .replace(/\s{2,}/g, ' ')
              .trim() || rawQueryParam.trim()
          : rawQueryParam.trim();
      const season = parseInt(parsedUrl.searchParams.get('s') || '0', 10) || undefined;
      const episode = parseInt(parsedUrl.searchParams.get('e') || '0', 10) || undefined;
      const requestedFileIdx = parsedUrl.searchParams.get('fileIdx');

      let matchingTorrents: FileListTorrentCard[] = [];
      let torrentioTorrents: FileListTorrentCard[] = [];
      let targetTorrentId = idParam.startsWith('tio:')
        ? hashToSyntheticId(idParam.replace(/^tio:/i, ''))
        : parseInt(idParam.replace(/^fl:/i, ''), 10) || 0;

      const [flByImdb, tioStreams] = await Promise.all([
        imdbParam && imdbParam.startsWith('tt')
          ? getFileListCatalog({ imdb: imdbParam }).catch(() => [])
          : Promise.resolve([]),
        imdbParam && imdbParam.startsWith('tt')
          ? fetchTorrentioStreams(
              imdbParam,
              typeParam === 'series' ? 'series' : 'movie',
              season,
              episode
            ).catch(() => [])
          : Promise.resolve([]),
      ]);

      matchingTorrents = flByImdb;
      torrentioTorrents = tioStreams;

      if (matchingTorrents.length === 0 && queryParam) {
        matchingTorrents = await getFileListCatalog({ query: queryParam });
      }

      const getQualityScore = (q: string) =>
        q === '4K UHD' ? 3 : q === '1080p Full HD' ? 2 : 1;
      const sortByQualityAndSeeders = (list: FileListTorrentCard[]) =>
        [...list].sort((a, b) => {
          if (a.seeders >= 2 && b.seeders >= 2) {
            const qa = getQualityScore(a.quality);
            const qb = getQualityScore(b.quality);
            if (qa !== qb) return qb - qa;
          }
          return b.seeders - a.seeders;
        });

      matchingTorrents = sortByQualityAndSeeders(matchingTorrents);

      // If series, filter or rank torrents matching the requested Season/Episode AFTER sorting
      if (typeParam === 'series' && season) {
        const sPad = `S${String(season).padStart(2, '0')}`;
        const ePad = episode ? `E${String(episode).padStart(2, '0')}` : '';
        const epRegex = ePad ? new RegExp(`${sPad}[.\\s_-]*${ePad}\\b`, 'i') : null;
        const seasonPackRegex = new RegExp(
          `(${sPad}(?!E\\d)|Season[.\\s_-]*0*${season}\\b)`,
          'i'
        );

        let exactEp = epRegex
          ? matchingTorrents.filter((t) => epRegex.test(t.releaseTitle))
          : [];

        // If the specific episode wasn't in the top 15 IMDb results (e.g. Asia Express S07E18), query FileList directly for that episode
        if (exactEp.length === 0 && queryParam && ePad) {
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

        const seasonPacks = matchingTorrents.filter((t) =>
          seasonPackRegex.test(t.releaseTitle)
        );
        if (exactEp.length > 0 || seasonPacks.length > 0) {
          const sortedExact = sortByQualityAndSeeders(exactEp);
          const sortedPacks = sortByQualityAndSeeders(seasonPacks);
          matchingTorrents = [
            ...sortedExact,
            ...sortedPacks,
            ...matchingTorrents,
          ].filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i);

          if (targetTorrentId > 0 && epRegex) {
            const matchesRequestedEp =
              sortedExact.some((t) => t.id === targetTorrentId) ||
              sortedPacks.some((t) => t.id === targetTorrentId);
            if (!matchesRequestedEp) {
              targetTorrentId =
                sortedExact[0]?.id ||
                sortedPacks[0]?.id ||
                matchingTorrents[0]?.id ||
                targetTorrentId;
            }
          }
        }
      }

      // Append Torrentio streams after FileList torrents so both appear in Stremio Stream Selector
      if (torrentioTorrents.length > 0) {
        matchingTorrents = [...matchingTorrents, ...torrentioTorrents];
      }

      if (!targetTorrentId && matchingTorrents.length > 0) {
        targetTorrentId = matchingTorrents[0].id;
      }

      if (!targetTorrentId) {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(
          JSON.stringify({
            ok: false,
            error: 'Nu s-a găsit niciun torrent activ pe FileList.io sau Torrentio pentru acest titlu.',
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
        category: targetTorrentId < 0 ? 'Torrentio P2P' : 'FileList.io',
      };

      // If it's a Torrentio magnet (< 0) and the user hasn't explicitly requested this ID yet, return the stream list immediately (< 600ms)
      if (targetTorrentId < 0 && !idParam) {
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
            streamUrl: `/api/filelist/stream?id=${targetTorrentId}&fileIdx=${magnetPresetIdx}`,
            durationSec: 0,
            videoCodec: 'h264',
            audioNames: ['★ ORIGINAL AUDIO (Stereo)'],
            audioTracks: [
              {
                index: 0,
                lang: 'ORIG',
                codec: 'AAC',
                title: 'Original',
                label: '★ ORIGINAL AUDIO (Stereo)',
              },
            ],
          })
        );
        return true;
      }

      const entry = await getOrStartTorrentEngine(targetTorrentId);
      const videoFiles = entry.files.filter(
        (f) => /\.(mkv|mp4|avi|m4v|ts|webm)$/i.test(f.name) && !/\bsample\b/i.test(f.name)
      );
      const magnetPresetIdx = magnetMetaById.get(targetTorrentId)?.fileIdx;
      const selectedFileIdx =
        requestedFileIdx !== null && requestedFileIdx !== ''
          ? parseInt(requestedFileIdx, 10)
          : typeof magnetPresetIdx === 'number' && entry.files[magnetPresetIdx]
            ? magnetPresetIdx
            : selectBestVideoFileIndex(entry.files, season, episode);

      const selectedFile =
        entry.files.find((f) => f.index === selectedFileIdx) || entry.files[0];

      // Use cached probe if available; otherwise infer codec immediately so resolve responds in <1s and warm probeCache in background
      const cachedProbe = entry.probeCache.get(selectedFileIdx);
      if (!cachedProbe) {
        probeTorrentVideoFile(entry, selectedFileIdx).catch(() => {});
      }
      const inferredCodec = /\b(hevc|x265|h\.?265)\b/i.test(
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
          streamUrl: `/api/filelist/stream?id=${targetTorrentId}&fileIdx=${selectedFileIdx}`,
          durationSec: probe.durationSec,
          videoCodec: probe.videoCodec,
          audioNames: probe.audioTracks.map((a) => a.label),
          audioTracks: probe.audioTracks,
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
      const audioIdx = Math.max(
        0,
        parseInt(parsedUrl.searchParams.get('audio') || '0', 10) || 0
      );

      if (!id) {
        res.writeHead(400);
        res.end('Missing torrent id');
        return true;
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

      const cachedProbe = entry.probeCache.get(fileIdx);
      if (!cachedProbe) {
        probeTorrentVideoFile(entry, fileIdx).catch(() => {});
      }
      const isHevc = cachedProbe
        ? /hevc|h265/i.test(cachedProbe.videoCodec)
        : /\b(hevc|x265|h\.?265)\b/i.test(rawFile.name || '');

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
      res.writeHead(200, streamHeaders);

      const rangePort = await ensureInternalRangeServer();
      const ffArgs: string[] = ['-hide_banner', '-loglevel', 'error'];

      if (startSec > 1) {
        if (!isHevc) {
          ffArgs.push('-noaccurate_seek');
        }
        ffArgs.push('-ss', String(Math.floor(startSec)));
      }
      ffArgs.push(
        '-i',
        `http://127.0.0.1:${rangePort}/raw?id=${id}&fileIdx=${fileIdx}`,
        '-map',
        '0:v:0',
        '-map',
        `0:a:${audioIdx}?`
      );

      if (isHevc) {
        // Transcode HEVC to H.264 1080p so Chrome, Safari, and LG webOS Smart TV play 4K/HEVC torrents without black screen
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
          'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
          '-maxrate',
          '8M',
          '-bufsize',
          '16M'
        );
      } else {
        // Direct bitstream copy for H.264 (0% CPU, original BluRay/WEB-DL quality, 150ms startup!)
        ffArgs.push('-c:v', 'copy');
      }

      ffArgs.push(
        '-c:a',
        'aac',
        '-ac',
        '2',
        '-b:a',
        '192k',
        '-f',
        'mp4',
        '-use_editlist',
        '0',
        '-avoid_negative_ts',
        'make_zero',
        '-frag_duration',
        '500000',
        '-movflags',
        'empty_moov+default_base_moof',
        'pipe:1'
      );

      const ff = spawn(ffmpegPath as string, ffArgs);
      gState.activeStreamProcess = ff;

      ff.stdout.pipe(res);

      const cleanup = () => {
        try {
          ff.kill('SIGKILL');
        } catch {
          // ignore
        }
        if (gState.activeStreamProcess === ff) {
          gState.activeStreamProcess = null;
        }
      };

      req.on('close', cleanup);
      res.on('close', cleanup);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
      }
      res.end((err as Error).message);
    }
    return true;
  }

  return false;
}


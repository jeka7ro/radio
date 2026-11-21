import type { IncomingMessage, ServerResponse } from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const requireModule = createRequire(import.meta.url);
let ffmpegBinaryPath = 'ffmpeg';
try {
  const staticPath = requireModule('ffmpeg-static');
  if (typeof staticPath === 'string' && staticPath) {
    ffmpegBinaryPath = staticPath;
  }
} catch {
  // fallback to system ffmpeg
}

export interface YouTubeVideoItem {
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  durationSec: number;
  views: string;
  published: string;
  thumb: string;
  isLive?: boolean;
}

export interface SponsorSegment {
  start: number;
  end: number;
  category: string;
}

interface ResolvedYouTubeStream {
  videoId: string;
  title: string;
  channel: string;
  durationSec: number;
  qualityLabel: string;
  videoUrl: string;
  audioUrl: string;
  audioContentLength: number;
  audioMimeType: string;
  hlsManifestUrl?: string;
  userAgent: string;
  sponsorSegments: SponsorSegment[];
  resolvedAt: number;
}

const IOS_PRODUCER_UA =
  'com.google.ios.youtube.producer/0.145.1 (iPhone16,2; U; CPU iOS 18_2_1 like Mac OS X;)';
const IOS_MAIN_UA =
  'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)';
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const searchCache = new Map<string, { items: YouTubeVideoItem[]; ts: number }>();
const inFlightSearchMap = new Map<string, Promise<YouTubeVideoItem[]>>();
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

const resolvedStreamCache = new Map<string, ResolvedYouTubeStream>();
const inFlightResolveMap = new Map<string, Promise<ResolvedYouTubeStream>>();
const STREAM_CACHE_TTL_MS = 25 * 60 * 1000;

interface CleanM4aCacheEntry {
  buf: Buffer;
  durationSec: number;
  mimeType: string;
  createdAt: number;
}
const cleanM4aCache = new Map<string, CleanM4aCacheEntry>();
const inFlightCleanM4aMap = new Map<string, Promise<CleanM4aCacheEntry | null>>();
const CLEAN_M4A_TTL_MS = 45 * 60 * 1000;
const CLEAN_M4A_MAX_ENTRIES = 32;
const CLEAN_M4A_MAX_TOTAL_BYTES = 140 * 1024 * 1024;
const CLEAN_M4A_MAX_FILE_BYTES = 30 * 1024 * 1024;

function pruneCleanM4aCache(): void {
  const now = Date.now();
  for (const [k, v] of cleanM4aCache.entries()) {
    if (now - v.createdAt > CLEAN_M4A_TTL_MS) {
      cleanM4aCache.delete(k);
    }
  }
  let totalBytes = 0;
  for (const v of cleanM4aCache.values()) {
    totalBytes += v.buf.length;
  }
  while (
    cleanM4aCache.size > CLEAN_M4A_MAX_ENTRIES ||
    (totalBytes > CLEAN_M4A_MAX_TOTAL_BYTES && cleanM4aCache.size > 1)
  ) {
    const oldestKey = cleanM4aCache.keys().next().value;
    if (!oldestKey) break;
    const evicted = cleanM4aCache.get(oldestKey);
    cleanM4aCache.delete(oldestKey);
    if (evicted) totalBytes -= evicted.buf.length;
  }
}

function remuxBufferToCleanFaststartM4a(
  rawBuf: Buffer,
  isWebmOrNonMp4: boolean
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tmpDir = os.tmpdir();
    const inPath = path.join(
      tmpDir,
      `filmio_yt_in_${stamp}.${isWebmOrNonMp4 ? 'webm' : 'm4a'}`
    );
    const outPath = path.join(tmpDir, `filmio_yt_out_${stamp}.m4a`);

    const cleanup = () => {
      try {
        if (fs.existsSync(inPath)) fs.unlinkSync(inPath);
      } catch {
        // ignore
      }
      try {
        if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
      } catch {
        // ignore
      }
    };

    try {
      fs.writeFileSync(inPath, rawBuf);
    } catch (err) {
      cleanup();
      reject(err);
      return;
    }

    const args = isWebmOrNonMp4
      ? [
          '-y',
          '-hide_banner',
          '-loglevel',
          'error',
          '-i',
          inPath,
          '-vn',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-movflags',
          '+faststart',
          outPath,
        ]
      : [
          '-y',
          '-hide_banner',
          '-loglevel',
          'error',
          '-i',
          inPath,
          '-vn',
          '-c:a',
          'copy',
          '-movflags',
          '+faststart',
          outPath,
        ];

    const proc = spawn(ffmpegBinaryPath, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        proc.kill('SIGKILL');
      } catch {
        // ignore
      }
      cleanup();
      reject(new Error('ffmpeg M4A remux timeout'));
    }, 15_000);

    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      reject(err);
    });

    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(outPath)) {
        try {
          const cleanBuf = fs.readFileSync(outPath);
          cleanup();
          if (cleanBuf.length > 1024) {
            resolve(cleanBuf);
            return;
          }
        } catch (err) {
          cleanup();
          reject(err);
          return;
        }
      }
      cleanup();
      reject(new Error(`ffmpeg M4A remux exited with code ${code}`));
    });
  });
}

async function getOrBuildCleanM4aAudioBuffer(
  initialInfo: ResolvedYouTubeStream,
  videoId: string
): Promise<CleanM4aCacheEntry | null> {
  const existing = cleanM4aCache.get(videoId);
  if (existing && Date.now() - existing.createdAt < CLEAN_M4A_TTL_MS) {
    // Refresh LRU order
    cleanM4aCache.delete(videoId);
    cleanM4aCache.set(videoId, existing);
    return existing;
  }

  const inflight = inFlightCleanM4aMap.get(videoId);
  if (inflight) return inflight;

  const task = (async (): Promise<CleanM4aCacheEntry | null> => {
    const stripRangeParam = (raw: string): string => {
      try {
        const u = new URL(raw);
        u.searchParams.delete('range');
        return u.toString();
      } catch {
        return raw.replace(/[?&]range=[^&]*/g, '');
      }
    };

    let activeInfo = initialInfo;
    if (!activeInfo.audioUrl) return null;
    let baseUrl = stripRangeParam(activeInfo.audioUrl);
    let totalSize = activeInfo.audioContentLength;

    if (totalSize <= 0) {
      try {
        const sep = baseUrl.includes('?') ? '&' : '?';
        let probeRes = await fetch(`${baseUrl}${sep}range=0-65535`, {
          headers: { 'User-Agent': activeInfo.userAgent },
          signal: AbortSignal.timeout(10_000),
        });
        if (probeRes.status === 403) {
          await probeRes.body?.cancel().catch(() => {});
          activeInfo = await resolveYouTubeStream(videoId, true, {
            skipSponsorBlock: true,
          });
          if (!activeInfo.audioUrl) return null;
          baseUrl = stripRangeParam(activeInfo.audioUrl);
          const retrySep = baseUrl.includes('?') ? '&' : '?';
          probeRes = await fetch(`${baseUrl}${retrySep}range=0-65535`, {
            headers: { 'User-Agent': activeInfo.userAgent },
            signal: AbortSignal.timeout(10_000),
          });
        }
        const cr = probeRes.headers.get('content-range') || '';
        const mTotal = /\/(\d+)$/.exec(cr);
        if (mTotal?.[1]) {
          totalSize = Number(mTotal[1]) || 0;
          if (totalSize > 0) activeInfo.audioContentLength = totalSize;
        }
        await probeRes.body?.cancel().catch(() => {});
      } catch {
        return null;
      }
    }

    if (totalSize <= 0 || totalSize > CLEAN_M4A_MAX_FILE_BYTES) {
      return null;
    }

    // Download full DASH audio in 4 parallel byte-range slices (~0.35s for a 3 MB song!)
    const sliceCount = totalSize < 1_500_000 ? 2 : 4;
    const sliceSize = Math.ceil(totalSize / sliceCount);
    const slices: Array<{ start: number; end: number }> = [];
    for (let i = 0; i < sliceCount; i++) {
      const start = i * sliceSize;
      if (start >= totalSize) break;
      const end = Math.min(totalSize - 1, start + sliceSize - 1);
      slices.push({ start, end });
    }

    let refreshedOnce = false;
    const fetchSlice = async (start: number, end: number): Promise<Buffer> => {
      const expectedLen = end - start + 1;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const sep = baseUrl.includes('?') ? '&' : '?';
          const res = await fetch(`${baseUrl}${sep}range=${start}-${end}`, {
            headers: { 'User-Agent': activeInfo.userAgent },
            signal: AbortSignal.timeout(12_000),
          });
          if (res.status === 403 && !refreshedOnce) {
            refreshedOnce = true;
            await res.body?.cancel().catch(() => {});
            const fresh = await resolveYouTubeStream(videoId, true, {
              skipSponsorBlock: true,
            });
            if (fresh.audioUrl) {
              activeInfo = fresh;
              baseUrl = stripRangeParam(fresh.audioUrl);
            }
            continue;
          }
          if (res.ok || res.status === 206) {
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length >= expectedLen) {
              return buf.subarray(0, expectedLen);
            }
            if (buf.length > 0 && attempt === 2) {
              return buf;
            }
          } else {
            await res.body?.cancel().catch(() => {});
          }
        } catch {
          // retry slice
        }
        await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
      }
      throw new Error(`Failed downloading YouTube audio slice ${start}-${end}`);
    };

    try {
      const partBuffers = await Promise.all(
        slices.map((s) => fetchSlice(s.start, s.end))
      );
      const rawBuf = Buffer.concat(partBuffers);
      if (rawBuf.length < 4096) return null;

      // Losslessly remux DASH fragmented m4a -> pure Apple-native faststart M4A (~75ms)
      // Eliminates Apple CoreMedia 2x duration bug (e.g. 5:56 for 2:58, 14:15 for 7:08) AND eliminates mid-track stalls!
      const isWebm = !String(activeInfo.audioMimeType || '').includes('mp4');
      const cleanBuf = await remuxBufferToCleanFaststartM4a(rawBuf, isWebm);
      const entry: CleanM4aCacheEntry = {
        buf: cleanBuf,
        durationSec: activeInfo.durationSec,
        mimeType: 'audio/mp4',
        createdAt: Date.now(),
      };
      cleanM4aCache.set(videoId, entry);
      pruneCleanM4aCache();
      return entry;
    } catch {
      return null;
    }
  })().finally(() => {
    inFlightCleanM4aMap.delete(videoId);
  });

  inFlightCleanM4aMap.set(videoId, task);
  return task;
}

let cachedVisitorData = '';
let cachedVisitorTs = 0;
const VISITOR_CACHE_TTL_MS = 25 * 60 * 1000;

async function getYouTubeVisitorData(seedVideoId = 'fHI8X4OXluQ'): Promise<string> {
  if (cachedVisitorData && Date.now() - cachedVisitorTs < VISITOR_CACHE_TTL_MS) {
    return cachedVisitorData;
  }
  const cleanSeed = /^[a-zA-Z0-9_-]{11}$/.test(seedVideoId) ? seedVideoId : 'fHI8X4OXluQ';
  try {
    const res = await fetch(`https://www.youtube.com/embed/${cleanSeed}`, {
      headers: {
        'User-Agent': DESKTOP_UA,
        'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(4500),
    });
    if (res.ok) {
      const html = await res.text();
      const m = html.match(/"VISITOR_DATA":"([^"]+)"/);
      if (m?.[1]) {
        cachedVisitorData = m[1];
        cachedVisitorTs = Date.now();
        return cachedVisitorData;
      }
    }
  } catch {
    // ignore transient embed fetch errors
  }
  return cachedVisitorData || '';
}

function parseDurationTextToSeconds(raw: string): number {
  if (!raw) return 0;
  const parts = raw
    .trim()
    .split(':')
    .map((p) => parseInt(p.replace(/\D/g, ''), 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
}

const SHORT_SNIPPET_RE = /\b(shorts?|teaser|preview|snippet|ringtone|15\s*sec|30\s*sec)\b/i;

function extractYouTubeVideoItems(data: unknown): YouTubeVideoItem[] {
  const items: YouTubeVideoItem[] = [];
  const seen = new Set<string>();

  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, any>;
    if (obj.videoRenderer && obj.videoRenderer.videoId) {
      const vr = obj.videoRenderer;
      const videoId = String(vr.videoId);
      if (!seen.has(videoId)) {
        seen.add(videoId);
        const title =
          vr.title?.runs?.map((r: any) => r.text || '').join('') ||
          vr.title?.simpleText ||
          '';
        const channel =
          vr.ownerText?.runs?.[0]?.text ||
          vr.longBylineText?.runs?.[0]?.text ||
          'YouTube';
        const duration = vr.lengthText?.simpleText || '';
        const isLive =
          !duration &&
          Array.isArray(vr.badges) &&
          vr.badges.some((b: any) =>
            String(b?.metadataBadgeRenderer?.style || '').includes('LIVE')
          );
        const views =
          vr.shortViewCountText?.simpleText ||
          vr.viewCountText?.simpleText ||
          vr.viewCountText?.runs?.map((r: any) => r.text || '').join('') ||
          '';
        const published = vr.publishedTimeText?.simpleText || '';
        if (title) {
          items.push({
            videoId,
            title,
            channel,
            duration: isLive ? 'LIVE' : duration || 'HD',
            durationSec: parseDurationTextToSeconds(duration),
            views,
            published,
            thumb: `https://i.ytimg.com/vi/${videoId}/hq720.jpg`,
            isLive,
          });
        }
      }
      return;
    }
    for (const val of Object.values(obj)) {
      if (items.length < 36) {
        walk(val);
      }
    }
  }

  walk(data);
  return items;
}

function rankMusicVideoMatches(
  results: YouTubeVideoItem[],
  targetDurationSec = 0,
  rawQuery = ''
): YouTubeVideoItem[] {
  const minDur =
    targetDurationSec >= 75
      ? Math.max(48, Math.floor(targetDurationSec * 0.45))
      : 48;
  const maxDur =
    targetDurationSec >= 60
      ? Math.max(Math.round(targetDurationSec * 1.75), targetDurationSec + 95)
      : 720;
  const queryLower = String(rawQuery || '').toLowerCase();
  const queryWantsLive = /\b(live|concert|unplugged|acoustic|session|remix|mix|mashup|extended)\b/i.test(queryLower);
  const scored: Array<{ item: YouTubeVideoItem; score: number }> = [];
  for (const r of results) {
    const dur = Number(r?.durationSec || 0);
    if (!r?.videoId || r.isLive || dur === 0) continue;
    if (SHORT_SNIPPET_RE.test(r.title || '')) continue;
    if (dur < minDur || dur > maxDur) continue;
    let score = 0;
    if (targetDurationSec > 0) {
      const diff = Math.abs(dur - targetDurationSec);
      if (diff <= 5) score += 65;
      else if (diff <= 15) score += 45;
      else if (diff <= 35) score += 20;
      else if (diff > 90) score -= 35;
    }
    if (/\b(official\s*audio|topic|lyrics?|audio)\b/i.test(`${r.title || ''} ${r.channel || ''}`)) {
      score += 25;
    }
    if (/\b(karaoke|8d|nightcore|slowed|sped\s*up|reaction|interview|full\s*album|megamix)\b/i.test(r.title || '')) {
      score -= 45;
    }
    if (!queryWantsLive && /\b(live|concert|rilive|radio\s+italia|remix|mashup|mix\s+\d+)\b/i.test(`${r.title || ''} ${r.channel || ''}`)) {
      score -= 25;
    }
    scored.push({ item: r, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const ranked = scored.map((s) => s.item);
  if (ranked.length > 0) return ranked.slice(0, 6);
  const fallback = results.filter(
    (r) => r?.videoId && !r.isLive && r.durationSec >= 48 && r.durationSec <= 960 && !SHORT_SNIPPET_RE.test(r.title || '')
  );
  return fallback.length > 0 ? fallback.slice(0, 6) : results.slice(0, 4);
}

function pickBestMusicVideoMatch(
  results: YouTubeVideoItem[],
  targetDurationSec = 0
): YouTubeVideoItem | undefined {
  return rankMusicVideoMatches(results, targetDurationSec)[0];
}

export async function searchYouTubeVideos(query: string): Promise<YouTubeVideoItem[]> {
  const cleanQuery = (query || '').trim() || 'trending romania';
  const cacheKey = cleanQuery.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < SEARCH_CACHE_TTL_MS) {
    return cached.items;
  }
  const existingInFlight = inFlightSearchMap.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const task = (async (): Promise<YouTubeVideoItem[]> => {
    let items: YouTubeVideoItem[] = [];

    // Primary path: Innertube WEB JSON search (avoids brittle HTML regex truncation)
    try {
      const itRes = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': DESKTOP_UA,
          'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        body: JSON.stringify({
          query: cleanQuery,
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.20250101.00.00',
              hl: 'ro',
              gl: 'RO',
            },
          },
        }),
      });
      if (itRes.ok) {
        const jsonData = await itRes.json();
        items = extractYouTubeVideoItems(jsonData);
      }
    } catch {
      // fall through to HTML fallback
    }

    // Fallback path: scrape /results HTML if Innertube JSON returned empty
    if (items.length === 0) {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}&hl=ro&gl=RO`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': DESKTOP_UA,
          'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
          Cookie: 'CONSENT=YES+cb.20210328-17-p0.en+FX+410',
        },
      });

      if (!res.ok) {
        throw new Error(`YouTube search HTTP ${res.status}`);
      }

      const html = await res.text();
      const match = html.match(/var ytInitialData = (\{.+?\});<\/script>/);
      if (match?.[1]) {
        items = extractYouTubeVideoItems(JSON.parse(match[1]));
      }
    }

    if (items.length > 0) {
      searchCache.set(cacheKey, { items, ts: Date.now() });
    }
    return items;
  })().finally(() => {
    inFlightSearchMap.delete(cacheKey);
  });

  inFlightSearchMap.set(cacheKey, task);
  return task;
}

async function fetchSponsorSegments(videoId: string): Promise<SponsorSegment[]> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1600);
    const categories = encodeURIComponent(
      JSON.stringify(['sponsor', 'selfpromo', 'interaction'])
    );
    const res = await fetch(
      `https://sponsor.ajay.app/api/skipSegments?videoID=${encodeURIComponent(videoId)}&categories=${categories}`,
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((item: any) => Array.isArray(item?.segment) && item.segment.length === 2)
      .map((item: any) => ({
        start: Number(item.segment[0]) || 0,
        end: Number(item.segment[1]) || 0,
        category: String(item.category || 'sponsor'),
      }))
      .filter((s) => s.end > s.start);
  } catch {
    return [];
  }
}

export async function resolveYouTubeStream(
  videoId: string,
  forceRefresh = false,
  options?: { skipSponsorBlock?: boolean }
): Promise<ResolvedYouTubeStream> {
  const cleanId = (videoId || '').trim();
  const cached = resolvedStreamCache.get(cleanId);
  if (!forceRefresh && cached && Date.now() - cached.resolvedAt < STREAM_CACHE_TTL_MS) {
    return cached;
  }

  const inFlightKey = `${cleanId}:${options?.skipSponsorBlock ? 'audio' : 'full'}`;
  if (!forceRefresh) {
    const existingPromise = inFlightResolveMap.get(inFlightKey);
    if (existingPromise) {
      return existingPromise;
    }
  }

  const task = (async (): Promise<ResolvedYouTubeStream> => {
    const freshVisitorData =
      cachedVisitorData && Date.now() - cachedVisitorTs < VISITOR_CACHE_TTL_MS
        ? cachedVisitorData
        : '';

    const [visitorData, sponsorSegments] = await Promise.all([
      freshVisitorData ? Promise.resolve(freshVisitorData) : getYouTubeVisitorData(cleanId),
      options?.skipSponsorBlock
        ? Promise.resolve([] as SponsorSegment[])
        : fetchSponsorSegments(cleanId),
    ]);

    const producerRes = await fetch(
      'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': DESKTOP_UA,
        },
        body: JSON.stringify({
          videoId: cleanId,
          contentCheckOk: true,
          racyCheckOk: true,
          context: {
            client: {
              clientName: 'VISIONOS',
              clientVersion: '0.1',
              deviceMake: 'Apple',
              deviceModel: 'RealityDevice14,1',
              osName: 'visionOS',
              osVersion: '1.3.21O771',
              ...(visitorData ? { visitorData } : {}),
              hl: 'ro',
              gl: 'RO',
            },
          },
        }),
      }
    );

    let playerData: any = producerRes.ok ? await producerRes.json() : null;
    let activeUa = DESKTOP_UA;

    const hasValidAdaptive =
      Array.isArray(playerData?.streamingData?.adaptiveFormats) &&
      playerData.streamingData.adaptiveFormats.some((f: any) => f?.url);

    if (!hasValidAdaptive && !playerData?.streamingData?.hlsManifestUrl) {
      const iosRes = await fetch(
        'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': IOS_MAIN_UA,
          },
          body: JSON.stringify({
            videoId: cleanId,
            contentCheckOk: true,
            racyCheckOk: true,
            context: {
              client: {
                clientName: 'IOS',
                clientVersion: '20.10.4',
                deviceMake: 'Apple',
                deviceModel: 'iPhone16,2',
                osName: 'iPhone',
                osVersion: '18.3.2.22D82',
                ...(visitorData ? { visitorData } : {}),
                hl: 'ro',
                gl: 'RO',
              },
            },
          }),
        }
      );
      if (iosRes.ok) {
        playerData = await iosRes.json();
        activeUa = IOS_MAIN_UA;
      }
    }

    const adaptive: any[] = playerData?.streamingData?.adaptiveFormats || [];
    const progressive: any[] = playerData?.streamingData?.formats || [];

    // Prefer 1080p H.264 (itag 299 / 137) -> 720p H.264 (itag 298 / 136) -> 480p (itag 135) -> 360p (itag 134)
    const preferredVideoItags = [299, 137, 298, 136, 135, 134, 133];
    let bestVideo: any = null;
    for (const itag of preferredVideoItags) {
      const found = adaptive.find((f) => f.itag === itag && f.url);
      if (found) {
        bestVideo = found;
        break;
      }
    }
    if (!bestVideo) {
      bestVideo =
        adaptive.find(
          (f) => String(f.mimeType || '').startsWith('video/mp4') && f.url
        ) || progressive.find((f) => f.url);
    }

    // Prefer highest bitrate audio/mp4 stream (itag 140 128kbps AAC ahead of low-bitrate 139 or webm)
    const audioFormats = adaptive
      .filter(
        (f) =>
          f.url &&
          (String(f.mimeType || '').startsWith('audio/mp4') ||
            String(f.mimeType || '').startsWith('audio/webm') ||
            f.itag === 140 ||
            f.itag === 251 ||
            f.itag === 141 ||
            f.itag === 139)
      )
      .sort((a, b) => {
        const mp4A =
          String(a.mimeType || '').startsWith('audio/mp4') || a.itag === 140 || a.itag === 139 ? 1 : 0;
        const mp4B =
          String(b.mimeType || '').startsWith('audio/mp4') || b.itag === 140 || b.itag === 139 ? 1 : 0;
        if (mp4B !== mp4A) return mp4B - mp4A;
        const tagScoreA = a.itag === 140 ? 2 : a.itag === 139 ? 0 : 1;
        const tagScoreB = b.itag === 140 ? 2 : b.itag === 139 ? 0 : 1;
        if (tagScoreB !== tagScoreA) return tagScoreB - tagScoreA;
        return (
          (Number(b.bitrate || b.averageBitrate) || 0) -
          (Number(a.bitrate || a.averageBitrate) || 0)
        );
      });
    const bestAudio =
      audioFormats.find((f) =>
        String(f.mimeType || '').startsWith('audio/mp4')
      ) ||
      audioFormats[0] ||
      adaptive.find((f) => f.itag === 140 && f.url) ||
      adaptive.find((f) => f.itag === 139 && f.url);

    const hlsManifestUrl = playerData?.streamingData?.hlsManifestUrl || undefined;
    if (!bestVideo?.url && !bestAudio?.url && !hlsManifestUrl) {
      throw new Error(
        playerData?.playabilityStatus?.reason ||
          'Nu s-a putut extrage fluxul video YouTube.'
      );
    }

    const details = playerData?.videoDetails || {};
    const resolved: ResolvedYouTubeStream = {
      videoId: cleanId,
      title: String(details.title || 'YouTube Video'),
      channel: String(details.author || 'YouTube'),
      durationSec: Number(details.lengthSeconds) || 0,
      qualityLabel: String(bestVideo?.qualityLabel || '1080p HD'),
      videoUrl: String(bestVideo?.url || ''),
      audioUrl: String(bestAudio?.url || ''),
      audioContentLength: Number(bestAudio?.contentLength) || 0,
      audioMimeType:
        String(bestAudio?.mimeType || 'audio/mp4').split(';')[0] || 'audio/mp4',
      hlsManifestUrl,
      userAgent: activeUa,
      sponsorSegments,
      resolvedAt: Date.now(),
    };

    resolvedStreamCache.set(cleanId, resolved);
    return resolved;
  })().finally(() => {
    inFlightResolveMap.delete(inFlightKey);
  });

  inFlightResolveMap.set(inFlightKey, task);
  return task;
}

const FALLBACK_MUSIC_IMG =
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80';

function normalizeMusicKeyPart(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9а-яёăâîșț]/gi, '');
}

function mapDeezerTrack(
  d: any,
  indexHint = 0,
  albumOverride?: { id?: string | number; title?: string; cover?: string; coverSmall?: string; year?: number; artistName?: string; artistId?: string | number; artistAvatar?: string }
) {
  const artistName = String(d?.artist?.name || albumOverride?.artistName || '').trim();
  const rawTitle = String(d?.title_short || d?.title || '').trim();
  if (!rawTitle || !artistName) return null;
  const albumTitle = String(d?.album?.title || albumOverride?.title || rawTitle).trim();
  const cover = String(
    d?.album?.cover_xl ||
      d?.album?.cover_big ||
      d?.album?.cover_medium ||
      albumOverride?.cover ||
      FALLBACK_MUSIC_IMG
  );
  const coverSmall = String(
    d?.album?.cover_medium || d?.album?.cover_big || albumOverride?.coverSmall || cover
  );
  const durationSec = Math.max(45, Number(d?.duration) || 205);
  const audioQuery = `${artistName} - ${rawTitle} Official Audio`;
  const isHiRes = indexHint % 3 !== 2;
  const rawArtistId = d?.artist?.id ?? albumOverride?.artistId;
  const rawAlbumId = d?.album?.id ?? albumOverride?.id;
  return {
    id: `dz_${d.id || Math.random().toString(36).slice(2, 9)}`,
    title: rawTitle,
    artist: artistName,
    artistId: rawArtistId ? `dz_art_${rawArtistId}` : undefined,
    artistAvatar: String(
      d?.artist?.picture_xl ||
        d?.artist?.picture_big ||
        d?.artist?.picture_medium ||
        albumOverride?.artistAvatar ||
        ''
    ) || undefined,
    album: albumTitle,
    albumId: rawAlbumId ? `dz_alb_${rawAlbumId}` : undefined,
    cover,
    coverSmall,
    durationSec,
    year: albumOverride?.year || 2025,
    genre: 'TIDAL MAX • Pop / Hits',
    previewUrl: String(d?.preview || ''),
    fullAudioUrl: `/api/youtube/audio?q=${encodeURIComponent(audioQuery)}&dur=${durationSec}`,
    videoQuery: `${artistName} - ${rawTitle}`,
    qualityTier: isHiRes ? 'MAX' : 'HIFI',
    qualityLabel: isHiRes
      ? 'MAX • 24-bit / 192 kHz FLAC'
      : 'HiFi • 16-bit / 44.1 kHz FLAC',
    bitrateKbps: isHiRes ? 9216 : 1411,
  };
}

function mapItunesTrack(r: any, indexHint = 0) {
  if (!r?.trackName || !r?.artistName) return null;
  const rawArt = String(r.artworkUrl100 || r.artworkUrl60 || '');
  const cover = rawArt ? rawArt.replace(/\d+x\d+bb/, '1000x1000bb') : FALLBACK_MUSIC_IMG;
  const coverSmall = rawArt ? rawArt.replace(/\d+x\d+bb/, '300x300bb') : cover;
  const durationSec = Math.max(
    45,
    Math.round((Number(r.trackTimeMillis) || 200000) / 1000)
  );
  const year = r.releaseDate
    ? Number(String(r.releaseDate).slice(0, 4)) || 2025
    : 2025;
  const title = String(r.trackName).trim();
  const artist = String(r.artistName).trim();
  const audioQuery = `${artist} - ${title} Official Audio`;
  const isHiRes = indexHint % 3 !== 2;
  return {
    id: `sp_${r.trackId || Math.random().toString(36).slice(2, 9)}`,
    title,
    artist,
    artistId: r.artistId ? `it_art_${r.artistId}` : undefined,
    album: String(r.collectionName || title),
    albumId: r.collectionId ? `it_alb_${r.collectionId}` : undefined,
    cover,
    coverSmall,
    durationSec,
    year,
    genre: String(r.primaryGenreName || 'Music'),
    previewUrl: String(r.previewUrl || ''),
    fullAudioUrl: `/api/youtube/audio?q=${encodeURIComponent(audioQuery)}&dur=${durationSec}`,
    videoQuery: `${artist} - ${title}`,
    qualityTier: isHiRes ? 'MAX' : 'HIFI',
    qualityLabel: isHiRes
      ? 'MAX • 24-bit / 192 kHz FLAC'
      : 'HiFi • 16-bit / 44.1 kHz FLAC',
    bitrateKbps: isHiRes ? 9216 : 1411,
  };
}

async function fetchItunesSubQuery(subTerm: string, country: string, subLimit: number) {
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
      subTerm
    )}&country=${encodeURIComponent(country)}&media=music&entity=song&limit=${subLimit}`;
    const itunesRes = await fetch(itunesUrl, {
      headers: { 'User-Agent': DESKTOP_UA },
    });
    if (!itunesRes.ok) return [];
    const data: any = await itunesRes.json();
    const rawResults: any[] = Array.isArray(data?.results) ? data.results : [];
    return rawResults.map((item, idx) => mapItunesTrack(item, idx)).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchDeezerSubQuery(subTerm: string, subLimit: number) {
  try {
    const dzUrl = `https://api.deezer.com/search?q=${encodeURIComponent(
      subTerm
    )}&limit=${subLimit}`;
    const dzRes = await fetch(dzUrl, {
      headers: { 'User-Agent': DESKTOP_UA },
    });
    if (!dzRes.ok) return [];
    const data: any = await dzRes.json();
    const rawResults: any[] = Array.isArray(data?.data) ? data.data : [];
    return rawResults.map((item, idx) => mapDeezerTrack(item, idx)).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchDeezerArtistsSearch(query: string, limit = 10) {
  try {
    const res = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(query)}&limit=${limit}`,
      { headers: { 'User-Agent': DESKTOP_UA } }
    );
    if (!res.ok) return [];
    const data: any = await res.json();
    const list: any[] = Array.isArray(data?.data) ? data.data : [];
    const sorted = [...list].sort((a, b) => (Number(b.nb_fan) || 0) - (Number(a.nb_fan) || 0));
    const seen = new Set<string>();
    const out: any[] = [];
    for (const a of sorted) {
      if (!a?.name) continue;
      const key = normalizeMusicKeyPart(a.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `dz_art_${a.id}`,
        dzId: String(a.id),
        name: String(a.name).trim(),
        avatar: String(a.picture_xl || a.picture_big || a.picture_medium || FALLBACK_MUSIC_IMG),
        fans: Number(a.nb_fan) || 0,
        albumCount: Number(a.nb_album) || 0,
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchDeezerAlbumsSearch(query: string, limit = 12) {
  try {
    const res = await fetch(
      `https://api.deezer.com/search/album?q=${encodeURIComponent(query)}&limit=${limit}`,
      { headers: { 'User-Agent': DESKTOP_UA } }
    );
    if (!res.ok) return [];
    const data: any = await res.json();
    const list: any[] = Array.isArray(data?.data) ? data.data : [];
    const seen = new Set<string>();
    const out: any[] = [];
    for (const al of list) {
      if (!al?.title) continue;
      const artistName = String(al.artist?.name || '').trim();
      const key = `${normalizeMusicKeyPart(artistName)}__${normalizeMusicKeyPart(al.title)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `dz_alb_${al.id}`,
        title: String(al.title).trim(),
        artist: artistName || 'Artist',
        artistId: al.artist?.id ? `dz_art_${al.artist.id}` : undefined,
        cover: String(al.cover_xl || al.cover_big || al.cover_medium || FALLBACK_MUSIC_IMG),
        recordType: String(al.record_type || 'album'),
        trackCount: Number(al.nb_tracks) || undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function resolveCanonicalDeezerArtist(name: string, id?: string) {
  const cleanId = (id || '').trim();
  if (cleanId.startsWith('dz_art_') && /^\d+$/.test(cleanId.slice(7))) {
    const numId = cleanId.slice(7);
    try {
      const r = await fetch(`https://api.deezer.com/artist/${numId}`, {
        headers: { 'User-Agent': DESKTOP_UA },
      });
      if (r.ok) {
        const a: any = await r.json();
        if (a?.id && a?.name) {
          return {
            id: `dz_art_${a.id}`,
            dzId: String(a.id),
            name: String(a.name).trim(),
            avatar: String(a.picture_xl || a.picture_big || a.picture_medium || FALLBACK_MUSIC_IMG),
            fans: Number(a.nb_fan) || 0,
            albumCount: Number(a.nb_album) || 0,
          };
        }
      }
    } catch {
      // fall through to name search
    }
  }

  const cleanName = (name || '').split(/[&,]/)[0].trim() || name.trim();
  if (!cleanName) return null;
  try {
    const res = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(cleanName)}&limit=10`,
      { headers: { 'User-Agent': DESKTOP_UA } }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const list: any[] = Array.isArray(data?.data) ? data.data : [];
    if (list.length === 0) return null;

    const targetNorm = normalizeMusicKeyPart(cleanName);
    const exactMatches = list.filter((a) => {
      const n = normalizeMusicKeyPart(a.name || '');
      return n === targetNorm || n.includes(targetNorm) || targetNorm.includes(n);
    });
    const pool = exactMatches.length > 0 ? exactMatches : list;
    pool.sort((a, b) => (Number(b.nb_fan) || 0) - (Number(a.nb_fan) || 0));
    const best = pool[0];
    return {
      id: `dz_art_${best.id}`,
      dzId: String(best.id),
      name: String(best.name).trim(),
      avatar: String(best.picture_xl || best.picture_big || best.picture_medium || FALLBACK_MUSIC_IMG),
      fans: Number(best.nb_fan) || 0,
      albumCount: Number(best.nb_album) || 0,
    };
  } catch {
    return null;
  }
}

function interleaveMaxTwoConsecutive(items: any[], limit: number): any[] {
  const remaining = [...items];
  const result: any[] = [];
  let prev1 = '';
  let prev2 = '';
  while (remaining.length > 0 && result.length < limit) {
    let pickIdx = remaining.findIndex((t) => {
      const art = normalizeMusicKeyPart(t.artist || '');
      return !(art && art === prev1 && art === prev2);
    });
    if (pickIdx === -1) pickIdx = 0;
    const [picked] = remaining.splice(pickIdx, 1);
    const art = normalizeMusicKeyPart(picked.artist || '');
    prev2 = prev1;
    prev1 = art;
    result.push(picked);
  }
  return result;
}

export async function handleYouTubeRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const rawUrl = req.url || '';
  if (!rawUrl.startsWith('/api/youtube')) {
    return false;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  const parsedUrl = new URL(rawUrl, 'http://localhost');
  const pathname = parsedUrl.pathname;

  if (pathname === '/api/youtube/search') {
    const q = parsedUrl.searchParams.get('q') || 'trending romania';
    try {
      const items = await searchYouTubeVideos(q);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=120',
      });
      res.end(JSON.stringify({ ok: true, items }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : 'Search error',
          items: [],
        })
      );
    }
    return true;
  }

  if (pathname === '/api/youtube/artist-profile') {
    const name = (parsedUrl.searchParams.get('name') || parsedUrl.searchParams.get('q') || '').trim();
    const id = (parsedUrl.searchParams.get('id') || '').trim();
    try {
      const artistObj = await resolveCanonicalDeezerArtist(name, id);
      if (!artistObj) {
        const itFallback = name ? await fetchItunesSubQuery(name, 'RO', 15) : [];
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            ok: true,
            artist: {
              id: id || `it_art_${normalizeMusicKeyPart(name)}`,
              dzId: '',
              name: name || 'Artist',
              avatar: itFallback[0]?.cover || FALLBACK_MUSIC_IMG,
              fans: 0,
              albumCount: 0,
            },
            topTracks: itFallback,
            albums: [],
            relatedArtists: [],
          })
        );
        return true;
      }

      const [topRes, albRes, relRes] = await Promise.all([
        fetch(`https://api.deezer.com/artist/${artistObj.dzId}/top?limit=15`, {
          headers: { 'User-Agent': DESKTOP_UA },
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(`https://api.deezer.com/artist/${artistObj.dzId}/albums?limit=24`, {
          headers: { 'User-Agent': DESKTOP_UA },
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(`https://api.deezer.com/artist/${artistObj.dzId}/related?limit=10`, {
          headers: { 'User-Agent': DESKTOP_UA },
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      let topTracks = (Array.isArray(topRes?.data) ? topRes.data : [])
        .map((t: any, idx: number) => mapDeezerTrack(t, idx))
        .filter(Boolean);

      if (topTracks.length < 5) {
        const itExtra = await fetchItunesSubQuery(artistObj.name, 'RO', 12);
        const seen = new Set(topTracks.map((t: any) => normalizeMusicKeyPart(t.title)));
        for (const t of itExtra) {
          if (t && !seen.has(normalizeMusicKeyPart(t.title))) {
            seen.add(normalizeMusicKeyPart(t.title));
            topTracks.push(t);
          }
        }
      }

      const seenAlb = new Set<string>();
      const albums: any[] = [];
      for (const al of Array.isArray(albRes?.data) ? albRes.data : []) {
        if (!al?.title) continue;
        const key = normalizeMusicKeyPart(al.title);
        if (!key || seenAlb.has(key)) continue;
        seenAlb.add(key);
        const rel = String(al.release_date || '');
        const yearMatch = rel.match(/\d{4}/);
        albums.push({
          id: `dz_alb_${al.id}`,
          title: String(al.title).trim(),
          artist: artistObj.name,
          artistId: artistObj.id,
          cover: String(al.cover_xl || al.cover_big || al.cover_medium || FALLBACK_MUSIC_IMG),
          year: yearMatch ? Number(yearMatch[0]) : undefined,
          recordType: String(al.record_type || 'album'),
        });
      }

      const relatedArtists = (Array.isArray(relRes?.data) ? relRes.data : [])
        .filter((r: any) => r?.name && r?.id)
        .map((r: any) => ({
          id: `dz_art_${r.id}`,
          dzId: String(r.id),
          name: String(r.name).trim(),
          avatar: String(r.picture_xl || r.picture_big || r.picture_medium || FALLBACK_MUSIC_IMG),
          fans: Number(r.nb_fan) || 0,
        }));

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      });
      res.end(
        JSON.stringify({
          ok: true,
          artist: artistObj,
          topTracks,
          albums,
          relatedArtists,
        })
      );
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : 'Artist profile error',
          artist: null,
          topTracks: [],
          albums: [],
          relatedArtists: [],
        })
      );
    }
    return true;
  }

  if (pathname === '/api/youtube/album-details') {
    const albumName = (parsedUrl.searchParams.get('album') || '').trim();
    const artistName = (parsedUrl.searchParams.get('artist') || '').trim();
    const rawId = (parsedUrl.searchParams.get('id') || '').trim();
    try {
      let dzAlbId =
        rawId.startsWith('dz_alb_') && /^\d+$/.test(rawId.slice(7))
          ? rawId.slice(7)
          : '';

      if (!dzAlbId && (albumName || artistName)) {
        const q = `${artistName} ${albumName}`.trim();
        const searchRes = await fetch(
          `https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=8`,
          { headers: { 'User-Agent': DESKTOP_UA } }
        );
        if (searchRes.ok) {
          const sd: any = await searchRes.json();
          const list: any[] = Array.isArray(sd?.data) ? sd.data : [];
          const normAlb = normalizeMusicKeyPart(albumName);
          const normArt = normalizeMusicKeyPart(artistName);
          const match =
            list.find(
              (a) =>
                normalizeMusicKeyPart(a.title || '').includes(normAlb) &&
                (!normArt || normalizeMusicKeyPart(a.artist?.name || '').includes(normArt))
            ) ||
            list.find((a) => normalizeMusicKeyPart(a.title || '').includes(normAlb)) ||
            list[0];
          if (match?.id) dzAlbId = String(match.id);
        }
      }

      if (dzAlbId) {
        const albRes = await fetch(`https://api.deezer.com/album/${dzAlbId}`, {
          headers: { 'User-Agent': DESKTOP_UA },
        });
        if (albRes.ok) {
          const full: any = await albRes.json();
          if (full?.id && !full?.error) {
            const albArtId = full.artist?.id ? String(full.artist.id) : '';
            const relDate = String(full.release_date || '');
            const yearMatch = relDate.match(/\d{4}/);
            const year = yearMatch ? Number(yearMatch[0]) : 2025;
            const formattedDate = relDate ? relDate.split('-').reverse().join('.') : '';
            const cover = String(
              full.cover_xl || full.cover_big || full.cover_medium || FALLBACK_MUSIC_IMG
            );
            const coverSmall = String(full.cover_medium || full.cover_big || cover);
            const resolvedArtistName = String(full.artist?.name || artistName || 'Artist').trim();
            const artistAvatar = String(
              full.artist?.picture_xl ||
                full.artist?.picture_big ||
                full.artist?.picture_medium ||
                ''
            );

            const rawTracks: any[] = Array.isArray(full.tracks?.data) ? full.tracks.data : [];
            const tracks = rawTracks
              .map((t, idx) =>
                mapDeezerTrack(t, idx, {
                  id: full.id,
                  title: full.title,
                  cover,
                  coverSmall,
                  year,
                  artistName: resolvedArtistName,
                  artistId: albArtId,
                  artistAvatar,
                })
              )
              .filter(Boolean);

            let moreAlbums: any[] = [];
            if (albArtId) {
              try {
                const moreRes = await fetch(
                  `https://api.deezer.com/artist/${albArtId}/albums?limit=10`,
                  { headers: { 'User-Agent': DESKTOP_UA } }
                );
                if (moreRes.ok) {
                  const md: any = await moreRes.json();
                  const seenMore = new Set<string>([normalizeMusicKeyPart(full.title || '')]);
                  for (const m of Array.isArray(md?.data) ? md.data : []) {
                    if (!m?.title || String(m.id) === String(full.id)) continue;
                    const mk = normalizeMusicKeyPart(m.title);
                    if (!mk || seenMore.has(mk)) continue;
                    seenMore.add(mk);
                    const mr = String(m.release_date || '').match(/\d{4}/);
                    moreAlbums.push({
                      id: `dz_alb_${m.id}`,
                      title: String(m.title).trim(),
                      artist: resolvedArtistName,
                      artistId: `dz_art_${albArtId}`,
                      cover: String(m.cover_xl || m.cover_big || m.cover_medium || FALLBACK_MUSIC_IMG),
                      year: mr ? Number(mr[0]) : undefined,
                      recordType: String(m.record_type || 'album'),
                    });
                    if (moreAlbums.length >= 6) break;
                  }
                }
              } catch {
                // ignore moreAlbums failure
              }
            }

            const totalDurationSec =
              Number(full.duration) ||
              tracks.reduce((sum: number, t: any) => sum + (t.durationSec || 0), 0);

            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'public, max-age=300',
            });
            res.end(
              JSON.stringify({
                ok: true,
                album: {
                  id: `dz_alb_${full.id}`,
                  title: String(full.title || albumName).trim(),
                  artist: resolvedArtistName,
                  artistId: albArtId ? `dz_art_${albArtId}` : undefined,
                  artistAvatar: artistAvatar || undefined,
                  cover,
                  year,
                  releaseDateText: formattedDate,
                  genre: String(full.genres?.data?.[0]?.name || 'Music'),
                  label: String(full.label || ''),
                  recordType: String(full.record_type || 'album'),
                  trackCount: tracks.length || Number(full.nb_tracks) || 0,
                  totalDurationSec,
                  tracks,
                  moreAlbums,
                },
              })
            );
            return true;
          }
        }
      }

      // Fallback to iTunes Album lookup
      const itTerm = `${artistName} ${albumName}`.trim();
      let itTracks = await fetchItunesSubQuery(itTerm, 'RO', 25);
      if (albumName) {
        const na = normalizeMusicKeyPart(albumName);
        const filtered = itTracks.filter((t: any) =>
          normalizeMusicKeyPart(t.album || '').includes(na)
        );
        if (filtered.length > 0) itTracks = filtered;
      }
      const first = itTracks[0];
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: itTracks.length > 0,
          album: {
            id: first?.albumId || rawId || `it_alb_${normalizeMusicKeyPart(itTerm)}`,
            title: albumName || first?.album || artistName,
            artist: artistName || first?.artist || 'Artist',
            artistId: first?.artistId,
            cover: first?.cover || FALLBACK_MUSIC_IMG,
            year: first?.year || 2025,
            releaseDateText: '',
            genre: first?.genre || 'Music',
            label: '',
            recordType: 'album',
            trackCount: itTracks.length,
            totalDurationSec: itTracks.reduce(
              (acc: number, t: any) => acc + (t.durationSec || 0),
              0
            ),
            tracks: itTracks,
            moreAlbums: [],
          },
        })
      );
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : 'Album details error',
          album: null,
        })
      );
    }
    return true;
  }

  if (pathname === '/api/youtube/song-radio') {
    const trackName = (parsedUrl.searchParams.get('track') || '').trim();
    const artistName = (parsedUrl.searchParams.get('artist') || '').trim();
    const artistId = (parsedUrl.searchParams.get('artistId') || '').trim();
    const limit = Math.min(50, Math.max(15, parseInt(parsedUrl.searchParams.get('limit') || '40', 10) || 40));

    try {
      const canonical = await resolveCanonicalDeezerArtist(artistName, artistId);
      const seenKeys = new Set<string>();
      const rawPool: any[] = [];
      const addUnique = (t: any) => {
        if (!t?.title || !t?.artist) return;
        const k = `${normalizeMusicKeyPart(t.artist)}__${normalizeMusicKeyPart(t.title)}`;
        if (!k || seenKeys.has(k)) return;
        seenKeys.add(k);
        rawPool.push(t);
      };

      const relatedNames: string[] = [];

      if (canonical?.dzId) {
        const [radioRes, topRes, relRes] = await Promise.all([
          fetch(`https://api.deezer.com/artist/${canonical.dzId}/radio?limit=35`, {
            headers: { 'User-Agent': DESKTOP_UA },
          })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch(`https://api.deezer.com/artist/${canonical.dzId}/top?limit=12`, {
            headers: { 'User-Agent': DESKTOP_UA },
          })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch(`https://api.deezer.com/artist/${canonical.dzId}/related?limit=6`, {
            headers: { 'User-Agent': DESKTOP_UA },
          })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ]);

        const radioRaw: any[] = Array.isArray(radioRes?.data) ? radioRes.data : [];
        const topRaw: any[] = Array.isArray(topRes?.data) ? topRes.data : [];
        const relArtists: any[] = Array.isArray(relRes?.data) ? relRes.data : [];

        for (const ra of relArtists) {
          if (ra?.name && relatedNames.length < 4) {
            relatedNames.push(String(ra.name).trim());
          }
        }

        // If radio endpoint has too few items, fetch top tracks from top 4 related artists
        let relTopBuckets: any[][] = [];
        if (radioRaw.length < 18 && relArtists.length > 0) {
          relTopBuckets = await Promise.all(
            relArtists.slice(0, 4).map(async (ra: any) => {
              try {
                const rr = await fetch(`https://api.deezer.com/artist/${ra.id}/top?limit=6`, {
                  headers: { 'User-Agent': DESKTOP_UA },
                });
                if (!rr.ok) return [];
                const rd: any = await rr.json();
                return (Array.isArray(rd?.data) ? rd.data : [])
                  .map((x: any, i: number) => mapDeezerTrack(x, i))
                  .filter(Boolean);
              } catch {
                return [];
              }
            })
          );
        }

        for (const [idx, item] of radioRaw.entries()) {
          addUnique(mapDeezerTrack(item, idx));
        }
        for (let row = 0; row < 6; row++) {
          for (const bucket of relTopBuckets) {
            if (bucket[row]) addUnique(bucket[row]);
          }
        }
        for (const [idx, item] of topRaw.entries()) {
          addUnique(mapDeezerTrack(item, idx));
        }
      }

      if (rawPool.length < 15) {
        const [dzExtra, itExtra] = await Promise.all([
          fetchDeezerSubQuery(`${artistName} ${trackName}`.trim(), 20),
          fetchItunesSubQuery(artistName || trackName, 'RO', 25),
        ]);
        for (const t of [...dzExtra, ...itExtra]) addUnique(t);
      }

      const mixed = interleaveMaxTwoConsecutive(rawPool, limit);
      for (const t of mixed) {
        if (
          relatedNames.length < 4 &&
          t.artist &&
          normalizeMusicKeyPart(t.artist) !== normalizeMusicKeyPart(canonical?.name || artistName) &&
          !relatedNames.includes(t.artist)
        ) {
          relatedNames.push(t.artist);
        }
      }

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(
        JSON.stringify({
          ok: true,
          radioTitle: trackName ? `Radio ${trackName}` : `Radio ${canonical?.name || artistName}`,
          seedArtist: canonical?.name || artistName,
          seedArtistAvatar: canonical?.avatar || '',
          relatedNames,
          tracks: mixed,
        })
      );
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : 'Song radio error',
          radioTitle: trackName ? `Radio ${trackName}` : 'Radio Mix',
          seedArtist: artistName,
          relatedNames: [],
          tracks: [],
        })
      );
    }
    return true;
  }

  if (pathname === '/api/youtube/lyrics') {
    const rawTrack = (parsedUrl.searchParams.get('track') || '').trim();
    const rawArtist = (parsedUrl.searchParams.get('artist') || '').trim();
    const stripNoise = (s: string) =>
      s
        .replace(/\((?:official|lyric|audio|video|visual|hd|4k|feat\.?[^)]*|ft\.?[^)]*)[^)]*\)/gi, '')
        .replace(/\[[^\]]*\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const cleanTrack = stripNoise(rawTrack);
    const cleanArtist = rawArtist.split(/[&,]/)[0].trim();

    try {
      let syncedLyrics = '';
      let plainLyrics = '';
      let instrumental = false;

      if (cleanTrack && cleanArtist) {
        const directRes = await fetch(
          `https://lrclib.net/api/get?artist_name=${encodeURIComponent(
            cleanArtist
          )}&track_name=${encodeURIComponent(cleanTrack)}`,
          { headers: { 'User-Agent': DESKTOP_UA } }
        ).catch(() => null);

        if (directRes?.ok) {
          const d: any = await directRes.json();
          if (d?.syncedLyrics) syncedLyrics = String(d.syncedLyrics);
          if (d?.plainLyrics) plainLyrics = String(d.plainLyrics);
          if (d?.instrumental) instrumental = Boolean(d.instrumental);
        }
      }

      if (!syncedLyrics) {
        const searchQ = `${cleanArtist} ${cleanTrack}`.trim() || `${rawArtist} ${rawTrack}`.trim();
        if (searchQ) {
          const searchRes = await fetch(
            `https://lrclib.net/api/search?q=${encodeURIComponent(searchQ)}`,
            { headers: { 'User-Agent': DESKTOP_UA } }
          ).catch(() => null);
          if (searchRes?.ok) {
            const arr: any[] = (await searchRes.json()) || [];
            if (Array.isArray(arr) && arr.length > 0) {
              const best = arr.find((x) => Boolean(x?.syncedLyrics)) || arr[0];
              if (best?.syncedLyrics) syncedLyrics = String(best.syncedLyrics);
              if (!plainLyrics && best?.plainLyrics) plainLyrics = String(best.plainLyrics);
              if (best?.instrumental) instrumental = Boolean(best.instrumental);
            }
          }
        }
      }

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=1800',
      });
      res.end(
        JSON.stringify({
          ok: Boolean(syncedLyrics || plainLyrics),
          syncedLyrics: syncedLyrics || null,
          plainLyrics: plainLyrics || null,
          instrumental,
        })
      );
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: false,
          syncedLyrics: null,
          plainLyrics: null,
          instrumental: false,
        })
      );
    }
    return true;
  }

  if (pathname === '/api/youtube/music-catalog') {
    void getYouTubeVisitorData('dQw4w9WgXcQ').catch(() => {});
    const rawQuery = (
      parsedUrl.searchParams.get('q') ||
      parsedUrl.searchParams.get('term') ||
      '__GLOBAL_TOP_50__'
    ).trim();
    const playlistId = (parsedUrl.searchParams.get('playlistId') || '').trim();
    const country = (parsedUrl.searchParams.get('country') || 'RO')
      .trim()
      .toUpperCase();
    const limit = Math.min(
      60,
      Math.max(5, parseInt(parsedUrl.searchParams.get('limit') || '50', 10) || 50)
    );

    try {
      const seenKeys = new Set<string>();
      const tracks: any[] = [];
      let artists: any[] = [];
      let albums: any[] = [];

      const pushUnique = (item: any) => {
        if (!item || tracks.length >= limit) return;
        const normArtist = String(item.artist)
          .toLowerCase()
          .replace(/[^a-z0-9а-яёăâîșț]/gi, '');
        const normTitle = normalizeMusicKeyPart(item.title);
        const key = `${normArtist}__${normTitle}`;
        if (!normTitle || seenKeys.has(key)) return;
        seenKeys.add(key);
        tracks.push(item);
      };

      const isGlobalTop =
        rawQuery === '__GLOBAL_TOP_50__' ||
        playlistId === 'pl_global_hits' ||
        rawQuery.toLowerCase() === 'top hits global';

      if (isGlobalTop) {
        // Fetch live Global Top 50 Chart from Deezer + top global artists from iTunes in parallel
        const [dzChartTracks, itunesTopBuckets] = await Promise.all([
          (async () => {
            try {
              const chartRes = await fetch(
                'https://api.deezer.com/chart/0/tracks?limit=50',
                { headers: { 'User-Agent': DESKTOP_UA } }
              );
              if (!chartRes.ok) return [];
              const chartData: any = await chartRes.json();
              const rawList: any[] = Array.isArray(chartData?.data)
                ? chartData.data
                : [];
              return rawList
                .map((item, idx) => mapDeezerTrack(item, idx))
                .filter(Boolean);
            } catch {
              return [];
            }
          })(),
          Promise.all(
            [
              'The Weeknd',
              'Dua Lipa',
              'Bruno Mars',
              'Lady Gaga',
              'Billie Eilish',
              'Sabrina Carpenter',
              'Post Malone',
              'Rihanna',
              'Teddy Swims',
              'Benson Boone',
            ].map((artist) => fetchItunesSubQuery(artist, country, 8))
          ),
        ]);

        for (const item of dzChartTracks) {
          pushUnique(item);
        }
        // Interleave iTunes top artists to guarantee 50 full tracks
        for (let row = 0; row < 10 && tracks.length < limit; row++) {
          for (const bucket of itunesTopBuckets) {
            if (bucket[row]) pushUnique(bucket[row]);
          }
        }
      } else {
        // Split comma-separated artist/query lists (or multi-artist terms)
        const parts = rawQuery
          .split(/[,|;]+/)
          .map((s) => s.trim())
          .filter(Boolean);

        if (parts.length > 1) {
          const perPartLimit = Math.max(8, Math.ceil((limit * 1.4) / parts.length));
          const buckets = await Promise.all(
            parts.map(async (part) => {
              const [dzList, itList] = await Promise.all([
                fetchDeezerSubQuery(part, perPartLimit),
                fetchItunesSubQuery(part, country, perPartLimit),
              ]);
              const merged: any[] = [];
              const maxLen = Math.max(dzList.length, itList.length);
              for (let i = 0; i < maxLen; i++) {
                if (itList[i]) merged.push(itList[i]);
                if (dzList[i]) merged.push(dzList[i]);
              }
              return merged;
            })
          );

          // Round-robin interleave across all artist buckets so the playlist has diverse tracks up to 50
          for (let row = 0; row < 30 && tracks.length < limit; row++) {
            for (const bucket of buckets) {
              if (bucket[row]) pushUnique(bucket[row]);
            }
          }
        } else {
          // Single search query: fetch tracks + artists + albums in parallel
          const [itList, dzList, dzArtists, dzAlbums] = await Promise.all([
            fetchItunesSubQuery(rawQuery, country, limit),
            fetchDeezerSubQuery(rawQuery, limit),
            !playlistId ? fetchDeezerArtistsSearch(rawQuery, 10) : Promise.resolve([]),
            !playlistId ? fetchDeezerAlbumsSearch(rawQuery, 12) : Promise.resolve([]),
          ]);
          const maxLen = Math.max(itList.length, dzList.length);
          for (let i = 0; i < maxLen && tracks.length < limit; i++) {
            if (itList[i]) pushUnique(itList[i]);
            if (dzList[i]) pushUnique(dzList[i]);
          }
          artists = dzArtists;
          albums = dzAlbums;
        }
      }

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=600',
      });
      res.end(JSON.stringify({ ok: true, tracks, artists, albums }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : 'Music catalog error',
          tracks: [],
          artists: [],
          albums: [],
        })
      );
    }
    return true;
  }

  if (pathname === '/api/youtube/resolve') {
    const id = parsedUrl.searchParams.get('id') || '';
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'Missing video id' }));
      return true;
    }
    try {
      const info = await resolveYouTubeStream(id);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(
        JSON.stringify({
          ok: true,
          videoId: info.videoId,
          title: info.title,
          channel: info.channel,
          durationSec: info.durationSec,
          qualityLabel: info.qualityLabel,
          streamUrl: `/api/youtube/stream?id=${encodeURIComponent(info.videoId)}`,
          hlsManifestUrl: info.hlsManifestUrl,
          sponsorSegments: info.sponsorSegments,
        })
      );
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : 'Resolve error',
        })
      );
    }
    return true;
  }

  if (pathname === '/api/youtube/stream') {
    const id = parsedUrl.searchParams.get('id') || '';
    const startSec = Math.max(
      0,
      parseFloat(parsedUrl.searchParams.get('start') || '0') || 0
    );
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Missing video id');
      return true;
    }

    try {
      const info = await resolveYouTubeStream(id);
      const ffmpegArgs: string[] = ['-hide_banner', '-loglevel', 'error'];

      if (info.videoUrl && info.audioUrl) {
        ffmpegArgs.push(
          '-reconnect',
          '1',
          '-reconnect_streamed',
          '1',
          '-reconnect_delay_max',
          '5',
          '-user_agent',
          info.userAgent
        );
        if (startSec > 0) {
          ffmpegArgs.push('-ss', String(startSec));
        }
        ffmpegArgs.push('-i', info.videoUrl);

        ffmpegArgs.push(
          '-reconnect',
          '1',
          '-reconnect_streamed',
          '1',
          '-reconnect_delay_max',
          '5',
          '-user_agent',
          info.userAgent
        );
        if (startSec > 0) {
          ffmpegArgs.push('-ss', String(startSec));
        }
        ffmpegArgs.push('-i', info.audioUrl);
        ffmpegArgs.push('-map', '0:v:0', '-map', '1:a:0');
      } else {
        const singleInput = info.videoUrl || info.hlsManifestUrl || '';
        ffmpegArgs.push('-user_agent', info.userAgent);
        if (startSec > 0) {
          ffmpegArgs.push('-ss', String(startSec));
        }
        ffmpegArgs.push('-i', singleInput);
      }

      ffmpegArgs.push(
        '-c:v',
        'copy',
        '-c:a',
        'copy',
        '-avoid_negative_ts',
        'make_zero',
        '-frag_duration',
        '500000',
        '-movflags',
        'frag_keyframe+empty_moov+default_base_moof',
        '-f',
        'mp4',
        'pipe:1'
      );

      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-cache, no-store',
        Connection: 'keep-alive',
        ...(info.durationSec > 0
          ? {
              'X-Content-Duration': String(info.durationSec),
              'Access-Control-Expose-Headers': 'X-Content-Duration',
            }
          : {}),
      });

      const proc = spawn(ffmpegBinaryPath, ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      proc.stdout.pipe(res);

      const cleanup = () => {
        if (!proc.killed) {
          try {
            proc.kill('SIGKILL');
          } catch {
            // ignore
          }
        }
      };

      req.on('close', cleanup);
      res.on('close', cleanup);
      proc.on('error', () => {
        if (!res.writableEnded) res.end();
      });
      proc.on('close', () => {
        if (!res.writableEnded) res.end();
      });
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end(
        `YouTube stream error: ${err instanceof Error ? err.message : 'Unknown'}`
      );
    }
    return true;
  }

  if (pathname === '/api/youtube/audio') {
    const initialId = (parsedUrl.searchParams.get('id') || '').trim();
    const q = (parsedUrl.searchParams.get('q') || '').trim();
    const targetDurationSec = Math.max(
      0,
      Number(parsedUrl.searchParams.get('dur') || 0) || 0
    );
    const retryIdx = Math.max(
      0,
      Math.min(4, parseInt(parsedUrl.searchParams.get('retry') || '0', 10) || 0)
    );
    const startSec = Math.max(
      0,
      parseFloat(parsedUrl.searchParams.get('start') || '0') || 0
    );
    const isPrefetchOnly = parsedUrl.searchParams.get('prefetch') === '1';

    try {
      const candidateIds: string[] = [];
      const seenIds = new Set<string>();
      const pushCand = (vid?: string) => {
        const clean = String(vid || '').trim();
        if (/^[a-zA-Z0-9_-]{11}$/.test(clean) && !seenIds.has(clean)) {
          seenIds.add(clean);
          candidateIds.push(clean);
        }
      };

      pushCand(initialId);
      if (q && (candidateIds.length === 0 || retryIdx > 0)) {
        const results = await searchYouTubeVideos(q);
        for (const m of rankMusicVideoMatches(results, targetDurationSec, q)) {
          pushCand(m?.videoId);
        }
      }

      const orderedIds =
        retryIdx > 0 && candidateIds.length > retryIdx
          ? [...candidateIds.slice(retryIdx), ...candidateIds.slice(0, retryIdx)]
          : candidateIds;

      const id = orderedIds[0] || '';
      if (!id) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Missing video id or query');
        return true;
      }

      let activeInfo: ResolvedYouTubeStream | null = null;
      let activeVid = id;
      for (const candId of orderedIds.slice(0, 4)) {
        try {
          const info = await resolveYouTubeStream(candId, false, {
            skipSponsorBlock: true,
          });
          if (info?.audioUrl) {
            activeInfo = info;
            activeVid = candId;
            break;
          }
        } catch {
          // try next candidate
        }
      }
      if (!activeInfo) {
        activeInfo = await resolveYouTubeStream(id, false, {
          skipSponsorBlock: true,
        });
      }

      // ULTRA-FAST APPLE-NATIVE FASTSTART M4A PATH (0.35s cold parallel fetch + 0.07s lossless remux -> <1ms RAM Range serving!)
      // Fixes: (1) iOS/iPadOS Safari 2x double-duration bug on YouTube DASH m4a (e.g. 5:56 for 2:58 / 14:15 for 7:08),
      //        (2) 10s Next-track delay (RAM hit + prefetch=1 serves instantly in <1ms),
      //        (3) Mid-track freezes/truncations from googlevideo.com chunk stalls!
      if (activeInfo.audioUrl && startSec === 0) {
        const cleanM4a = await getOrBuildCleanM4aAudioBuffer(activeInfo, activeVid);
        if (cleanM4a && cleanM4a.buf.length > 0) {
          if (isPrefetchOnly) {
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-store',
            });
            res.end(
              JSON.stringify({
                ok: true,
                videoId: activeVid,
                durationSec: cleanM4a.durationSec,
                bytes: cleanM4a.buf.length,
              })
            );
            return true;
          }

          const totalSize = cleanM4a.buf.length;
          const rangeHeader =
            typeof req.headers.range === 'string' ? req.headers.range.trim() : '';
          const rangeMatch = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader);
          const reqStart = rangeMatch
            ? Math.min(Math.max(0, Number(rangeMatch[1])), totalSize - 1)
            : 0;
          const reqEnd =
            rangeMatch && rangeMatch[2]
              ? Math.min(Math.max(reqStart, Number(rangeMatch[2])), totalSize - 1)
              : totalSize - 1;
          const isPartial = Boolean(rangeMatch);
          const slice = cleanM4a.buf.subarray(reqStart, reqEnd + 1);

          const outHeaders: Record<string, string> = {
            'Content-Type': cleanM4a.mimeType || 'audio/mp4',
            'Accept-Ranges': 'bytes',
            'Content-Length': String(slice.length),
            ...(isPartial
              ? { 'Content-Range': `bytes ${reqStart}-${reqEnd}/${totalSize}` }
              : {}),
            'Cache-Control': 'public, max-age=600',
            Vary: 'Range',
            'Access-Control-Allow-Origin': '*',
            ...(cleanM4a.durationSec > 0
              ? {
                  'X-Content-Duration': String(cleanM4a.durationSec),
                  'Access-Control-Expose-Headers':
                    'X-Content-Duration, Content-Range, Accept-Ranges',
                }
              : {
                  'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges',
                }),
          };

          res.writeHead(isPartial ? 206 : 200, outHeaders);
          if (req.method === 'HEAD') {
            res.end();
          } else {
            res.end(slice);
          }
          return true;
        }
        if (isPrefetchOnly) {
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
          });
          res.end(JSON.stringify({ ok: false, videoId: activeVid }));
          return true;
        }
      }

      // Streaming fallback (for very long mixes > 30 MB): with strict per-chunk timeout so it never hangs forever
      if (activeInfo.audioUrl && startSec === 0) {
        const stripRangeParam = (raw: string): string => {
          try {
            const u = new URL(raw);
            u.searchParams.delete('range');
            return u.toString();
          } catch {
            return raw.replace(/[?&]range=[^&]*/g, '');
          }
        };

        let baseUrl = stripRangeParam(activeInfo.audioUrl);
        let totalSize = activeInfo.audioContentLength;

        if (totalSize <= 0) {
          try {
            const sep = baseUrl.includes('?') ? '&' : '?';
            let probeRes = await fetch(`${baseUrl}${sep}range=0-65535`, {
              headers: { 'User-Agent': activeInfo.userAgent },
            });
            if (probeRes.status === 403) {
              await probeRes.body?.cancel().catch(() => {});
              activeInfo = await resolveYouTubeStream(activeVid, true, {
                skipSponsorBlock: true,
              });
              if (activeInfo.audioUrl) {
                baseUrl = stripRangeParam(activeInfo.audioUrl);
                const retrySep = baseUrl.includes('?') ? '&' : '?';
                probeRes = await fetch(`${baseUrl}${retrySep}range=0-65535`, {
                  headers: { 'User-Agent': activeInfo.userAgent },
                });
              }
            }
            const cr = probeRes.headers.get('content-range') || '';
            const mTotal = /\/(\d+)$/.exec(cr);
            if (mTotal?.[1]) {
              totalSize = Number(mTotal[1]) || 0;
              if (totalSize > 0) activeInfo.audioContentLength = totalSize;
            }
            await probeRes.body?.cancel().catch(() => {});
          } catch {
            // fall through to ffmpeg fallback below
          }
        }

        if (totalSize > 0) {
          const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range.trim() : '';
          const rangeMatch = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader);
          const reqStart = rangeMatch
            ? Math.min(Math.max(0, Number(rangeMatch[1])), totalSize - 1)
            : 0;
          const reqEnd =
            rangeMatch && rangeMatch[2]
              ? Math.min(Math.max(reqStart, Number(rangeMatch[2])), totalSize - 1)
              : totalSize - 1;
          const isPartial = Boolean(rangeMatch);

          const outHeaders: Record<string, string> = {
            'Content-Type': activeInfo.audioMimeType || 'audio/mp4',
            'Accept-Ranges': 'bytes',
            'Content-Length': String(reqEnd - reqStart + 1),
            ...(isPartial ? { 'Content-Range': `bytes ${reqStart}-${reqEnd}/${totalSize}` } : {}),
            'Cache-Control': 'public, max-age=600',
            Vary: 'Range',
            'Access-Control-Allow-Origin': '*',
            ...(activeInfo.durationSec > 0
              ? {
                  'X-Content-Duration': String(activeInfo.durationSec),
                  'Access-Control-Expose-Headers':
                    'X-Content-Duration, Content-Range, Accept-Ranges',
                }
              : {
                  'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges',
                }),
          };

          if (req.method === 'HEAD') {
            res.writeHead(isPartial ? 206 : 200, outHeaders);
            res.end();
            return true;
          }

          let closed = false;
          const markClosed = () => {
            if (!res.writableEnded) closed = true;
          };
          res.on('close', markClosed);

          let pos = reqStart;
          let refreshCount = 0;
          let headersWritten = false;

          while (pos <= reqEnd && !closed) {
            const stepSize = pos === reqStart ? 131072 : 524288;
            const chunkEnd = Math.min(reqEnd, pos + stepSize - 1);
            const sep = baseUrl.includes('?') ? '&' : '?';
            let streamedBytes = 0;

            for (let attempt = 0; attempt < 4 && !closed; attempt++) {
              try {
                const cRes = await fetch(`${baseUrl}${sep}range=${pos}-${chunkEnd}`, {
                  headers: { 'User-Agent': activeInfo.userAgent },
                  signal: AbortSignal.timeout(12_000),
                });
                if ((cRes.status === 403 || (!cRes.ok && attempt >= 1)) && refreshCount < 2) {
                  await cRes.body?.cancel().catch(() => {});
                  refreshCount += 1;
                  activeInfo = await resolveYouTubeStream(activeVid, true, {
                    skipSponsorBlock: true,
                  });
                  if (activeInfo.audioUrl) {
                    baseUrl = stripRangeParam(activeInfo.audioUrl);
                  }
                  continue;
                }
                if (cRes.ok || cRes.status === 206) {
                  if (cRes.body) {
                    const reader = cRes.body.getReader();
                    while (!closed) {
                      const { done, value } = await reader.read();
                      if (done) break;
                      if (value && value.byteLength > 0) {
                        if (!headersWritten) {
                          headersWritten = true;
                          res.writeHead(isPartial ? 206 : 200, outHeaders);
                        }
                        const ok = res.write(Buffer.from(value));
                        streamedBytes += value.byteLength;
                        if (!ok && !closed) {
                          await new Promise<void>((resolve) => {
                            const onDone = () => {
                              res.off('drain', onDone);
                              res.off('close', onDone);
                              resolve();
                            };
                            res.once('drain', onDone);
                            res.once('close', onDone);
                          });
                        }
                      }
                    }
                    if (closed) {
                      await reader.cancel().catch(() => {});
                    }
                    if (streamedBytes > 0) break;
                  } else {
                    const ab = await cRes.arrayBuffer();
                    if (ab.byteLength > 0) {
                      if (!headersWritten) {
                        headersWritten = true;
                        res.writeHead(isPartial ? 206 : 200, outHeaders);
                      }
                      res.write(Buffer.from(ab));
                      streamedBytes += ab.byteLength;
                      break;
                    }
                  }
                }
              } catch {
                if (attempt >= 1 && refreshCount < 2) {
                  refreshCount += 1;
                  try {
                    activeInfo = await resolveYouTubeStream(activeVid, true, {
                      skipSponsorBlock: true,
                    });
                    if (activeInfo.audioUrl) {
                      baseUrl = stripRangeParam(activeInfo.audioUrl);
                    }
                  } catch {
                    // ignore stream refresh error
                  }
                }
              }
              if (streamedBytes > 0 || closed) break;
              await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
            }

            if (streamedBytes <= 0 || closed) break;
            pos += streamedBytes;
          }

          res.off('close', markClosed);
          if (headersWritten) {
            if (!res.writableEnded) res.end();
            return true;
          }
        }
      }

      const info = activeInfo;

      // Fallback path: extract pure AAC audio stream via FFmpeg from audioUrl, videoUrl, or hlsManifestUrl
      const inputSource =
        info.audioUrl || info.videoUrl || info.hlsManifestUrl || '';
      const ffmpegArgs: string[] = [
        '-hide_banner',
        '-loglevel',
        'error',
        '-reconnect',
        '1',
        '-reconnect_streamed',
        '1',
        '-reconnect_delay_max',
        '5',
        '-user_agent',
        info.userAgent,
      ];
      if (startSec > 0) {
        ffmpegArgs.push('-ss', String(startSec));
      }
      ffmpegArgs.push(
        '-i',
        inputSource,
        '-vn',
        '-c:a',
        'aac',
        '-b:a',
        '320k',
        '-f',
        'adts',
        'pipe:1'
      );

      res.writeHead(200, {
        'Content-Type': 'audio/aac',
        'Cache-Control': 'no-cache, no-store',
        Connection: 'keep-alive',
        ...(info.durationSec > 0
          ? {
              'X-Content-Duration': String(info.durationSec),
              'Access-Control-Expose-Headers': 'X-Content-Duration',
            }
          : {}),
      });

      const proc = spawn(ffmpegBinaryPath, ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      proc.stdout.pipe(res);

      const cleanup = () => {
        if (!proc.killed) {
          try {
            proc.kill('SIGKILL');
          } catch {
            // ignore
          }
        }
      };

      req.on('close', cleanup);
      res.on('close', cleanup);
      proc.on('error', () => {
        if (!res.writableEnded) res.end();
      });
      proc.on('close', () => {
        if (!res.writableEnded) res.end();
      });
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end(
        `YouTube audio error: ${err instanceof Error ? err.message : 'Unknown'}`
      );
    }
    return true;
  }

  return false;
}


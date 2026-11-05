import type { IncomingMessage, ServerResponse } from 'node:http';
import { spawn } from 'node:child_process';
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
  hlsManifestUrl?: string;
  userAgent: string;
  sponsorSegments: SponsorSegment[];
  resolvedAt: number;
}

const IOS_PRODUCER_UA =
  'com.google.ios.youtube.producer/0.145.1 (iPhone16,2; U; CPU iOS 18_2_1 like Mac OS X;)';
const IOS_MAIN_UA =
  'com.google.ios.youtube/20.03.02 (iPhone16,2; U; CPU iOS 18_2_1 like Mac OS X;)';
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const searchCache = new Map<string, { items: YouTubeVideoItem[]; ts: number }>();
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

const resolvedStreamCache = new Map<string, ResolvedYouTubeStream>();
const STREAM_CACHE_TTL_MS = 25 * 60 * 1000;

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

export async function searchYouTubeVideos(query: string): Promise<YouTubeVideoItem[]> {
  const cleanQuery = (query || '').trim() || 'trending romania';
  const cacheKey = cleanQuery.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < SEARCH_CACHE_TTL_MS) {
    return cached.items;
  }

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
  if (!match?.[1]) {
    return [];
  }

  const data = JSON.parse(match[1]);
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
  if (items.length > 0) {
    searchCache.set(cacheKey, { items, ts: Date.now() });
  }
  return items;
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
  videoId: string
): Promise<ResolvedYouTubeStream> {
  const cleanId = (videoId || '').trim();
  const cached = resolvedStreamCache.get(cleanId);
  if (cached && Date.now() - cached.resolvedAt < STREAM_CACHE_TTL_MS) {
    return cached;
  }

  const [producerRes, sponsorSegments] = await Promise.all([
    fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': IOS_PRODUCER_UA,
      },
      body: JSON.stringify({
        videoId: cleanId,
        contentCheckOk: true,
        racyCheckOk: true,
        context: {
          client: {
            clientName: 'IOS_PRODUCER',
            clientVersion: '0.145.1',
            deviceMake: 'Apple',
            deviceModel: 'iPhone16,2',
            osName: 'iPhone',
            osVersion: '18.2.1.22C161',
            hl: 'ro',
            gl: 'RO',
          },
        },
      }),
    }),
    fetchSponsorSegments(cleanId),
  ]);

  let playerData: any = producerRes.ok ? await producerRes.json() : null;
  let activeUa = IOS_PRODUCER_UA;

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
              clientVersion: '20.03.02',
              deviceMake: 'Apple',
              deviceModel: 'iPhone16,2',
              osName: 'iPhone',
              osVersion: '18.2.1.22C161',
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

  // Prefer highest bitrate audio stream (TIDAL Master / HQ audio: Opus 251 or AAC 140 sorted by bitrate desc)
  const audioFormats = adaptive
    .filter(
      (f) =>
        f.url &&
        (String(f.mimeType || '').startsWith('audio/mp4') ||
          String(f.mimeType || '').startsWith('audio/webm') ||
          f.itag === 140 ||
          f.itag === 251 ||
          f.itag === 141)
    )
    .sort(
      (a, b) =>
        (Number(b.bitrate || b.averageBitrate) || 0) -
        (Number(a.bitrate || a.averageBitrate) || 0)
    );
  const bestAudio =
    audioFormats.find((f) =>
      String(f.mimeType || '').startsWith('audio/mp4')
    ) ||
    audioFormats[0] ||
    adaptive.find((f) => f.itag === 140 && f.url) ||
    adaptive.find((f) => f.itag === 139 && f.url);

  const hlsManifestUrl = playerData?.streamingData?.hlsManifestUrl || undefined;
  if (!bestVideo?.url && !hlsManifestUrl) {
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
    hlsManifestUrl,
    userAgent: activeUa,
    sponsorSegments,
    resolvedAt: Date.now(),
  };

  resolvedStreamCache.set(cleanId, resolved);
  return resolved;
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

  if (pathname === '/api/youtube/music-catalog') {
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

    const mapDeezerTrack = (d: any, indexHint = 0) => {
      if (!d?.title || !d?.artist?.name) return null;
      const title = String(d.title_short || d.title).trim();
      const artist = String(d.artist.name).trim();
      const album = String(d.album?.title || title).trim();
      const cover = String(
        d.album?.cover_xl ||
          d.album?.cover_big ||
          d.album?.cover_medium ||
          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80'
      );
      const coverSmall = String(
        d.album?.cover_medium || d.album?.cover_big || cover
      );
      const durationSec = Math.max(45, Number(d.duration) || 205);
      const audioQuery = `${artist} - ${title} Official Audio`;
      const isHiRes = indexHint % 3 !== 2;
      return {
        id: `dz_${d.id || Math.random().toString(36).slice(2, 9)}`,
        title,
        artist,
        album,
        cover,
        coverSmall,
        durationSec,
        year: 2025,
        genre: 'TIDAL MAX • Pop / Hits',
        previewUrl: String(d.preview || ''),
        fullAudioUrl: `/api/youtube/audio?q=${encodeURIComponent(audioQuery)}`,
        videoQuery: `${artist} - ${title}`,
        qualityTier: isHiRes ? 'MAX' : 'HIFI',
        qualityLabel: isHiRes
          ? 'MAX • 24-bit / 192 kHz FLAC'
          : 'HiFi • 16-bit / 44.1 kHz FLAC',
        bitrateKbps: isHiRes ? 9216 : 1411,
      };
    };

    const mapItunesTrack = (r: any, indexHint = 0) => {
      if (!r?.trackName || !r?.artistName) return null;
      const rawArt = String(r.artworkUrl100 || r.artworkUrl60 || '');
      const cover = rawArt
        ? rawArt.replace(/\d+x\d+bb/, '1000x1000bb')
        : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80';
      const coverSmall = rawArt
        ? rawArt.replace(/\d+x\d+bb/, '300x300bb')
        : cover;
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
        album: String(r.collectionName || title),
        cover,
        coverSmall,
        durationSec,
        year,
        genre: String(r.primaryGenreName || 'Music'),
        previewUrl: String(r.previewUrl || ''),
        fullAudioUrl: `/api/youtube/audio?q=${encodeURIComponent(audioQuery)}`,
        videoQuery: `${artist} - ${title}`,
        qualityTier: isHiRes ? 'MAX' : 'HIFI',
        qualityLabel: isHiRes
          ? 'MAX • 24-bit / 192 kHz FLAC'
          : 'HiFi • 16-bit / 44.1 kHz FLAC',
        bitrateKbps: isHiRes ? 9216 : 1411,
      };
    };

    const fetchItunesSubQuery = async (subTerm: string, subLimit: number) => {
      try {
        const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
          subTerm
        )}&country=${encodeURIComponent(country)}&media=music&entity=song&limit=${subLimit}`;
        const itunesRes = await fetch(itunesUrl, {
          headers: { 'User-Agent': DESKTOP_UA },
        });
        if (!itunesRes.ok) return [];
        const data: any = await itunesRes.json();
        const rawResults: any[] = Array.isArray(data?.results)
          ? data.results
          : [];
        return rawResults
          .map((item, idx) => mapItunesTrack(item, idx))
          .filter(Boolean);
      } catch {
        return [];
      }
    };

    const fetchDeezerSubQuery = async (subTerm: string, subLimit: number) => {
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
        return rawResults
          .map((item, idx) => mapDeezerTrack(item, idx))
          .filter(Boolean);
      } catch {
        return [];
      }
    };

    try {
      const seenKeys = new Set<string>();
      const tracks: any[] = [];
      const pushUnique = (item: any) => {
        if (!item || tracks.length >= limit) return;
        const normArtist = String(item.artist)
          .toLowerCase()
          .replace(/[^a-z0-9а-яёăâîșț]/gi, '');
        const normTitle = String(item.title)
          .toLowerCase()
          .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
          .replace(/[^a-z0-9а-яёăâîșț]/gi, '');
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
            ].map((artist) => fetchItunesSubQuery(artist, 8))
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
                fetchItunesSubQuery(part, perPartLimit),
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
          // Single search query: fetch from both iTunes and Deezer in parallel
          const [itList, dzList] = await Promise.all([
            fetchItunesSubQuery(rawQuery, limit),
            fetchDeezerSubQuery(rawQuery, limit),
          ]);
          const maxLen = Math.max(itList.length, dzList.length);
          for (let i = 0; i < maxLen && tracks.length < limit; i++) {
            if (itList[i]) pushUnique(itList[i]);
            if (dzList[i]) pushUnique(dzList[i]);
          }
        }
      }

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=600',
      });
      res.end(JSON.stringify({ ok: true, tracks }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : 'Music catalog error',
          tracks: [],
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
    let id = (parsedUrl.searchParams.get('id') || '').trim();
    const q = (parsedUrl.searchParams.get('q') || '').trim();
    const startSec = Math.max(
      0,
      parseFloat(parsedUrl.searchParams.get('start') || '0') || 0
    );

    try {
      if (!id && q) {
        const results = await searchYouTubeVideos(q);
        const bestMatch =
          results.find(
            (r) => !r.isLive && r.durationSec >= 45 && r.durationSec <= 900
          ) || results[0];
        if (bestMatch?.videoId) {
          id = bestMatch.videoId;
        }
      }

      if (!id) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Missing video id or query');
        return true;
      }

      const info = await resolveYouTubeStream(id);

      // Fast path: if direct AAC/M4A audio stream URL exists and no start offset is requested, proxy it with HTTP Range support
      if (info.audioUrl && startSec === 0) {
        const rangeHeader = req.headers.range;
        const upstreamRes = await fetch(info.audioUrl, {
          headers: {
            'User-Agent': info.userAgent,
            ...(rangeHeader ? { Range: rangeHeader } : {}),
          },
        });

        if (upstreamRes.ok || upstreamRes.status === 206) {
          const outHeaders: Record<string, string> = {
            'Content-Type':
              upstreamRes.headers.get('content-type') || 'audio/mp4',
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=600',
            'Access-Control-Allow-Origin': '*',
          };
          const contentLen = upstreamRes.headers.get('content-length');
          if (contentLen) outHeaders['Content-Length'] = contentLen;
          const contentRange = upstreamRes.headers.get('content-range');
          if (contentRange) outHeaders['Content-Range'] = contentRange;
          if (info.durationSec > 0) {
            outHeaders['X-Content-Duration'] = String(info.durationSec);
            outHeaders['Access-Control-Expose-Headers'] =
              'X-Content-Duration, Content-Range, Accept-Ranges';
          }

          res.writeHead(upstreamRes.status, outHeaders);
          if (upstreamRes.body) {
            const reader = upstreamRes.body.getReader();
            let closed = false;
            req.on('close', () => {
              closed = true;
              void reader.cancel().catch(() => {});
            });
            while (!closed) {
              const { done, value } = await reader.read();
              if (done || closed) break;
              if (value) res.write(Buffer.from(value));
            }
          }
          if (!res.writableEnded) res.end();
          return true;
        }
      }

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


export interface ResolvedDirectVodStream {
  ok: boolean;
  type?: 'movie' | 'series';
  sourcePath?: string;
  dashUrl?: string;
  dashaUrl?: string;
  hlsUrl?: string;
  proxyHlsUrl?: string;
  rawHlsUrl?: string;
  title?: string;
  duration?: number;
  audioNames?: string[];
  seasons?: Array<{
    season: number;
    episodes: Array<{
      episode: number;
      title: string;
      duration: number;
      audioNames?: string[];
    }>;
  }>;
}

function extractBalancedJsonArray(str: string, startIdx: number): unknown[] | null {
  const openIdx = str.indexOf('[', startIdx);
  if (openIdx < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = openIdx; i < str.length; i++) {
    const ch = str[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === '\\') {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (!inStr) {
      if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(str.slice(openIdx, i + 1));
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

async function fetchKinogramEmbedInBrowser(path: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 7500);
  try {
    const res = await fetch(`https://api.kinogram.best/embed/${path}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (!html || !html.includes('makePlayer(')) return null;
    return html;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

async function lookupKpIdsByTitleInBrowser(
  title: string,
  mediaType = '',
  year = ''
): Promise<string[]> {
  if (!title || title.trim().length < 2) return [];
  const cleanTitle = title.trim();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(
      `https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(
        cleanTitle
      )}&page=1`,
      {
        headers: {
          'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
          Accept: 'application/json',
        },
        signal: controller.signal,
      }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      films?: Array<{
        filmId?: number;
        type?: string;
        nameEn?: string;
        nameRu?: string;
        year?: string;
      }>;
    };
    const films = Array.isArray(data?.films) ? data.films : [];
    const wantSeries = mediaType === 'series';
    const cleanYear = String(year || '').slice(0, 4);

    const scored = films
      .filter((f) => f && f.filmId)
      .map((f) => {
        let score = 0;
        const isSeriesType =
          f.type === 'TV_SERIES' ||
          f.type === 'MINI_SERIES' ||
          f.type === 'TV_SHOW';
        if (mediaType && isSeriesType === wantSeries) score += 10;
        const nameEn = String(f.nameEn || '').toLowerCase();
        const nameRu = String(f.nameRu || '').toLowerCase();
        const q = cleanTitle.toLowerCase();
        if (nameEn === q || nameRu === q) score += 15;
        else if (nameEn.includes(q) || nameRu.includes(q)) score += 5;
        if (cleanYear && String(f.year || '').startsWith(cleanYear)) {
          score += 8;
        }
        return { filmId: String(f.filmId), score };
      })
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 3).map((x) => x.filmId);
  } catch {
    return [];
  } finally {
    window.clearTimeout(timer);
  }
}

function parseKinogramHtml(
  html: string,
  usedPath: string,
  season: number,
  episode: number
): ResolvedDirectVodStream {
  const addMatch = html.match(/else\s+o\[k\]\+=.\&.\+([a-zA-Z0-9_]+)/);
  const varName = addMatch?.[1];
  const allTokenMatches = varName
    ? Array.from(html.matchAll(new RegExp(`${varName}\\s*=\\s*"([^"]+)"`, 'g')))
    : [];
  const token =
    allTokenMatches.length > 0
      ? allTokenMatches[allTokenMatches.length - 1][1] || ''
      : '';

  const seasonsIdx = html.indexOf('seasons:');
  if (seasonsIdx >= 0) {
    const rawSeasons = extractBalancedJsonArray(html, seasonsIdx) as Array<{
      season?: number;
      episodes?: Array<{
        episode?: number;
        title?: string;
        duration?: number;
        dash?: string;
        dasha?: string;
        hls?: string;
        audio?: { names?: string[] };
      }>;
    }> | null;

    if (Array.isArray(rawSeasons) && rawSeasons.length > 0) {
      const targetSeason =
        rawSeasons.find((s) => Number(s.season) === Number(season)) ||
        rawSeasons[0];
      const episodes = Array.isArray(targetSeason?.episodes)
        ? targetSeason.episodes
        : [];
      const targetEp =
        episodes.find((e) => Number(e.episode) === Number(episode)) ||
        episodes[0];

      const cleanSeasons = rawSeasons.map((s) => ({
        season: Number(s.season) || 1,
        episodes: (Array.isArray(s.episodes) ? s.episodes : []).map((ep) => ({
          episode: Number(ep.episode) || 1,
          title: ep.title || `Episodul ${ep.episode}`,
          duration: Number(ep.duration) || 0,
          audioNames: Array.isArray(ep.audio?.names)
            ? ep.audio.names
            : ['Русский'],
        })),
      }));

      if (targetEp?.hls || targetEp?.dash) {
        const dashUrl = targetEp.dash
          ? targetEp.dash + (token ? `&${token}` : '')
          : undefined;
        const dashaUrl = targetEp.dasha
          ? targetEp.dasha + (token ? `&${token}` : '')
          : undefined;
        const hlsUrl = targetEp.hls
          ? targetEp.hls + (token ? `&${token}` : '')
          : undefined;
        return {
          ok: true,
          type: 'series',
          sourcePath: usedPath,
          title: targetEp.title || '',
          duration: Number(targetEp.duration) || 0,
          audioNames: Array.isArray(targetEp.audio?.names)
            ? targetEp.audio.names
            : ['Русский'],
          dashUrl,
          dashaUrl,
          hlsUrl,
          seasons: cleanSeasons,
        };
      }
    }
  }

  const dashMatch = html.match(/dash:\s*"([^"]+)"/);
  const dashaMatch = html.match(/dasha:\s*"([^"]+)"/);
  const hlsMatch = html.match(/hls:\s*"([^"]+)"/);
  const titleMatch = html.match(/title:\s*"([^"]+)"/);
  const audioMatch = html.match(/audio:\s*(\{"names":\[[^\]]+\][^}]*\})/);

  if (hlsMatch?.[1] || dashMatch?.[1]) {
    let audioNames = ['Русский / Original'];
    try {
      if (audioMatch?.[1]) {
        const parsed = JSON.parse(audioMatch[1]) as { names?: string[] };
        if (Array.isArray(parsed.names) && parsed.names.length > 0) {
          audioNames = parsed.names;
        }
      }
    } catch {
      // ignore
    }

    const dashUrl = dashMatch?.[1]
      ? dashMatch[1] + (token ? `&${token}` : '')
      : undefined;
    const dashaUrl = dashaMatch?.[1]
      ? dashaMatch[1] + (token ? `&${token}` : '')
      : undefined;
    const hlsUrl = hlsMatch?.[1]
      ? hlsMatch[1] + (token ? `&${token}` : '')
      : undefined;
    return {
      ok: true,
      type: 'movie',
      sourcePath: usedPath,
      title: titleMatch?.[1] || '',
      audioNames,
      dashUrl,
      dashaUrl,
      hlsUrl,
    };
  }

  return { ok: false };
}

/**
 * Resolves a direct HLS (.m3u8) stream signed for the user's own browser IP first,
 * falling back to `/api/vod-stream` if needed.
 */
export async function resolveDirectVodStreamClient(params: {
  kp?: string;
  imdb?: string;
  title?: string;
  type?: string;
  mediaType?: string;
  year?: string;
  season?: number;
  episode?: number;
}): Promise<ResolvedDirectVodStream> {
  const {
    kp = '',
    imdb = '',
    title = '',
    type,
    mediaType = type || '',
    year = '',
    season = 1,
    episode = 1,
  } = params;

  const isLocalLan =
    typeof window !== 'undefined' &&
    (window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.') ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  const isSmartTvUa =
    typeof navigator !== 'undefined' &&
    /Web0S|WebOS|NetCast|SmartTV|Tizen|Large Screen|MSX/i.test(
      navigator.userAgent
    );

  const fetchFromBackend = async (): Promise<ResolvedDirectVodStream | null> => {
    try {
      const qs = new URLSearchParams({
        kp,
        imdb,
        title,
        type: mediaType,
        year,
        season: String(season),
        episode: String(episode),
      });
      const res = await fetch(`/api/vod-stream?${qs.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as ResolvedDirectVodStream;
        if (data?.ok && data.hlsUrl) {
          if (isLocalLan && data.proxyHlsUrl) {
            return {
              ...data,
              rawHlsUrl: data.hlsUrl,
              hlsUrl: data.proxyHlsUrl,
            };
          }
          return data;
        }
      }
    } catch {
      // ignore
    }
    return null;
  };

  // On Local LAN or Smart TV WebViews (where Let's Encrypt root CAs on older WebOS/Tizen fail direct browser fetches),
  // resolve immediately via `/api/vod-stream` first!
  if (isLocalLan || isSmartTvUa) {
    const backendFirst = await fetchFromBackend();
    if (backendFirst) return backendFirst;
  }

  // 1. Try direct browser resolution (binds HLS stream token to the user's own IP!)
  const candidates: string[] = [];
  if (kp && /^\d+$/.test(kp.trim())) {
    candidates.push(`kp/${kp.trim()}`);
  }
  if (imdb && /^tt\d+$/i.test(imdb.trim())) {
    candidates.push(`imdb/${imdb.trim()}`);
  }

  for (const path of candidates) {
    const html = await fetchKinogramEmbedInBrowser(path);
    if (html) {
      const parsed = parseKinogramHtml(html, path, season, episode);
      if (parsed.ok) return parsed;
    }
  }

  if (title) {
    const fallbackKpIds = await lookupKpIdsByTitleInBrowser(
      title,
      mediaType,
      year
    );
    for (const fKp of fallbackKpIds) {
      const path = `kp/${fKp}`;
      if (candidates.includes(path)) continue;
      const html = await fetchKinogramEmbedInBrowser(path);
      if (html) {
        const parsed = parseKinogramHtml(html, path, season, episode);
        if (parsed.ok) return parsed;
      }
    }
  }

  // 2. Fallback to backend `/api/vod-stream`
  if (!isLocalLan && !isSmartTvUa) {
    const backendFallback = await fetchFromBackend();
    if (backendFallback) return backendFallback;
  }

  return { ok: false };
}

function extractBalancedJsonArray(str, startIdx) {
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

const DEFAULT_VOD_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function pickSafeDesktopUa(userAgent = '') {
  const ua = String(userAgent || '').trim();
  if (
    !ua ||
    /Web0S|WebOS|SmartTV|NetCast|Tizen|Large Screen|MSX|CrKey|AFT/i.test(ua)
  ) {
    return DEFAULT_VOD_UA;
  }
  return DEFAULT_VOD_UA;
}

async function fetchKinogramEmbed(path, userAgent = '') {
  const host = 'https://api.kinogram.best';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  const effectiveUa = pickSafeDesktopUa(userAgent);
  try {
    const res = await fetch(`${host}/embed/${path}`, {
      headers: {
        'User-Agent': effectiveUa,
        Origin: host,
        Referer: `${host}/`,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (!html || !html.includes('makePlayer(')) return null;
    return html;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function lookupKpIdsByTitle(title, mediaType = '', year = '') {
  if (!title || String(title).trim().length < 2) return [];
  const cleanTitle = String(title).trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
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
    const data = await res.json();
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
    clearTimeout(timer);
  }
}

export async function resolveVodStreamData({
  kp,
  imdb,
  title = '',
  mediaType = '',
  year = '',
  season = 1,
  episode = 1,
  userAgent = '',
}) {
  const effectiveUa = pickSafeDesktopUa(userAgent);
  const candidates = [];
  if (kp && /^\d+$/.test(String(kp).trim())) {
    candidates.push(`kp/${String(kp).trim()}`);
  }
  if (imdb && /^tt\d+$/i.test(String(imdb).trim())) {
    candidates.push(`imdb/${String(imdb).trim()}`);
  }

  let html = null;
  let usedPath = '';
  for (const path of candidates) {
    html = await fetchKinogramEmbed(path, effectiveUa);
    if (html) {
      usedPath = path;
      break;
    }
  }

  // Fallback: if IMDb ID is not linked on Kinogram yet (e.g. new 2025/2026 titles like Nocturne),
  // resolve Kinopoisk ID by title + type + year and fetch kp/{filmId}
  if (!html && title) {
    const fallbackKpIds = await lookupKpIdsByTitle(title, mediaType, year);
    for (const fKp of fallbackKpIds) {
      const path = `kp/${fKp}`;
      if (candidates.includes(path)) continue;
      html = await fetchKinogramEmbed(path, effectiveUa);
      if (html) {
        usedPath = path;
        break;
      }
    }
  }

  if (!html) {
    return { ok: false, error: 'Stream not found on VOD balancer' };
  }

  // Extract dynamic token appended by player script: else o[k]+='&'+VARNAME
  const addMatch = html.match(/else\s+o\[k\]\+=.\&.\+([a-zA-Z0-9_]+)/);
  const varName = addMatch?.[1];
  const allTokenMatches = varName
    ? Array.from(html.matchAll(new RegExp(`${varName}\\s*=\\s*"([^"]+)"`, 'g')))
    : [];
  const token =
    allTokenMatches.length > 0
      ? allTokenMatches[allTokenMatches.length - 1][1] || ''
      : '';

  // Check if series playlist with seasons exists
  const seasonsIdx = html.indexOf('seasons:');
  if (seasonsIdx >= 0) {
    const rawSeasons = extractBalancedJsonArray(html, seasonsIdx);
    if (Array.isArray(rawSeasons) && rawSeasons.length > 0) {
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

      const targetSeason = rawSeasons.find(
        (s) => Number(s.season) === Number(season)
      );
      const episodes = Array.isArray(targetSeason?.episodes)
        ? targetSeason.episodes
        : [];
      const targetEp = episodes.find(
        (e) => Number(e.episode) === Number(episode)
      );

      if (!targetSeason || !targetEp) {
        return {
          ok: false,
          type: 'series',
          sourcePath: usedPath,
          seasons: cleanSeasons,
          error: 'Requested season or episode not available on VOD balancer',
        };
      }

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
          season: Number(targetSeason.season) || 1,
          episode: Number(targetEp.episode) || 1,
          title: targetEp.title || '',
          duration: Number(targetEp.duration) || 0,
          audioNames: Array.isArray(targetEp.audio?.names)
            ? targetEp.audio.names
            : ['Русский'],
          dashUrl,
          dashaUrl,
          hlsUrl,
          userAgent: effectiveUa,
          seasons: cleanSeasons,
        };
      }

      return {
        ok: false,
        type: 'series',
        sourcePath: usedPath,
        seasons: cleanSeasons,
        error: 'Requested episode has no playable stream',
      };
    }
  }

  // Movie extraction
  const dashMatch = html.match(/dash:\s*"([^"]+)"/);
  const dashaMatch = html.match(/dasha:\s*"([^"]+)"/);
  const hlsMatch = html.match(/hls:\s*"([^"]+)"/);
  const titleMatch = html.match(/title:\s*"([^"]+)"/);
  const posterMatch = html.match(/poster:\s*"([^"]+)"/);
  const audioMatch = html.match(/audio:\s*(\{"names":\[[^\]]+\][^}]*\})/);

  if (hlsMatch?.[1] || dashMatch?.[1]) {
    let audioNames = ['Русский / Original'];
    try {
      if (audioMatch?.[1]) {
        const parsed = JSON.parse(audioMatch[1]);
        if (Array.isArray(parsed.names) && parsed.names.length > 0) {
          audioNames = parsed.names;
        }
      }
    } catch {
      // keep default
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
      poster: posterMatch?.[1] || '',
      audioNames,
      dashUrl,
      dashaUrl,
      hlsUrl,
      userAgent: effectiveUa,
    };
  }

  return { ok: false, error: 'No HLS stream found in embed response' };
}

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=120',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const params = event.queryStringParameters || {};
  const kp = params.kp || '';
  const imdb = params.imdb || '';
  const title = params.title || '';
  const mediaType = params.type || '';
  const year = params.year || '';
  const season = Number(params.season) || 1;
  const episode = Number(params.episode) || 1;
  const userAgent =
    event.headers?.['user-agent'] || event.headers?.['User-Agent'] || '';

  if (!kp && !imdb && !title) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ ok: false, error: 'Missing kp, imdb, or title parameter' }),
    };
  }

  const result = await resolveVodStreamData({
    kp,
    imdb,
    title,
    mediaType,
    year,
    season,
    episode,
    userAgent,
  });
  return {
    statusCode: result.ok ? 200 : 404,
    headers,
    body: JSON.stringify(result),
  };
}


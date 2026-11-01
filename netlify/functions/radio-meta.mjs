/**
 * Netlify Serverless Function: /api/radio-meta
 * Reads live ICY / Icecast metadata from a radio stream URL (or accepts ?rawTitle=),
 * parses Mediaset/RMC tilde (~), Adswizz, ID3, and standard Artist - Title formats,
 * and enriches with high-res Album Cover Art & Artist Portrait from Deezer + iTunes.
 */

const trackRichMetaCache = new Map();

const ISRC_CODE_REGEX = /\b[A-Z]{2}[A-Z0-9]{3}\d{7}\b/gi;
const ISO_DATE_REGEX =
  /\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g;
const ID3_FRAME_REGEX =
  /\b(?:ID3|TIT2|TPE1|TPE2|TALB|TXXX|TRCK|TYER|TDRC|TCON|TCOP|TSSE|PRIV|APIC|WXXX|COMM|USLT|StreamTitle)\b/g;

async function readIcyStreamTitle(streamUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(streamUrl, {
      headers: {
        'Icy-MetaData': '1',
        'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
      },
      signal: controller.signal,
    });

    const metaintHeader = res.headers.get('icy-metaint');
    if (!metaintHeader || !res.body) {
      controller.abort();
      return null;
    }

    const metaint = parseInt(metaintHeader, 10);
    if (!Number.isFinite(metaint) || metaint <= 0 || metaint > 262144) {
      controller.abort();
      return null;
    }

    const reader = res.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    const neededBytes = metaint + 4096;

    while (totalBytes < neededBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      totalBytes += value.length;
      if (totalBytes > metaint) {
        const mergedSoFar = new Uint8Array(totalBytes);
        let offset = 0;
        for (const c of chunks) {
          mergedSoFar.set(c, offset);
          offset += c.length;
        }
        const metaLen = mergedSoFar[metaint] * 16;
        if (totalBytes >= metaint + 1 + metaLen) {
          const metaBytes = mergedSoFar.slice(
            metaint + 1,
            metaint + 1 + metaLen
          );
          await reader.cancel().catch(() => {});
          controller.abort();
          if (metaLen === 0) return null;

          let metaText = new TextDecoder('utf-8', { fatal: false })
            .decode(metaBytes)
            .replace(/\0+$/g, '');
          if (metaText.includes('\uFFFD')) {
            metaText = new TextDecoder('windows-1251')
              .decode(metaBytes)
              .replace(/\0+$/g, '');
          }

          const match = metaText.match(/StreamTitle='([^']*?)'\s*;/i);
          return match ? match[1].trim() : null;
        }
      }
    }
    await reader.cancel().catch(() => {});
    controller.abort();
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readIcecastStatusTitle(streamUrl) {
  try {
    const parsed = new URL(streamUrl);
    const mountPath = parsed.pathname.toLowerCase();
    if (!mountPath || mountPath === '/') return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const statusUrl = `${parsed.origin}/status-json.xsl`;
    const res = await fetch(statusUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const data = await res.json();
    const rawSources = data?.icestats?.source;
    if (!rawSources) return null;
    const sources = Array.isArray(rawSources) ? rawSources : [rawSources];
    const matched =
      sources.find((s) =>
        (s?.listenurl || '').toLowerCase().includes(mountPath)
      ) || (sources.length === 1 ? sources[0] : null);

    const title = (
      matched?.yp_currently_playing ||
      matched?.title ||
      ''
    ).trim();
    return title || null;
  } catch {
    return null;
  }
}

function parseRawStreamMetadataServer(rawInput, stationName = '') {
  let raw = (rawInput || '')
    .replace(/\0+/g, ' ')
    .replace(ID3_FRAME_REGEX, ' ')
    .replace(/StreamUrl='[^']*';?/gi, ' ')
    .replace(/StreamTitle='([^']*)';?/gi, '$1')
    .trim();

  if (!raw || raw.length < 2) return null;
  if (/com\.apple\.streaming\.transportStreamTimestamp/i.test(raw)) return null;

  // 1. JSON payload
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      const t = String(parsed.title || parsed.song || parsed.track || '').trim();
      const a = String(parsed.artist || parsed.performer || '').trim();
      if (t) return { artist: a, title: t };
    } catch {
      // fall through
    }
  }

  // 2. Adswizz / Triton key="value" metadata
  if (/\b(?:title|artist|text)\s*=\s*["']/i.test(raw)) {
    const titleMatch =
      raw.match(/\btitle\s*=\s*["']([^"']+)["']/i) ||
      raw.match(/\btext\s*=\s*["']([^"']+)["']/i);
    const artistMatch = raw.match(/\bartist\s*=\s*["']([^"']+)["']/i);
    if (titleMatch || artistMatch) {
      const extractedTitle = (titleMatch?.[1] || '').trim();
      const extractedArtist = (artistMatch?.[1] || '').trim();
      if (extractedTitle) {
        return { artist: extractedArtist, title: extractedTitle };
      }
    }
  }

  // 3. Mediaset / RMC / Virgin Radio / Radio 105 tilde-delimited format:
  // "Long As I Live~Toni Braxton~~2018~USUM71800544~276~2026-10-31T08:48:00"
  if (raw.includes('~')) {
    const tildeParts = raw.split('~').map((part) =>
      part
        .replace(ISO_DATE_REGEX, '')
        .replace(ISRC_CODE_REGEX, '')
        .trim()
    );

    const isTechnicalToken = (val) => {
      if (!val) return true;
      if (/^\d+$/.test(val)) return true;
      if (/^\d{4}-\d{2}/.test(val)) return true;
      if (/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(val)) return true;
      if (/^(?:MUS|HIT|JNG|COM|ADV|SPOT|LIN|SIG|IDS|NWS)$/i.test(val)) return true;
      return false;
    };

    const candidateTitle = !isTechnicalToken(tildeParts[0] || '') ? tildeParts[0] : '';
    const candidateArtist = !isTechnicalToken(tildeParts[1] || '') ? tildeParts[1] : '';
    const candidateAlbum =
      tildeParts[2] && !isTechnicalToken(tildeParts[2]) && tildeParts[2].length > 1
        ? tildeParts[2]
        : undefined;

    if (candidateTitle && candidateArtist) {
      const normStation = stationName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normTitle = candidateTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normArtist = candidateArtist.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normStation && normTitle === normStation && normArtist === normStation) {
        return null;
      }
      return {
        artist: candidateArtist,
        title: candidateTitle,
        album: candidateAlbum,
      };
    }

    if (candidateTitle || candidateArtist) {
      const single = candidateTitle || candidateArtist;
      return parseRawStreamMetadataServer(single, stationName);
    }
    return null;
  }

  // 4. Standard string cleanup
  let cleaned = raw
    .replace(ISO_DATE_REGEX, ' ')
    .replace(ISRC_CODE_REGEX, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(
      /\(\s*(?:live|bonus|remix|radio edit|edit|extended|version|ost|from|official|video|audio|hd|hq|\d{4})[^)]*\)/gi,
      ' '
    )
    .replace(/\s+[-|]\s+\d{1,2}:\d{2}\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 2) return null;

  if (!/\s+[-–—]\s+/.test(cleaned)) {
    if (/\s+\|\s+/.test(cleaned)) {
      cleaned = cleaned.replace(/\s+\|\s+/g, ' - ');
    } else if (/\s+\/\s+/.test(cleaned)) {
      cleaned = cleaned.replace(/\s+\/\s+/g, ' - ');
    }
  }

  const rawParts = cleaned.split(/\s+[-–—]\s+/);
  if (
    rawParts.length >= 3 &&
    /fm|radio|rmc|virgin|zu|kiss|magic|rock|pro|digi|europa|dfm|retro|hit/i.test(
      rawParts[0]
    )
  ) {
    cleaned = rawParts.slice(1).join(' - ');
  }

  const parts = cleaned
    .split(/\s+[-–—]\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      artist: parts[0],
      title: parts.slice(1).join(' - '),
    };
  }

  return { artist: '', title: cleaned };
}

function isGenericStationSlogan(raw, stationName) {
  const s = (raw || '').trim().toLowerCase();
  if (!s || s.length < 3) return true;
  if (
    /^(unknown|stream|offline|live|on air|reclama|publicitate|commercial|jingle|spot|реклама|новости)$/i.test(
      s
    )
  ) {
    return true;
  }
  if (
    /\b(publicitate|reclama|commercial break|рекламная пауза|реклама)\b/i.test(s)
  ) {
    return true;
  }
  if (
    /always the best music|radiovanya\.ru|actualitati\s*-\s*\d{4}|\.ru$|\.ro$|\.com$/i.test(
      s
    )
  ) {
    return true;
  }
  const cleanStation = (stationName || '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]/gi, '');
  const cleanRaw = s.replace(/[^a-z0-9а-яё]/gi, '');
  if (cleanStation && cleanRaw === cleanStation) return true;
  return false;
}

async function resolveRichTrackMetadata(rawStreamTitle, stationName = '') {
  const parsedFields = parseRawStreamMetadataServer(rawStreamTitle, stationName);
  if (!parsedFields || (!parsedFields.title && !parsedFields.artist)) {
    return null;
  }

  if (
    isGenericStationSlogan(parsedFields.title, stationName) &&
    (!parsedFields.artist || isGenericStationSlogan(parsedFields.artist, stationName))
  ) {
    return null;
  }

  const cacheKey = `${parsedFields.artist}:::${parsedFields.title}`.toLowerCase();
  const cached = trackRichMetaCache.get(cacheKey);
  if (cached && Date.now() - cached.updatedAt < 30 * 60 * 1000) {
    return cached;
  }

  let artist = parsedFields.artist;
  let title = parsedFields.title;
  let album = parsedFields.album || '';
  let coverUrl = '';
  let artistAvatarUrl = '';

  const primaryArtist = artist
    ? artist.split(/[,&/;]|feat\.?|ft\.?|vs\.?|with/i)[0].trim()
    : '';
  const cleanSongTitle = title
    .replace(/\([^)]*\)/g, '')
    .replace(/feat\.?.*$/i, '')
    .trim();

  const queries = Array.from(
    new Set(
      [
        primaryArtist && cleanSongTitle
          ? `artist:"${primaryArtist}" track:"${cleanSongTitle}"`
          : '',
        artist && title ? `${artist} ${title}` : '',
        primaryArtist && cleanSongTitle
          ? `${primaryArtist} ${cleanSongTitle}`
          : '',
        !artist && cleanSongTitle ? cleanSongTitle : '',
      ].filter(Boolean)
    )
  );

  // 1. Deezer Search API
  for (const q of queries) {
    try {
      const ctrl = new AbortController();
      const tId = setTimeout(() => ctrl.abort(), 3200);
      const r = await fetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=3`,
        { signal: ctrl.signal }
      );
      clearTimeout(tId);
      if (r.ok) {
        const j = await r.json();
        const item = j?.data?.[0];
        if (item) {
          artist = item.artist?.name || artist;
          title = item.title || title;
          album = item.album?.title || album;
          coverUrl =
            item.album?.cover_xl ||
            item.album?.cover_big ||
            item.album?.cover_medium ||
            '';
          artistAvatarUrl =
            item.artist?.picture_xl ||
            item.artist?.picture_big ||
            item.artist?.picture_medium ||
            '';
          break;
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Fallback to iTunes Search API (US + regional RU/RO)
  if (!coverUrl) {
    const itunesQuery =
      (primaryArtist && cleanSongTitle
        ? `${primaryArtist} ${cleanSongTitle}`
        : '') ||
      (artist && title ? `${artist} ${title}` : '') ||
      cleanSongTitle;

    if (itunesQuery) {
      const countries = /[а-яА-ЯёЁ]/.test(itunesQuery)
        ? ['RU', 'US']
        : ['US', 'RO'];

      for (const countryParam of countries) {
        if (coverUrl) break;
        try {
          const ctrl = new AbortController();
          const tId = setTimeout(() => ctrl.abort(), 3200);
          const r = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(
              itunesQuery
            )}&country=${countryParam}&entity=song&limit=3`,
            { signal: ctrl.signal }
          );
          clearTimeout(tId);
          if (r.ok) {
            const j = await r.json();
            const item = j?.results?.[0];
            if (item) {
              artist = item.artistName || artist;
              title = item.trackName || title;
              album = item.collectionName || album;
              if (item.artworkUrl100) {
                coverUrl = item.artworkUrl100.replace(
                  /\d+x\d+bb/,
                  '600x600bb'
                );
              }
            }
          }
        } catch {
          // ignore
        }
      }
    }
  }

  // 3. Look up Artist Avatar on Deezer if still missing
  if (!artistAvatarUrl && (primaryArtist || artist)) {
    try {
      const ctrl = new AbortController();
      const tId = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch(
        `https://api.deezer.com/search/artist?q=${encodeURIComponent(
          primaryArtist || artist
        )}&limit=1`,
        { signal: ctrl.signal }
      );
      clearTimeout(tId);
      if (r.ok) {
        const j = await r.json();
        const art = j?.data?.[0];
        if (art) {
          artistAvatarUrl =
            art.picture_xl || art.picture_big || art.picture_medium || '';
        }
      }
    } catch {
      // ignore
    }
  }

  const finalCoverUrl = coverUrl || artistAvatarUrl || undefined;
  const finalArtistAvatarUrl = artistAvatarUrl || coverUrl || undefined;

  const result = {
    rawTitle: rawStreamTitle,
    artist: artist || '',
    title: title || rawStreamTitle,
    album: album || undefined,
    coverUrl: finalCoverUrl,
    artistAvatarUrl: finalArtistAvatarUrl,
    updatedAt: Date.now(),
  };

  trackRichMetaCache.set(cacheKey, result);
  return result;
}

export default async (req) => {
  try {
    const reqUrl = new URL(req.url);
    const streamUrl = (reqUrl.searchParams.get('url') || '').trim();
    const stationName = (reqUrl.searchParams.get('name') || '').trim();
    let rawTitle = (reqUrl.searchParams.get('rawTitle') || '').trim();

    if (!rawTitle && streamUrl && /^https?:\/\//i.test(streamUrl)) {
      const icyTitle = await readIcyStreamTitle(streamUrl);
      if (icyTitle) {
        rawTitle = icyTitle;
      } else {
        const icecastTitle = await readIcecastStatusTitle(streamUrl);
        if (icecastTitle) {
          rawTitle = icecastTitle;
        }
      }
    }

    if (!rawTitle || isGenericStationSlogan(rawTitle, stationName)) {
      return new Response(JSON.stringify({ track: null }), {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }

    const track = await resolveRichTrackMetadata(rawTitle, stationName);
    return new Response(JSON.stringify({ track }), {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch {
    return new Response(JSON.stringify({ track: null }), {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }
};

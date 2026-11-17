const IOS_PRODUCER_UA =
  'com.google.ios.youtube.producer/0.145.1 (iPhone16,2; U; CPU iOS 18_2_1 like Mac OS X;)';
const IOS_MAIN_UA =
  'com.google.ios.youtube/20.03.02 (iPhone16,2; U; CPU iOS 18_2_1 like Mac OS X;)';
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const searchCache = new Map();
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

const streamCache = new Map();
const STREAM_CACHE_TTL_MS = 25 * 60 * 1000;

function parseDurationTextToSeconds(raw = '') {
  if (!raw) return 0;
  const parts = String(raw)
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

function extractYouTubeVideoItems(data) {
  const items = [];
  const seen = new Set();

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.videoRenderer && node.videoRenderer.videoId) {
      const vr = node.videoRenderer;
      const videoId = String(vr.videoId);
      if (!seen.has(videoId)) {
        seen.add(videoId);
        const title =
          vr.title?.runs?.map((r) => r.text || '').join('') ||
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
          vr.badges.some((b) =>
            String(b?.metadataBadgeRenderer?.style || '').includes('LIVE')
          );
        const views =
          vr.shortViewCountText?.simpleText ||
          vr.viewCountText?.simpleText ||
          vr.viewCountText?.runs?.map((r) => r.text || '').join('') ||
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
    for (const val of Object.values(node)) {
      if (items.length < 36) {
        walk(val);
      }
    }
  }

  walk(data);
  return items;
}

function pickBestMusicVideoMatch(results) {
  return (
    results.find(
      (r) =>
        !r.isLive &&
        r.durationSec >= 65 &&
        r.durationSec <= 1200 &&
        !SHORT_SNIPPET_RE.test(r.title || '')
    ) ||
    results.find((r) => !r.isLive && r.durationSec >= 45) ||
    results[0]
  );
}

async function searchYouTubeVideos(cleanQuery = 'trending romania') {
  const cacheKey = cleanQuery.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < SEARCH_CACHE_TTL_MS) {
    return cached.items;
  }

  let items = [];
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
      items = extractYouTubeVideoItems(await itRes.json());
    }
  } catch {
    // fallback to HTML below
  }

  if (items.length === 0) {
    try {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(
        cleanQuery
      )}&hl=ro&gl=RO`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': DESKTOP_UA,
          'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
          Cookie: 'CONSENT=YES+cb.20210328-17-p0.en+FX+410',
        },
      });
      if (res.ok) {
        const html = await res.text();
        const match = html.match(/var ytInitialData = (\{.+?\});<\/script>/);
        if (match?.[1]) {
          items = extractYouTubeVideoItems(JSON.parse(match[1]));
        }
      }
    } catch {
      // ignore
    }
  }

  if (items.length > 0) {
    searchCache.set(cacheKey, { items, ts: Date.now() });
  }
  return items;
}

function selectBestAudioFormat(adaptive = []) {
  const candidates = adaptive
    .filter(
      (f) =>
        f?.url &&
        (String(f.mimeType || '').startsWith('audio/mp4') ||
          String(f.mimeType || '').startsWith('audio/webm') ||
          f.itag === 140 ||
          f.itag === 251 ||
          f.itag === 141 ||
          f.itag === 139)
    )
    .sort((a, b) => {
      const mp4A = String(a.mimeType || '').startsWith('audio/mp4') || a.itag === 140 || a.itag === 139 ? 1 : 0;
      const mp4B = String(b.mimeType || '').startsWith('audio/mp4') || b.itag === 140 || b.itag === 139 ? 1 : 0;
      if (mp4B !== mp4A) return mp4B - mp4A;
      const tagScoreA = a.itag === 139 ? 2 : a.itag === 140 ? 1 : 0;
      const tagScoreB = b.itag === 139 ? 2 : b.itag === 140 ? 1 : 0;
      if (tagScoreB !== tagScoreA) return tagScoreB - tagScoreA;
      return (Number(b.bitrate || b.averageBitrate) || 0) - (Number(a.bitrate || a.averageBitrate) || 0);
    });
  return candidates[0] || null;
}

async function resolveYouTubeAudioStream(videoId, forceRefresh = false) {
  const cleanId = (videoId || '').trim();
  if (!cleanId) return null;

  const cached = streamCache.get(cleanId);
  if (!forceRefresh && cached && Date.now() - cached.ts < STREAM_CACHE_TTL_MS) {
    return cached;
  }

  const contexts = [
    {
      ua: IOS_PRODUCER_UA,
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
    {
      ua: IOS_MAIN_UA,
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
  ];

  for (const ctx of contexts) {
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': ctx.ua,
        },
        body: JSON.stringify({
          videoId: cleanId,
          contentCheckOk: true,
          racyCheckOk: true,
          context: { client: ctx.client },
        }),
      });
      if (!res.ok) continue;
      const playerData = await res.json();
      const bestAudio = selectBestAudioFormat(playerData?.streamingData?.adaptiveFormats || []);
      if (bestAudio?.url) {
        const entry = {
          url: String(bestAudio.url),
          contentLength: Number(bestAudio.contentLength) || 0,
          mimeType: String(bestAudio.mimeType || 'audio/mp4').split(';')[0] || 'audio/mp4',
          durationSec: Number(playerData?.videoDetails?.lengthSeconds) || 0,
          userAgent: ctx.ua,
          ts: Date.now(),
        };
        streamCache.set(cleanId, entry);
        return entry;
      }
    } catch {
      // try next client context
    }
  }
  return null;
}

const FALLBACK_MUSIC_IMG =
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80';

function normalizeMusicKeyPart(raw = '') {
  return String(raw || '')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9а-яёăâîșț]/gi, '');
}

function mapDeezerTrack(d, indexHint = 0, albumOverride = null) {
  const artistName = String(d?.artist?.name || albumOverride?.artistName || '').trim();
  const title = String(d?.title_short || d?.title || '').trim();
  if (!title || !artistName) return null;
  const album = String(d?.album?.title || albumOverride?.title || title).trim();
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
  const audioQuery = `${artistName} - ${title} Official Audio`;
  const isHiRes = indexHint % 3 !== 2;
  const rawArtistId = d?.artist?.id ?? albumOverride?.artistId;
  const rawAlbumId = d?.album?.id ?? albumOverride?.id;
  return {
    id: `dz_${d.id || Math.random().toString(36).slice(2, 9)}`,
    title,
    artist: artistName,
    artistId: rawArtistId ? `dz_art_${rawArtistId}` : undefined,
    artistAvatar:
      String(
        d?.artist?.picture_xl ||
          d?.artist?.picture_big ||
          d?.artist?.picture_medium ||
          albumOverride?.artistAvatar ||
          ''
      ) || undefined,
    album,
    albumId: rawAlbumId ? `dz_alb_${rawAlbumId}` : undefined,
    cover,
    coverSmall,
    durationSec,
    year: albumOverride?.year || 2025,
    genre: 'TIDAL MAX • Pop / Hits',
    previewUrl: String(d?.preview || ''),
    fullAudioUrl: `/api/youtube/audio?q=${encodeURIComponent(audioQuery)}`,
    videoQuery: `${artistName} - ${title}`,
    qualityTier: isHiRes ? 'MAX' : 'HIFI',
    qualityLabel: isHiRes
      ? 'MAX • 24-bit / 192 kHz FLAC'
      : 'HiFi • 16-bit / 44.1 kHz FLAC',
    bitrateKbps: isHiRes ? 9216 : 1411,
  };
}

function mapItunesTrack(r, indexHint = 0) {
  if (!r?.trackName || !r?.artistName) return null;
  const rawArt = String(r.artworkUrl100 || r.artworkUrl60 || '');
  const cover = rawArt ? rawArt.replace(/\d+x\d+bb/, '1000x1000bb') : FALLBACK_MUSIC_IMG;
  const coverSmall = rawArt ? rawArt.replace(/\d+x\d+bb/, '300x300bb') : cover;
  const durationSec = Math.max(
    45,
    Math.round((Number(r.trackTimeMillis) || 200000) / 1000)
  );
  const year = r.releaseDate ? Number(String(r.releaseDate).slice(0, 4)) || 2025 : 2025;
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
    fullAudioUrl: `/api/youtube/audio?q=${encodeURIComponent(audioQuery)}`,
    videoQuery: `${artist} - ${title}`,
    qualityTier: isHiRes ? 'MAX' : 'HIFI',
    qualityLabel: isHiRes
      ? 'MAX • 24-bit / 192 kHz FLAC'
      : 'HiFi • 16-bit / 44.1 kHz FLAC',
    bitrateKbps: isHiRes ? 9216 : 1411,
  };
}

async function fetchItunesTracks(query, country = 'RO', limit = 50) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      query
    )}&country=${encodeURIComponent(country)}&media=music&entity=song&limit=${limit}`;
    const res = await fetch(url, { headers: { 'User-Agent': DESKTOP_UA } });
    if (!res.ok) return [];
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    return results.map((item, idx) => mapItunesTrack(item, idx)).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchDeezerTracks(query, limit = 50) {
  try {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url, { headers: { 'User-Agent': DESKTOP_UA } });
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data?.data) ? data.data : [];
    return list.map((item, idx) => mapDeezerTrack(item, idx)).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchDeezerArtistsSearch(query, limit = 10) {
  try {
    const res = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(query)}&limit=${limit}`,
      { headers: { 'User-Agent': DESKTOP_UA } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data?.data) ? data.data : [];
    const sorted = [...list].sort((a, b) => (Number(b.nb_fan) || 0) - (Number(a.nb_fan) || 0));
    const seen = new Set();
    const out = [];
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

async function fetchDeezerAlbumsSearch(query, limit = 12) {
  try {
    const res = await fetch(
      `https://api.deezer.com/search/album?q=${encodeURIComponent(query)}&limit=${limit}`,
      { headers: { 'User-Agent': DESKTOP_UA } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data?.data) ? data.data : [];
    const seen = new Set();
    const out = [];
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

async function resolveCanonicalDeezerArtist(name, id = '') {
  const cleanId = (id || '').trim();
  if (cleanId.startsWith('dz_art_') && /^\d+$/.test(cleanId.slice(7))) {
    const numId = cleanId.slice(7);
    try {
      const r = await fetch(`https://api.deezer.com/artist/${numId}`, {
        headers: { 'User-Agent': DESKTOP_UA },
      });
      if (r.ok) {
        const a = await r.json();
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
      // fall through
    }
  }

  const cleanName = (name || '').split(/[&,]/)[0].trim() || (name || '').trim();
  if (!cleanName) return null;
  try {
    const res = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(cleanName)}&limit=10`,
      { headers: { 'User-Agent': DESKTOP_UA } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const list = Array.isArray(data?.data) ? data.data : [];
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

function interleaveMaxTwoConsecutive(items, limit) {
  const remaining = [...items];
  const result = [];
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

export async function handler(event) {
  const jsonHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=180',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: jsonHeaders, body: '' };
  }

  const path = event.path || '';
  const params = event.queryStringParameters || {};

  // 0A. ARTIST PROFILE ROUTE
  if (path.includes('/artist-profile') || params.action === 'artist-profile') {
    const name = String(params.name || params.q || '').trim();
    const id = String(params.id || '').trim();
    try {
      const artistObj = await resolveCanonicalDeezerArtist(name, id);
      if (!artistObj) {
        const itFallback = name ? await fetchItunesTracks(name, 'RO', 15) : [];
        return {
          statusCode: 200,
          headers: jsonHeaders,
          body: JSON.stringify({
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
          }),
        };
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
        .map((t, idx) => mapDeezerTrack(t, idx))
        .filter(Boolean);

      if (topTracks.length < 5) {
        const itExtra = await fetchItunesTracks(artistObj.name, 'RO', 12);
        const seen = new Set(topTracks.map((t) => normalizeMusicKeyPart(t.title)));
        for (const t of itExtra) {
          if (t && !seen.has(normalizeMusicKeyPart(t.title))) {
            seen.add(normalizeMusicKeyPart(t.title));
            topTracks.push(t);
          }
        }
      }

      const seenAlb = new Set();
      const albums = [];
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
        .filter((r) => r?.name && r?.id)
        .map((r) => ({
          id: `dz_art_${r.id}`,
          dzId: String(r.id),
          name: String(r.name).trim(),
          avatar: String(r.picture_xl || r.picture_big || r.picture_medium || FALLBACK_MUSIC_IMG),
          fans: Number(r.nb_fan) || 0,
        }));

      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          ok: true,
          artist: artistObj,
          topTracks,
          albums,
          relatedArtists,
        }),
      };
    } catch (err) {
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          ok: false,
          error: String(err),
          artist: null,
          topTracks: [],
          albums: [],
          relatedArtists: [],
        }),
      };
    }
  }

  // 0B. ALBUM DETAILS ROUTE
  if (path.includes('/album-details') || params.action === 'album-details') {
    const albumName = String(params.album || '').trim();
    const artistName = String(params.artist || '').trim();
    const rawId = String(params.id || '').trim();
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
          const sd = await searchRes.json();
          const list = Array.isArray(sd?.data) ? sd.data : [];
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
          const full = await albRes.json();
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

            const rawTracks = Array.isArray(full.tracks?.data) ? full.tracks.data : [];
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

            const moreAlbums = [];
            if (albArtId) {
              try {
                const moreRes = await fetch(
                  `https://api.deezer.com/artist/${albArtId}/albums?limit=10`,
                  { headers: { 'User-Agent': DESKTOP_UA } }
                );
                if (moreRes.ok) {
                  const md = await moreRes.json();
                  const seenMore = new Set([normalizeMusicKeyPart(full.title || '')]);
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
                // ignore
              }
            }

            const totalDurationSec =
              Number(full.duration) ||
              tracks.reduce((sum, t) => sum + (t.durationSec || 0), 0);

            return {
              statusCode: 200,
              headers: jsonHeaders,
              body: JSON.stringify({
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
              }),
            };
          }
        }
      }

      const itTerm = `${artistName} ${albumName}`.trim();
      let itTracks = await fetchItunesTracks(itTerm, 'RO', 25);
      if (albumName) {
        const na = normalizeMusicKeyPart(albumName);
        const filtered = itTracks.filter((t) =>
          normalizeMusicKeyPart(t.album || '').includes(na)
        );
        if (filtered.length > 0) itTracks = filtered;
      }
      const first = itTracks[0];
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
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
            totalDurationSec: itTracks.reduce((acc, t) => acc + (t.durationSec || 0), 0),
            tracks: itTracks,
            moreAlbums: [],
          },
        }),
      };
    } catch (err) {
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ ok: false, error: String(err), album: null }),
      };
    }
  }

  // 0C. SONG RADIO PLAYLIST GENERATOR ROUTE
  if (path.includes('/song-radio') || params.action === 'song-radio') {
    const trackName = String(params.track || '').trim();
    const artistName = String(params.artist || '').trim();
    const artistId = String(params.artistId || '').trim();
    const limit = Math.min(50, Math.max(15, parseInt(params.limit || '40', 10) || 40));

    try {
      const canonical = await resolveCanonicalDeezerArtist(artistName, artistId);
      const seenKeys = new Set();
      const rawPool = [];
      const addUnique = (t) => {
        if (!t?.title || !t?.artist) return;
        const k = `${normalizeMusicKeyPart(t.artist)}__${normalizeMusicKeyPart(t.title)}`;
        if (!k || seenKeys.has(k)) return;
        seenKeys.add(k);
        rawPool.push(t);
      };

      const relatedNames = [];

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

        const radioRaw = Array.isArray(radioRes?.data) ? radioRes.data : [];
        const topRaw = Array.isArray(topRes?.data) ? topRes.data : [];
        const relArtists = Array.isArray(relRes?.data) ? relRes.data : [];

        for (const ra of relArtists) {
          if (ra?.name && relatedNames.length < 4) {
            relatedNames.push(String(ra.name).trim());
          }
        }

        let relTopBuckets = [];
        if (radioRaw.length < 18 && relArtists.length > 0) {
          relTopBuckets = await Promise.all(
            relArtists.slice(0, 4).map(async (ra) => {
              try {
                const rr = await fetch(`https://api.deezer.com/artist/${ra.id}/top?limit=6`, {
                  headers: { 'User-Agent': DESKTOP_UA },
                });
                if (!rr.ok) return [];
                const rd = await rr.json();
                return (Array.isArray(rd?.data) ? rd.data : [])
                  .map((x, i) => mapDeezerTrack(x, i))
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
          fetchDeezerTracks(`${artistName} ${trackName}`.trim(), 20),
          fetchItunesTracks(artistName || trackName, 'RO', 25),
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

      return {
        statusCode: 200,
        headers: { ...jsonHeaders, 'Cache-Control': 'no-cache' },
        body: JSON.stringify({
          ok: true,
          radioTitle: trackName ? `Radio ${trackName}` : `Radio ${canonical?.name || artistName}`,
          seedArtist: canonical?.name || artistName,
          seedArtistAvatar: canonical?.avatar || '',
          relatedNames,
          tracks: mixed,
        }),
      };
    } catch (err) {
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          ok: false,
          error: String(err),
          radioTitle: trackName ? `Radio ${trackName}` : 'Radio Mix',
          seedArtist: artistName,
          relatedNames: [],
          tracks: [],
        }),
      };
    }
  }

  // 0D. SYNCED LYRICS ROUTE (LRCLIB)
  if (path.includes('/lyrics') || params.action === 'lyrics') {
    const rawTrack = String(params.track || '').trim();
    const rawArtist = String(params.artist || '').trim();
    const stripNoise = (s) =>
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
          const d = await directRes.json();
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
            const arr = (await searchRes.json()) || [];
            if (Array.isArray(arr) && arr.length > 0) {
              const best = arr.find((x) => Boolean(x?.syncedLyrics)) || arr[0];
              if (best?.syncedLyrics) syncedLyrics = String(best.syncedLyrics);
              if (!plainLyrics && best?.plainLyrics) plainLyrics = String(best.plainLyrics);
              if (best?.instrumental) instrumental = Boolean(best.instrumental);
            }
          }
        }
      }

      return {
        statusCode: 200,
        headers: { ...jsonHeaders, 'Cache-Control': 'public, max-age=1800' },
        body: JSON.stringify({
          ok: Boolean(syncedLyrics || plainLyrics),
          syncedLyrics: syncedLyrics || null,
          plainLyrics: plainLyrics || null,
          instrumental,
        }),
      };
    } catch {
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          ok: false,
          syncedLyrics: null,
          plainLyrics: null,
          instrumental: false,
        }),
      };
    }
  }

  // 1. MUSIC CATALOG ROUTE
  if (path.includes('/music-catalog') || params.action === 'music-catalog') {
    const rawQuery = (params.q || params.term || '__GLOBAL_TOP_50__').trim();
    const country = (params.country || 'RO').trim().toUpperCase();
    const limit = Math.min(60, Math.max(5, parseInt(params.limit || '50', 10) || 50));
    const isGlobalTop =
      rawQuery === '__GLOBAL_TOP_50__' ||
      params.playlistId === 'pl_global_hits' ||
      rawQuery.toLowerCase() === 'top hits global';

    try {
      const seenKeys = new Set();
      const tracks = [];
      let artists = [];
      let albums = [];

      const pushUnique = (item) => {
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

      if (isGlobalTop) {
        const [dzChartRes, itunesLists] = await Promise.all([
          fetch('https://api.deezer.com/chart/0/tracks?limit=50', {
            headers: { 'User-Agent': DESKTOP_UA },
          })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
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
            ].map((a) => fetchItunesTracks(a, country, 8))
          ),
        ]);

        const rawList = Array.isArray(dzChartRes?.data) ? dzChartRes.data : [];
        for (const [idx, item] of rawList.entries()) {
          pushUnique(mapDeezerTrack(item, idx));
        }
        for (let row = 0; row < 8 && tracks.length < limit; row++) {
          for (const bucket of itunesLists) {
            if (bucket[row]) pushUnique(bucket[row]);
          }
        }
      } else {
        const parts = rawQuery.split(/[,|;]+/).map((s) => s.trim()).filter(Boolean);
        if (parts.length > 1) {
          const perPartLimit = Math.max(8, Math.ceil((limit * 1.4) / parts.length));
          const buckets = await Promise.all(
            parts.map(async (part) => {
              const [dzList, itList] = await Promise.all([
                fetchDeezerTracks(part, perPartLimit),
                fetchItunesTracks(part, country, perPartLimit),
              ]);
              const merged = [];
              const maxLen = Math.max(dzList.length, itList.length);
              for (let i = 0; i < maxLen; i++) {
                if (itList[i]) merged.push(itList[i]);
                if (dzList[i]) merged.push(dzList[i]);
              }
              return merged;
            })
          );
          for (let row = 0; row < 30 && tracks.length < limit; row++) {
            for (const bucket of buckets) {
              if (bucket[row]) pushUnique(bucket[row]);
            }
          }
        } else {
          // Single search query: fetch tracks + artists + albums in parallel
          const [itList, dzList, dzArtists, dzAlbums] = await Promise.all([
            fetchItunesTracks(rawQuery, country, limit),
            fetchDeezerTracks(rawQuery, limit),
            !params.playlistId ? fetchDeezerArtistsSearch(rawQuery, 10) : Promise.resolve([]),
            !params.playlistId ? fetchDeezerAlbumsSearch(rawQuery, 12) : Promise.resolve([]),
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

      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ ok: true, tracks, artists, albums }),
      };
    } catch (err) {
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ ok: false, error: String(err), tracks: [], artists: [], albums: [] }),
      };
    }
  }

  // 2. AUDIO RESOLVER ROUTE
  if (path.includes('/audio') || params.action === 'audio') {
    let id = (params.id || '').trim();
    const q = (params.q || '').trim();

    try {
      if (!id && q) {
        const results = await searchYouTubeVideos(q);
        const bestMatch = pickBestMusicVideoMatch(results);
        if (bestMatch?.videoId) {
          id = bestMatch.videoId;
        }
      }

      if (id) {
        let streamInfo = await resolveYouTubeAudioStream(id);
        if (streamInfo?.url && streamInfo.contentLength > 0) {
          const reqHeaders = event.headers || {};
          const rangeHeader = String(reqHeaders.range || reqHeaders.Range || '');
          const totalSize = streamInfo.contentLength;
          const rangeMatch = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader.trim());
          const reqStart = rangeMatch
            ? Math.min(Math.max(0, Number(rangeMatch[1])), totalSize - 1)
            : 0;
          const requestedEnd =
            rangeMatch && rangeMatch[2]
              ? Math.min(Math.max(reqStart, Number(rangeMatch[2])), totalSize - 1)
              : totalSize - 1;
          const MAX_LAMBDA_WINDOW = 3 * 1048576;
          const reqEnd = Math.min(requestedEnd, reqStart + MAX_LAMBDA_WINDOW - 1);

          const stripRange = (raw) => {
            try {
              const u = new URL(raw);
              u.searchParams.delete('range');
              return u.toString();
            } catch {
              return String(raw).replace(/[?&]range=[^&]*/g, '');
            }
          };

          let baseUrl = stripRange(streamInfo.url);
          const CHUNK_SIZE = 1048576;
          const chunks = [];
          let pos = reqStart;
          let refreshedOnce = false;

          while (pos <= reqEnd) {
            const chunkEnd = Math.min(reqEnd, pos + CHUNK_SIZE - 1);
            const sep = baseUrl.includes('?') ? '&' : '?';
            let chunkBuf = null;
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                const cRes = await fetch(`${baseUrl}${sep}range=${pos}-${chunkEnd}`, {
                  headers: { 'User-Agent': streamInfo.userAgent },
                });
                if (cRes.status === 403 && !refreshedOnce) {
                  refreshedOnce = true;
                  const refreshed = await resolveYouTubeAudioStream(id, true);
                  if (refreshed?.url) {
                    streamInfo = refreshed;
                    baseUrl = stripRange(streamInfo.url);
                  }
                  continue;
                }
                if (cRes.ok || cRes.status === 206) {
                  const ab = await cRes.arrayBuffer();
                  if (ab.byteLength > 0) {
                    chunkBuf = Buffer.from(ab);
                    break;
                  }
                }
              } catch {
                // retry once
              }
            }
            if (!chunkBuf) break;
            chunks.push(chunkBuf);
            pos += chunkBuf.byteLength;
          }

          if (chunks.length > 0) {
            const outBuf = Buffer.concat(chunks);
            const actualEnd = reqStart + outBuf.byteLength - 1;
            const isPartial = Boolean(rangeMatch) || actualEnd < totalSize - 1;
            return {
              statusCode: isPartial ? 206 : 200,
              isBase64Encoded: true,
              headers: {
                'Content-Type': streamInfo.mimeType || 'audio/mp4',
                'Accept-Ranges': 'bytes',
                'Content-Length': String(outBuf.byteLength),
                ...(isPartial
                  ? { 'Content-Range': `bytes ${reqStart}-${actualEnd}/${totalSize}` }
                  : {}),
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=86400',
                'Netlify-CDN-Cache-Control': 'public, max-age=86400, durable',
                ...(streamInfo.durationSec > 0
                  ? {
                      'X-Content-Duration': String(streamInfo.durationSec),
                      'Access-Control-Expose-Headers':
                        'X-Content-Duration, Content-Range, Accept-Ranges',
                    }
                  : {
                      'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges',
                    }),
              },
              body: outBuf.toString('base64'),
            };
          }
        }
      }

      // Fallback: search Deezer 30s preview URL so audio NEVER dies
      const searchDeezerFallback = async (term) => {
        try {
          const r = await fetch(
            `https://api.deezer.com/search?q=${encodeURIComponent(term)}&limit=1`,
            { headers: { 'User-Agent': DESKTOP_UA } }
          );
          if (!r.ok) return null;
          const d = await r.json();
          return d?.data?.[0]?.preview || null;
        } catch {
          return null;
        }
      };

      const fallbackPreview = await searchDeezerFallback(q || id);
      if (fallbackPreview) {
        return {
          statusCode: 302,
          headers: {
            Location: fallbackPreview,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=1800',
          },
          body: '',
        };
      }

      return {
        statusCode: 404,
        headers: jsonHeaders,
        body: JSON.stringify({ ok: false, error: 'Audio source not found' }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: jsonHeaders,
        body: JSON.stringify({ ok: false, error: String(err) }),
      };
    }
  }

  // 3. YOUTUBE VIDEO SEARCH (Default)
  const cleanQuery = String(params.q || '').trim() || 'trending romania';
  try {
    const items = await searchYouTubeVideos(cleanQuery);
    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, items }),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, items: [], error: String(err) }),
    };
  }
}

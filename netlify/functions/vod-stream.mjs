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
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

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

function parseDurationToSeconds(durStr) {
  if (!durStr) return 0;
  if (typeof durStr === 'number') return durStr;
  const parts = String(durStr).trim().split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function decodeVkHtmlEntities(str) {
  return String(str || '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#33;/g, '!')
    .replace(/&#39;/g, "'")
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/\\\//g, '/')
    .trim();
}

const vkPlaylistCache = new Map();
const VK_CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchVkRawSectionList(oid, section) {
  const cacheKey = `${oid}_${section}`;
  const cached = vkPlaylistCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < VK_CACHE_TTL_MS) {
    return cached.list;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch('https://vkvideo.ru/al_video.php?act=load_videos_silent', {
      method: 'POST',
      headers: {
        'User-Agent': DEFAULT_VOD_UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        Origin: 'https://vkvideo.ru',
        Referer: 'https://vkvideo.ru/',
      },
      body: `al=1&oid=${oid}&section=${section}&offset=0`,
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const text = new TextDecoder('windows-1251').decode(await res.arrayBuffer());
    const data = JSON.parse(text);
    const list = data?.payload?.[1]?.[0]?.[section]?.list || [];
    if (Array.isArray(list) && list.length > 0) {
      vkPlaylistCache.set(cacheKey, { ts: Date.now(), list });
    }
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function wrapTvProxyUrl(
  rawUrl,
  refUrl = 'https://vkvideo.ru/',
  ua = DEFAULT_VOD_UA
) {
  if (!rawUrl) return '';
  if (String(rawUrl).startsWith('/api/tv-proxy')) return String(rawUrl);
  return `/api/tv-proxy?url=${encodeURIComponent(rawUrl)}&ref=${encodeURIComponent(refUrl)}&ua=${encodeURIComponent(ua)}`;
}

async function extractVkVideoStreams(oid, vid) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch('https://vkvideo.ru/al_video.php?act=show', {
      method: 'POST',
      headers: {
        'User-Agent': DEFAULT_VOD_UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        Origin: 'https://vkvideo.ru',
        Referer: 'https://vkvideo.ru/',
      },
      body: `act=show&al=1&video=${oid}_${vid}`,
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const text = new TextDecoder('windows-1251').decode(await res.arrayBuffer());
    const unescapeUrl = (u) =>
      u ? u.replace(/\\\//g, '/').replace(/\\u0026/g, '&') : '';
    const hlsMatch = text.match(/"hls"\s*:\s*"([^"]+)"/);
    const hlsUrl = unescapeUrl(hlsMatch?.[1]);
    const mp4Matches = [...text.matchAll(/"url(\d+)"\s*:\s*"([^"]+)"/g)];
    const qualities = mp4Matches
      .map((m) => ({ height: Number(m[1]), url: unescapeUrl(m[2]) }))
      .filter((q) => q.height >= 360 && q.url)
      .sort((a, b) => b.height - a.height);

    if (!hlsUrl && qualities.length === 0) return null;
    const bestMp4 = qualities[0];
    const proxiedHls = hlsUrl
      ? wrapTvProxyUrl(hlsUrl, 'https://vkvideo.ru/', DEFAULT_VOD_UA)
      : '';
    const proxiedBestMp4 = bestMp4?.url
      ? wrapTvProxyUrl(bestMp4.url, 'https://vkvideo.ru/', DEFAULT_VOD_UA)
      : '';
    return {
      bestUrl: proxiedHls || proxiedBestMp4,
      hlsUrl: proxiedHls || proxiedBestMp4,
      rawHlsUrl: hlsUrl || bestMp4?.url,
      maxHeight: qualities[0]?.height || 1080,
      qualities: qualities.map((q) => ({
        id: `${q.height}p`,
        height: q.height,
        label:
          q.height >= 2160
            ? '4K UHD (2160p)'
            : q.height >= 1440
              ? '2K QHD (1440p)'
              : q.height >= 1080
                ? 'Full HD (1080p)'
                : `${q.height}p`,
        url: wrapTvProxyUrl(q.url, 'https://vkvideo.ru/', DEFAULT_VOD_UA),
      })),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const VK_CURATED_SHOWS = [
  {
    kpIds: ['5318639'],
    titleRe: /шоу\s*«?кстати»?/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-220754053, 'playlist_3');
      const byEp = new Map();
      for (const item of raw) {
        const title = decodeVkHtmlEntities(item[3]);
        const m = title.match(/КСТАТИ\s*#(\d+)/i);
        if (!m) continue;
        const epNum = Number(m[1]);
        if (!epNum || byEp.has(epNum)) continue;
        byEp.set(epNum, {
          season: 1,
          episode: epNum,
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title,
          duration: parseDurationToSeconds(item[5]) || 4200,
        });
      }
      return [
        {
          season: 1,
          episodes: [...byEp.values()].sort((a, b) => a.episode - b.episode),
        },
      ];
    },
  },
  {
    kpIds: ['5508530'],
    titleRe: /^зв[её]зды\.\s*сезон/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-220754053, 'playlist_21');
      const s1 = [];
      const s2 = [];
      const s3 = [];
      for (const item of [...raw].reverse()) {
        const title = decodeVkHtmlEntities(item[3]);
        if (/тизер|анонс|трейлер/i.test(title)) continue;
        const entry = {
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title,
          duration: parseDurationToSeconds(item[5]) || 7200,
        };
        if (/^Зв[её]зды\s+3\b|^Зв[её]зды\.\s*Регионы/i.test(title)) {
          s3.push(entry);
        } else if (/^Зв[её]зды\s+2\b/i.test(title)) {
          s2.push(entry);
        } else if (/^Зв[её]зды\./i.test(title)) {
          s1.push(entry);
        }
      }
      return [
        {
          season: 1,
          episodes: s1.map((e, i) => ({ ...e, season: 1, episode: i + 1 })),
        },
        {
          season: 2,
          episodes: s2.map((e, i) => ({ ...e, season: 2, episode: i + 1 })),
        },
        {
          season: 3,
          episodes: s3.map((e, i) => ({ ...e, season: 3, episode: i + 1 })),
        },
      ].filter((s) => s.episodes.length > 0);
    },
  },
  {
    kpIds: ['5423568'],
    titleRe: /большое\s+шоу/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-110135406, 'all');
      const seasonsMap = new Map();
      for (const item of [...raw].reverse()) {
        const title = decodeVkHtmlEntities(item[3]);
        const dur = parseDurationToSeconds(item[5]);
        if (dur < 1200 || /\[анонс\]|тизер|трейлер/i.test(title)) continue;
        const m = title.match(/^Большое\s+шоу\s+(\d+)\s*сезон/i);
        if (!m) continue;
        const sNum = Number(m[1]) || 1;
        if (!seasonsMap.has(sNum)) seasonsMap.set(sNum, []);
        const list = seasonsMap.get(sNum);
        list.push({
          season: sNum,
          episode: list.length + 1,
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title,
          duration: dur,
        });
      }
      return [...seasonsMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([season, episodes]) => ({ season, episodes }));
    },
  },
  {
    kpIds: ['9001001'],
    titleRe: /натальная\s+карта/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-211232966, 'all');
      const byEp = new Map();
      for (const item of raw) {
        const title = decodeVkHtmlEntities(item[3]);
        const dur = parseDurationToSeconds(item[5]);
        if (dur < 1800) continue;
        const m = title.match(/Натальная\s+карта\s*#(\d+)/i);
        if (!m) continue;
        const epNum = Number(m[1]);
        if (!epNum || byEp.has(epNum)) continue;
        byEp.set(epNum, {
          season: 1,
          episode: epNum,
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title,
          duration: dur,
        });
      }
      return [
        {
          season: 1,
          episodes: [...byEp.values()].sort((a, b) => a.episode - b.episode),
        },
      ];
    },
  },
  {
    kpIds: ['9001012'],
    titleRe: /токсики/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-161938332, 'all');
      const byEp = new Map();
      const extraEps = [];
      for (const item of [...raw].reverse()) {
        const title = decodeVkHtmlEntities(item[3]);
        const dur = parseDurationToSeconds(item[5]);
        if (dur < 1200 || !/токсики/i.test(title) || /тизер|анонс|трейлер/i.test(title)) {
          continue;
        }
        const m = title.match(/ТОКСИКИ\s*#?(\d+)/i);
        const entry = {
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title,
          duration: dur,
        };
        if (m) {
          const epNum = Number(m[1]);
          if (epNum && !byEp.has(epNum)) {
            byEp.set(epNum, { ...entry, season: 1, episode: epNum });
          }
        } else {
          extraEps.push(entry);
        }
      }
      const sorted = [...byEp.values()].sort((a, b) => a.episode - b.episode);
      for (const ex of extraEps) {
        sorted.push({
          ...ex,
          season: 1,
          episode: (sorted[sorted.length - 1]?.episode || 0) + 1,
        });
      }
      return [{ season: 1, episodes: sorted }];
    },
  },
  {
    kpIds: ['9001013'],
    titleRe: /вопрос\s+ребром/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-1415705, 'all');
      const eps = [...raw]
        .reverse()
        .map((item) => ({
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title: decodeVkHtmlEntities(item[3]),
          duration: parseDurationToSeconds(item[5]),
        }))
        .filter(
          (x) =>
            x.duration >= 1200 &&
            /Вопрос\s+Ребром/i.test(x.title) &&
            !/тизер|анонс|трейлер/i.test(x.title)
        )
        .map((e, i) => ({ ...e, season: 1, episode: i + 1 }));
      return [{ season: 1, episodes: eps }];
    },
  },
  {
    kpIds: ['9001014', '1178436'],
    titleRe: /прожарка/i,
    buildSeasons: async () => {
      const [rtPage1, rtPage2] = await Promise.all([
        fetch(
          `https://rutube.ru/api/search/video/?query=${encodeURIComponent('Прожарка')}&page=1&format=json`,
          { headers: { 'User-Agent': DEFAULT_VOD_UA } }
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(
          `https://rutube.ru/api/search/video/?query=${encodeURIComponent('Прожарка выпуск')}&page=1&format=json`,
          { headers: { 'User-Agent': DEFAULT_VOD_UA } }
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      const eps = [];
      const seenRt = new Set();
      for (const v of [...(rtPage1?.results || []), ...(rtPage2?.results || [])]) {
        if (!v || !v.id || seenRt.has(v.id)) continue;
        if (Number(v.duration) < 1400 || v.is_paid) continue;
        const aid = v.author?.id;
        if (aid !== 1131656 && aid !== 41030503 && aid !== 5518074 && aid !== 23463954) {
          continue;
        }
        if (!/прожарка/i.test(v.title || '')) continue;
        seenRt.add(v.id);
        eps.push({
          rutubeVideoId: v.id,
          thumbnail: v.thumbnail_url || '',
          title: String(v.title || '').trim(),
          duration: Number(v.duration) || 2700,
        });
      }

      return [
        {
          season: 1,
          episodes: eps.map((e, i) => ({ ...e, season: 1, episode: i + 1 })),
        },
      ];
    },
  },
  {
    kpIds: ['9001002'],
    titleRe: /громкий\s+вопрос/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-203677279, 'playlist_4');
      const eps = [...raw]
        .reverse()
        .map((item) => ({
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title: decodeVkHtmlEntities(item[3]),
          duration: parseDurationToSeconds(item[5]),
        }))
        .filter(
          (x) =>
            x.duration >= 1200 &&
            /Громкий\s+вопрос/i.test(x.title) &&
            !/анонс|тизер|трейлер/i.test(x.title)
        )
        .map((e, i) => ({ ...e, season: 1, episode: i + 1 }));
      return [{ season: 1, episodes: eps }];
    },
  },
  {
    kpIds: ['9001003'],
    titleRe: /тейбл\s+тайм/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-203677279, 'playlist_9');
      const seasonsMap = new Map();
      for (const item of [...raw].reverse()) {
        const title = decodeVkHtmlEntities(item[3]);
        const dur = parseDurationToSeconds(item[5]);
        if (dur < 1200 || /трейлер|анонс|тизер/i.test(title)) continue;
        const sMatch = title.match(/(\d+)\s*сезон/i);
        const eMatch = title.match(/(\d+)\s*(?:серия|выпуск)/i);
        const sNum = sMatch ? Number(sMatch[1]) : 1;
        if (!seasonsMap.has(sNum)) seasonsMap.set(sNum, []);
        const list = seasonsMap.get(sNum);
        list.push({
          season: sNum,
          episode: eMatch ? Number(eMatch[1]) : list.length + 1,
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title,
          duration: dur,
        });
      }
      return [...seasonsMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([season, episodes]) => ({
          season,
          episodes: episodes.sort((a, b) => a.episode - b.episode),
        }));
    },
  },
  {
    kpIds: ['9001004'],
    titleRe: /шоу\s+истории/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-203677279, 'playlist_8');
      const eps = [...raw]
        .reverse()
        .map((item) => ({
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title: decodeVkHtmlEntities(item[3]),
          duration: parseDurationToSeconds(item[5]),
        }))
        .filter((x) => x.duration >= 1200 && !/трейлер|анонс|тизер/i.test(x.title))
        .map((e, i) => ({ ...e, season: 1, episode: i + 1 }));
      return [{ season: 1, episodes: eps }];
    },
  },
  {
    kpIds: ['9001005'],
    titleRe: /неигры/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-213802301, 'all');
      const eps = [...raw]
        .reverse()
        .map((item) => ({
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title: decodeVkHtmlEntities(item[3]),
          duration: parseDurationToSeconds(item[5]),
        }))
        .filter(
          (x) =>
            x.duration >= 1200 &&
            /Неигры/i.test(x.title) &&
            !/трейлер|анонс|тизер/i.test(x.title)
        )
        .map((e, i) => ({ ...e, season: 1, episode: i + 1 }));
      return [{ season: 1, episodes: eps }];
    },
  },
  {
    kpIds: ['9001006'],
    titleRe: /контакты/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-213802301, 'all');
      const eps = [...raw]
        .reverse()
        .map((item) => ({
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title: decodeVkHtmlEntities(item[3]),
          duration: parseDurationToSeconds(item[5]),
        }))
        .filter(
          (x) =>
            x.duration >= 1200 &&
            /Контакты/i.test(x.title) &&
            !/трейлер|анонс|тизер/i.test(x.title)
        )
        .map((e, i) => ({ ...e, season: 1, episode: i + 1 }));
      return [{ season: 1, episodes: eps }];
    },
  },
  {
    kpIds: ['5367740'],
    titleRe: /битва\s+шефов/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-90522635, 'all');
      const eps = [...raw]
        .reverse()
        .map((item) => ({
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title: decodeVkHtmlEntities(item[3]).replace(/^СМОТРИМ:?\s*/i, ''),
          duration: parseDurationToSeconds(item[5]),
        }))
        .filter((x) => x.duration >= 1800 && /Битва\s+шефов/i.test(x.title))
        .map((e, i) => ({ ...e, season: 1, episode: i + 1 }));
      return [{ season: 1, episodes: eps }];
    },
  },
  {
    kpIds: ['5189043'],
    titleRe: /адская\s+кухня/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-90522635, 'all');
      const seasonsMap = new Map();
      for (const item of [...raw].reverse()) {
        const title = decodeVkHtmlEntities(item[3]).replace(/^СМОТРИМ:?\s*/i, '');
        const dur = parseDurationToSeconds(item[5]);
        if (dur < 1800 || !/Адская\s+Кухня\s+с\s+Ивлевым/i.test(title)) continue;
        const sMatch = title.match(/(\d+)\s*сезон/i);
        const eMatch = title.match(/(\d+)\s*выпуск/i);
        const sNum = sMatch ? Number(sMatch[1]) : 1;
        if (!seasonsMap.has(sNum)) seasonsMap.set(sNum, []);
        const list = seasonsMap.get(sNum);
        list.push({
          season: sNum,
          episode: eMatch ? Number(eMatch[1]) : list.length + 1,
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title,
          duration: dur,
        });
      }
      return [...seasonsMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([season, episodes]) => ({
          season,
          episodes: episodes.sort((a, b) => a.episode - b.episode),
        }));
    },
  },
  {
    kpIds: ['5459661'],
    titleRe: /четыре\s+жены/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-90522635, 'all');
      const eps = [...raw]
        .reverse()
        .map((item) => ({
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title: decodeVkHtmlEntities(item[3]).replace(/^СМОТРИМ:?\s*/i, ''),
          duration: parseDurationToSeconds(item[5]),
        }))
        .filter((x) => x.duration >= 1800 && /Четыре\s+жены/i.test(x.title))
        .map((e, i) => ({ ...e, season: 1, episode: i + 1 }));
      return [{ season: 1, episodes: eps }];
    },
  },
  {
    kpIds: ['9001010'],
    titleRe: /четыре\s+свадьбы/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-90522635, 'all');
      const eps = [...raw]
        .reverse()
        .map((item) => ({
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title: decodeVkHtmlEntities(item[3]).replace(/^СМОТРИМ:?\s*/i, ''),
          duration: parseDurationToSeconds(item[5]),
        }))
        .filter((x) => x.duration >= 1800 && /Четыре\s+свадьбы/i.test(x.title))
        .map((e, i) => ({ ...e, season: 1, episode: i + 1 }));
      return [{ season: 1, episodes: eps }];
    },
  },
  {
    kpIds: ['9001011'],
    titleRe: /ч[её]рный\s+список/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-90522635, 'all');
      const eps = [...raw]
        .reverse()
        .map((item) => ({
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title: decodeVkHtmlEntities(item[3]).replace(/^СМОТРИМ:?\s*/i, ''),
          duration: parseDurationToSeconds(item[5]),
        }))
        .filter((x) => x.duration >= 1800 && /^Черный\s+список/i.test(x.title))
        .map((e, i) => ({ ...e, season: 1, episode: i + 1 }));
      return [{ season: 1, episodes: eps }];
    },
  },
  {
    kpIds: ['5320563'],
    titleRe: /^кондитер\b/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-16775977, 'all');
      const eps = [...raw]
        .reverse()
        .map((item) => ({
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title: decodeVkHtmlEntities(item[3]),
          duration: parseDurationToSeconds(item[5]),
        }))
        .filter((x) => x.duration >= 1800 && /Кондитер/i.test(x.title))
        .map((e, i) => ({ ...e, season: 1, episode: i + 1 }));
      return [{ season: 1, episodes: eps }];
    },
  },
  {
    kpIds: ['5326185'],
    titleRe: /пацанки/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-90522635, 'all');
      const eps = [...raw]
        .reverse()
        .map((item) => ({
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title: decodeVkHtmlEntities(item[3]).replace(/^СМОТРИМ:?\s*/i, ''),
          duration: parseDurationToSeconds(item[5]),
        }))
        .filter((x) => x.duration >= 1800 && /Пацанки/i.test(x.title))
        .map((e, i) => ({ ...e, season: 1, episode: i + 1 }));
      return [{ season: 1, episodes: eps }];
    },
  },
  {
    kpIds: ['911219'],
    titleRe: /ревизорро/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-90522635, 'all');
      const eps = [...raw]
        .reverse()
        .map((item) => ({
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title: decodeVkHtmlEntities(item[3]).replace(/^СМОТРИМ:?\s*/i, ''),
          duration: parseDurationToSeconds(item[5]),
        }))
        .filter((x) => x.duration >= 1800 && /Ревизорро/i.test(x.title))
        .map((e, i) => ({ ...e, season: 1, episode: i + 1 }));
      return [{ season: 1, episodes: eps }];
    },
  },
  {
    kpIds: ['5267860'],
    titleRe: /импровизаторы/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-127401043, 'all');
      const eps = [...raw]
        .reverse()
        .map((item) => ({
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title: decodeVkHtmlEntities(item[3]),
          duration: parseDurationToSeconds(item[5]),
        }))
        .filter((x) => x.duration >= 1800 && /Импровизаторы/i.test(x.title))
        .map((e, i) => ({ ...e, season: 1, episode: i + 1 }));
      return [{ season: 1, episodes: eps }];
    },
  },
  {
    kpIds: ['5255425'],
    titleRe: /суперниндзя/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-18496184, 'all');
      const eps = [...raw]
        .reverse()
        .map((item) => ({
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title: decodeVkHtmlEntities(item[3]),
          duration: parseDurationToSeconds(item[5]),
        }))
        .filter((x) => x.duration >= 1800 && /Суперниндзя/i.test(x.title))
        .map((e, i) => ({ ...e, season: 1, episode: i + 1 }));
      return [{ season: 1, episodes: eps }];
    },
  },
  {
    kpIds: ['5463968'],
    titleRe: /^прятки/i,
    buildSeasons: async () => {
      const [rawS1, rawS2] = await Promise.all([
        fetchVkRawSectionList(-240415030, 'all'),
        fetchVkRawSectionList(-18496184, 'all'),
      ]);
      const eps1 = [...rawS1]
        .reverse()
        .map((item) => ({
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title: decodeVkHtmlEntities(item[3]),
          duration: parseDurationToSeconds(item[5]),
        }))
        .filter((x) => x.duration >= 1800 && /Прятки/i.test(x.title))
        .map((e, i) => ({ ...e, season: 1, episode: i + 1 }));
      const eps2 = [...rawS2]
        .reverse()
        .map((item) => ({
          oid: item[0],
          vid: item[1],
          thumbnail: String(item[2] || '').replace(/\\\//g, '/'),
          title: decodeVkHtmlEntities(item[3]),
          duration: parseDurationToSeconds(item[5]),
        }))
        .filter((x) => x.duration >= 1800 && /Прятки/i.test(x.title))
        .map((e, i) => ({ ...e, season: 2, episode: i + 1 }));
      return [
        { season: 1, episodes: eps1 },
        { season: 2, episodes: eps2 },
      ].filter((s) => s.episodes.length > 0);
    },
  },
];

const rutubeSeasonCache = new Map();

async function fetchRutubeTvSeasonVideos(tvId, rutubeSeason) {
  const key = `${tvId}_${rutubeSeason}`;
  const cached = rutubeSeasonCache.get(key);
  if (cached && Date.now() - cached.ts < VK_CACHE_TTL_MS) {
    return cached.items;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(
      `https://rutube.ru/api/metainfo/tv/${tvId}/video/?season=${rutubeSeason}&type=2&format=json`,
      {
        headers: { 'User-Agent': DEFAULT_VOD_UA },
        signal: controller.signal,
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    const sorted = [...results].sort(
      (a, b) => (Number(a?.episode) || 1) - (Number(b?.episode) || 1)
    );
    if (sorted.length > 0) {
      rutubeSeasonCache.set(key, { ts: Date.now(), items: sorted });
    }
    return sorted;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRutubePlayHls(videoId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(
      `https://rutube.ru/api/play/options/${videoId}/?no_404=true&referer=https://rutube.ru`,
      {
        headers: { 'User-Agent': DEFAULT_VOD_UA },
        signal: controller.signal,
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rawM3u8 = data?.video_balancer?.m3u8 || null;
    return rawM3u8
      ? wrapTvProxyUrl(rawM3u8, 'https://rutube.ru/', DEFAULT_VOD_UA)
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const RUTUBE_CURATED_SHOWS = [
  {
    kpIds: ['4761950', '4640330'],
    titleRe: /зв[её]зды\s+в\s+африке/i,
    tvId: 42515,
    seasonsMap: [{ displaySeason: 5, rutubeSeason: 5 }],
    fallbackAllSeasons: [
      { season: 1, count: 15 },
      { season: 2, count: 14 },
      { season: 3, count: 15 },
      { season: 4, count: 15 },
      { season: 5, count: 15 },
    ],
  },
  {
    kpIds: ['14171220'],
    titleRe: /зв[её]зды\s+в\s+джунглях/i,
    tvId: 42515,
    seasonsMap: [
      { displaySeason: 1, rutubeSeason: 6 },
      { displaySeason: 2, rutubeSeason: 7 },
      { displaySeason: 3, rutubeSeason: 8 },
    ],
  },
  {
    kpIds: ['5463970'],
    titleRe: /сокровища\s+императора/i,
    tvId: 380158,
    seasonsMap: [
      { displaySeason: 1, rutubeSeason: 1 },
      { displaySeason: 2, rutubeSeason: 2 },
      { displaySeason: 3, rutubeSeason: 3 },
    ],
  },
  {
    kpIds: ['5617914'],
    titleRe: /выживалити/i,
    tvId: 377475,
    seasonsMap: [
      { displaySeason: 1, rutubeSeason: 1 },
      { displaySeason: 2, rutubeSeason: 2 },
      { displaySeason: 3, rutubeSeason: 3 },
      { displaySeason: 4, rutubeSeason: 1, tvId: 1252376 },
    ],
  },
  {
    kpIds: ['5582628'],
    titleRe: /^титаны/i,
    tvId: 405933,
    seasonsMap: [
      { displaySeason: 1, rutubeSeason: 1 },
      { displaySeason: 2, rutubeSeason: 2 },
      { displaySeason: 3, rutubeSeason: 3 },
      { displaySeason: 4, rutubeSeason: 4 },
    ],
  },
  {
    kpIds: ['5331422'],
    titleRe: /выжить\s+в\s+(дубае|самарканде)/i,
    tvId: 296791,
    seasonsMap: [
      { displaySeason: 1, rutubeSeason: 3 },
      { displaySeason: 2, rutubeSeason: 2 },
      { displaySeason: 3, rutubeSeason: 4 },
    ],
  },
  {
    kpIds: ['7429055'],
    titleRe: /мастер\s+игры/i,
    tvId: 998723,
    seasonsMap: [
      { displaySeason: 1, rutubeSeason: 1 },
      { displaySeason: 2, rutubeSeason: 2 },
    ],
  },
  {
    kpIds: ['5500883'],
    titleRe: /невеста\.\s*экстра\s+любовь/i,
    tvId: 386435,
    seasonsMap: [{ displaySeason: 1, rutubeSeason: 1 }],
  },
  {
    kpIds: ['471505'],
    titleRe: /comedy\s+club|камеди\s+клаб/i,
    tvId: 10,
    seasonsMap: [
      { displaySeason: 1, rutubeSeason: 15 },
      { displaySeason: 2, rutubeSeason: 16 },
      { displaySeason: 3, rutubeSeason: 18 },
      { displaySeason: 4, rutubeSeason: 19 },
    ],
  },
  {
    kpIds: ['802911'],
    titleRe: /^stand\s*up/i,
    tvId: 624461,
    seasonsMap: [
      { displaySeason: 1, rutubeSeason: 8 },
      { displaySeason: 2, rutubeSeason: 9 },
      { displaySeason: 3, rutubeSeason: 10 },
      { displaySeason: 4, rutubeSeason: 11 },
      { displaySeason: 5, rutubeSeason: 12 },
    ],
  },
  {
    kpIds: ['842497'],
    titleRe: /однажды\s+в\s+россии/i,
    tvId: 2311,
    seasonsMap: [
      { displaySeason: 1, rutubeSeason: 4 },
      { displaySeason: 2, rutubeSeason: 5 },
      { displaySeason: 3, rutubeSeason: 6 },
    ],
  },
  {
    kpIds: ['5509905'],
    titleRe: /экстрасенсы\.\s*битва\s+сильнейших/i,
    tvId: 7292,
    seasonsMap: [
      { displaySeason: 1, rutubeSeason: 1 },
      { displaySeason: 2, rutubeSeason: 2 },
    ],
  },
  {
    kpIds: ['467943'],
    titleRe: /битва\s+экстрасенсов/i,
    tvId: 36,
    seasonsMap: [
      { displaySeason: 1, rutubeSeason: 24 },
      { displaySeason: 2, rutubeSeason: 26 },
      { displaySeason: 3, rutubeSeason: 1, tvId: 356362 },
      { displaySeason: 4, rutubeSeason: 2, tvId: 356362 },
    ],
  },
  {
    kpIds: ['1047767'],
    titleRe: /^импровизация\b/i,
    tvId: 3637,
    seasonsMap: [
      { displaySeason: 1, rutubeSeason: 3 },
      { displaySeason: 2, rutubeSeason: 4 },
      { displaySeason: 3, rutubeSeason: 5 },
    ],
  },
  {
    kpIds: ['5354824'],
    titleRe: /шоу\s+воли/i,
    tvId: 280536,
    seasonsMap: [{ displaySeason: 1, rutubeSeason: 1 }],
  },
  {
    kpIds: ['5189047'],
    titleRe: /адский\s+шеф/i,
    tvId: 624453,
    seasonsMap: [
      { displaySeason: 1, rutubeSeason: 1 },
      { displaySeason: 2, rutubeSeason: 2 },
      { displaySeason: 3, rutubeSeason: 3 },
    ],
  },
  {
    kpIds: ['5320550'],
    titleRe: /на\s+ножах/i,
    tvId: 4129,
    seasonsMap: [
      { displaySeason: 1, rutubeSeason: 1 },
      { displaySeason: 2, rutubeSeason: 2 },
      { displaySeason: 3, rutubeSeason: 3 },
      { displaySeason: 4, rutubeSeason: 6 },
      { displaySeason: 5, rutubeSeason: 7 },
      { displaySeason: 6, rutubeSeason: 8 },
    ],
  },
  {
    kpIds: ['5618003'],
    titleRe: /большие\s+девочки/i,
    tvId: 624450,
    seasonsMap: [
      { displaySeason: 1, rutubeSeason: 1 },
      { displaySeason: 2, rutubeSeason: 2 },
      { displaySeason: 3, rutubeSeason: 3 },
    ],
  },
  {
    kpIds: ['9001007'],
    titleRe: /что\s+было\s+дальше|чбд/i,
    searchQuery: 'Что было дальше',
    strictTitleRe: /^(?!Что\s+было\s+дальше\?,\s*1\s*сезон)(?!.*(?:300\s*кг|Lixiang|Nissan|Место\s+встречи|мотопутешествие|ТаХо)).*Что\s+было\s+дальше/i,
  },
  {
    kpIds: ['4374613'],
    titleRe: /музыкальная\s+интуиция/i,
    searchQuery: 'Шоу Музыкальная интуиция выпуск',
    strictTitleRe: /Музыкальная\s+интуиция/i,
  },
  {
    kpIds: ['573840'],
    titleRe: /уральских\s+пельменей|уральские\s+пельмени/i,
    searchQuery: 'Уральские пельмени выпуск',
    strictTitleRe: /Уральские\s+пельмени/i,
  },
  {
    kpIds: ['1344492'],
    titleRe: /женский\s+стендап/i,
    searchQuery: 'ЖЕНСКИЙ СТЕНДАП сезон выпуск',
    strictTitleRe: /ЖЕНСКИЙ\s+СТЕНДАП/i,
    parseSeasonEp: true,
  },
  {
    kpIds: ['5190505'],
    titleRe: /^концерты/i,
    searchQuery: 'КОНЦЕРТЫ сезон выпуск',
    strictTitleRe: /^Концерты,\s*\d+\s*сезон/i,
    parseSeasonEp: true,
  },
];

async function resolveRutubeCuratedShow(showCfg, season = 1, episode = 1, effectiveUa = DEFAULT_VOD_UA) {
  const seasonsOut = [];
  if (showCfg.searchQuery) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const r = await fetch(
        `https://rutube.ru/api/search/video/?query=${encodeURIComponent(showCfg.searchQuery)}&format=json`,
        { headers: { 'User-Agent': effectiveUa }, signal: controller.signal }
      );
      if (r.ok) {
        const j = await r.json();
        const vids = (j.results || []).filter(
          (v) =>
            v.duration > 1800 &&
            !v.is_paid &&
            v.author?.id !== 23453810 &&
            showCfg.strictTitleRe.test(`${v.title || ''} ${v.author?.name || ''}`) &&
            !/обзор|реакция|разбор|тизер|трейлер|американски|плохие\s+девчонки/i.test(v.title)
        );
        if (vids.length > 0) {
          if (showCfg.parseSeasonEp) {
            const bySeason = new Map();
            for (const v of vids) {
              const m = String(v.title || '').match(/(\d+)\s*сезон[,\s]+(\d+)\s*(?:выпуск|серия)/i);
              const sNum = m ? Number(m[1]) || 1 : 1;
              const epNum = m ? Number(m[2]) || 1 : 1;
              if (!bySeason.has(sNum)) bySeason.set(sNum, new Map());
              const epMap = bySeason.get(sNum);
              if (!epMap.has(epNum)) {
                epMap.set(epNum, {
                  episode: epNum,
                  videoId: v.id,
                  title: v.title,
                  thumbnail: v.thumbnail_url,
                  duration: Number(v.duration) || 3000,
                  audioNames: ['Русский (Оригинал • 1080p)'],
                });
              }
            }
            for (const [sNum, epMap] of [...bySeason.entries()].sort((a, b) => a[0] - b[0])) {
              seasonsOut.push({
                season: sNum,
                episodes: [...epMap.values()].sort((a, b) => a.episode - b.episode),
              });
            }
          } else {
            seasonsOut.push({
              season: 1,
              episodes: vids.map((v, idx) => ({
                episode: idx + 1,
                videoId: v.id,
                title: v.title,
                thumbnail: v.thumbnail_url,
                duration: Number(v.duration) || 4800,
                audioNames: ['Русский (Оригинал • 1080p)'],
              })),
            });
          }
        }
      }
    } catch {
      // ignore
    } finally {
      clearTimeout(timer);
    }
  } else if (Array.isArray(showCfg.seasonsMap)) {
    const fetched = await Promise.all(
      showCfg.seasonsMap.map(async (sm) => {
        const rawVids = await fetchRutubeTvSeasonVideos(
          sm.tvId || showCfg.tvId,
          sm.rutubeSeason
        );
        return {
          season: sm.displaySeason,
          episodes: rawVids.map((v, idx) => ({
            episode: idx + 1,
            videoId: v.id,
            title: v.title || `Выпуск ${idx + 1}`,
            thumbnail: v.thumbnail_url,
            duration: Number(v.duration) || 5400,
            audioNames: ['Русский (Оригинал • 1080p)'],
          })),
        };
      })
    );
    for (const f of fetched) {
      if (f.episodes.length > 0) seasonsOut.push(f);
    }
  }

  if (Array.isArray(showCfg.fallbackAllSeasons)) {
    for (const fb of showCfg.fallbackAllSeasons) {
      const existing = seasonsOut.find((s) => s.season === fb.season);
      if (!existing) {
        const defaultVidId = seasonsOut[0]?.episodes?.[0]?.videoId || '';
        seasonsOut.push({
          season: fb.season,
          episodes: Array.from({ length: fb.count }, (_, idx) => ({
            episode: idx + 1,
            videoId: defaultVidId,
            title: `Сезон ${fb.season} • Выпуск ${idx + 1}`,
            duration: 5400,
            audioNames: ['Русский (Оригинал • 1080p)'],
          })),
        });
      } else if (existing.episodes.length < fb.count) {
        const existingEpNums = new Set(existing.episodes.map((e) => e.episode));
        const fallbackVid = existing.episodes[0]?.videoId || '';
        for (let ep = 1; ep <= fb.count; ep++) {
          if (!existingEpNums.has(ep)) {
            existing.episodes.push({
              episode: ep,
              videoId: fallbackVid,
              title: `Сезон ${fb.season} • Выпуск ${ep}`,
              duration: 5400,
              audioNames: ['Русский (Оригинал • 1080p)'],
            });
          }
        }
        existing.episodes.sort((a, b) => a.episode - b.episode);
      }
    }
    seasonsOut.sort((a, b) => a.season - b.season);
  }

  if (seasonsOut.length === 0) return null;

  const targetSeason =
    seasonsOut.find((s) => Number(s.season) === Number(season)) || seasonsOut[0];
  const targetEp =
    targetSeason.episodes.find((e) => Number(e.episode) === Number(episode)) ||
    targetSeason.episodes[0];

  if (!targetEp?.videoId) return null;
  const hlsUrl = await fetchRutubePlayHls(targetEp.videoId);
  if (!hlsUrl) return null;

  return {
    ok: true,
    type: 'series',
    sourcePath: 'RUTUBE Official (1080p Full HD)',
    season: targetSeason.season,
    episode: targetEp.episode,
    title: targetEp.title,
    duration: targetEp.duration,
    audioNames: targetEp.audioNames,
    hlsUrl,
    userAgent: effectiveUa,
    seasons: seasonsOut.map((s) => ({
      season: s.season,
      episodes: s.episodes.map((e) => ({
        episode: e.episode,
        title: e.title,
        thumbnail: e.thumbnail,
        duration: e.duration,
        audioNames: e.audioNames,
      })),
    })),
  };
}

async function fetchKinogramEmbed(path, userAgent = '') {
  const host = 'https://api.kinogram.best';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7500);
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

    const normText = (s) =>
      String(s || '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/^(шоу|программа|телешоу)\s+/i, '')
        .replace(/[«»"'(),.!?:;-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const q = normText(cleanTitle);

    const targetYr = Number(cleanYear);
    const hasValidTargetYr =
      Number.isFinite(targetYr) && targetYr >= 1930 && targetYr <= 2026;

    const scored = films
      .filter((f) => {
        if (!f || !f.filmId) return false;
        const nameEn = normText(f.nameEn);
        const nameRu = normText(f.nameRu);
        if (!((nameEn && nameEn === q) || (nameRu && nameRu === q))) return false;
        const isSeriesType =
          f.type === 'TV_SERIES' ||
          f.type === 'MINI_SERIES' ||
          f.type === 'TV_SHOW';
        if (mediaType && isSeriesType !== wantSeries) return false;
        if (hasValidTargetYr) {
          const fYr = Number(String(f.year || '').slice(0, 4));
          if (!Number.isFinite(fYr) || Math.abs(fYr - targetYr) > 1) return false;
        }
        return true;
      })
      .map((f) => {
        let score = 15;
        const isSeriesType =
          f.type === 'TV_SERIES' ||
          f.type === 'MINI_SERIES' ||
          f.type === 'TV_SHOW';
        if (mediaType && isSeriesType === wantSeries) score += 10;
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

const IEDEM_VIP_API_URL = 'http://895890bd73a7.jmeekos.com/api/v1/';
const IEDEM_VIP_API_KEY = 'b55f67862ee6fe7-798a6b713ccb40d';
const TMDB_FIND_API_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
const KP_UNOFFICIAL_API_KEY = '8c8e1a50-6322-4135-8875-5d40a5420d86';

function normCompareTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/э/g, 'е')
    .replace(/й/g, 'и')
    .replace(/\b(uhd|4k|fhd|hd|1080p|2160p)\b/gi, ' ')
    .replace(/\(\s*\d{4}[^)]*\)/g, ' ')
    .replace(/сезон\s*\d+/gi, ' ')
    .replace(/часть\s+вторая/gi, '2')
    .replace(/часть\s+первая/gi, '1')
    .replace(/часть\s+третья/gi, '3')
    .replace(/\bii\b/g, '2')
    .replace(/\biii\b/g, '3')
    .replace(/[^a-z0-9а-я]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function resolveTitleCandidatesAndYear({
  imdb,
  kp,
  title,
  mediaType,
  year,
}) {
  const candidates = [];
  const addCandidate = (raw) => {
    const clean = String(raw || '')
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/•.*$/g, ' ')
      .replace(/\bS\d{1,2}[.\s_-]*E\d{1,2}\b/gi, ' ')
      .replace(/[.\s-]*Сезон\s*\d+\.?/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (clean && clean.length >= 2 && !candidates.includes(clean)) {
      candidates.push(clean);
      const shortPrefix = clean.split(/[:.]/)[0]?.trim();
      if (
        shortPrefix &&
        shortPrefix.length >= 3 &&
        shortPrefix !== clean &&
        !candidates.includes(shortPrefix)
      ) {
        candidates.push(shortPrefix);
      }
    }
  };

  let targetYear = Number(String(year || '').slice(0, 4)) || 0;
  const wantSeries = mediaType === 'series';

  if (title && /[а-яё]/i.test(title)) {
    addCandidate(title);
  }

  const cleanImdb = String(imdb || '').trim();
  if (cleanImdb && /^tt\d+$/i.test(cleanImdb)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const r = await fetch(
        `https://api.themoviedb.org/3/find/${cleanImdb}?api_key=${TMDB_FIND_API_KEY}&external_source=imdb_id&language=ru-RU`,
        { signal: controller.signal }
      );
      if (r.ok) {
        const j = await r.json();
        const m = j.movie_results?.[0];
        const t = j.tv_results?.[0];
        const hit = wantSeries ? t || m : m || t;
        if (hit) {
          const ruName = (hit.title || hit.name || '').trim();
          const origName = (
            hit.original_title ||
            hit.original_name ||
            ''
          ).trim();
          const dt = hit.release_date || hit.first_air_date || '';
          if (!targetYear && dt) {
            targetYear = Number(dt.slice(0, 4)) || 0;
          }
          if (ruName) addCandidate(ruName);
          if (origName) addCandidate(origName);
        }
      }
    } catch {
      // ignore
    } finally {
      clearTimeout(timer);
    }
  }

  const cleanKp = String(kp || '').trim();
  if (cleanKp && /^\d+$/.test(cleanKp) && !candidates.some((c) => /[а-яё]/i.test(c))) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const r = await fetch(
        `https://kinopoiskapiunofficial.tech/api/v2.2/films/${cleanKp}`,
        {
          headers: {
            'X-API-KEY': KP_UNOFFICIAL_API_KEY,
            Accept: 'application/json',
          },
          signal: controller.signal,
        }
      );
      if (r.ok) {
        const j = await r.json();
        if (j?.nameRu) addCandidate(j.nameRu);
        if (j?.nameOriginal) addCandidate(j.nameOriginal);
        if (!targetYear && j?.year) targetYear = Number(j.year) || 0;
      }
    } catch {
      // ignore
    } finally {
      clearTimeout(timer);
    }
  }

  if (title) {
    addCandidate(title);
  }

  return { candidates, targetYear, wantSeries };
}

async function callIedemVipApi(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(IEDEM_VIP_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'OTT-Play/1.0',
      },
      body: JSON.stringify({ key: IEDEM_VIP_API_KEY, ...payload }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function verifyIedemHlsNotTrailer(masterM3u8Url) {
  if (!masterM3u8Url) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const subUrl = String(masterM3u8Url).replace(
      /master\.m3u8$/i,
      'index-f1-v1-a1.m3u8'
    );
    const r = await fetch(subUrl, {
      headers: { 'User-Agent': 'OTT-Play/1.0' },
      signal: controller.signal,
    });
    if (!r.ok) return true;
    const txt = await r.text();
    const tsCount = (txt.match(/\.ts/gi) || []).length;
    return tsCount === 0 || tsCount >= 20;
  } catch {
    return true;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveFromIedemVip({
  candidates,
  targetYear,
  wantSeries,
  season = 1,
  episode = 1,
  effectiveUa = DEFAULT_VOD_UA,
}) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const normCands = candidates.map(normCompareTitle).filter(Boolean);

  const matchesTitle = (rawItemTitle) => {
    const base = String(rawItemTitle || '')
      .replace(/[.\s-]*Сезон\s*\d+.*$/i, '')
      .replace(/\s*\(Сезон\s*\d+[^)]*\)/i, '')
      .trim();
    const n = normCompareTitle(base);
    if (!n) return false;
    return normCands.some(
      (c) =>
        n === c ||
        (c.length >= 4 && (n.startsWith(`${c} `) || c.startsWith(`${n} `)))
    );
  };

  let allHits = [];
  for (const q of candidates) {
    const data = await callIedemVipApi({ cmd: 'search', query: q });
    const items = Array.isArray(data?.items) ? data.items : [];
    const matched = items.filter((it) => {
      if (wantSeries ? it.type !== 'multistream' : it.type !== 'stream') {
        return false;
      }
      return matchesTitle(it.title) || (items.length <= 3 && /[a-z]/i.test(q));
    });
    if (matched.length > 0) {
      allHits = matched;
      break;
    }
  }

  if (allHits.length === 0) return null;

  if (!wantSeries) {
    const validMovies = allHits
      .filter((it) => it.url && (Number(it.duration) || 90) >= 35)
      .filter((it) => {
        if (targetYear >= 1930 && it.year) {
          return Math.abs(Number(it.year) - targetYear) <= 1;
        }
        return true;
      })
      .sort((a, b) => {
        const scoreA = (a['4k'] ? 100 : 0) + (a.fhd ? 50 : 0);
        const scoreB = (b['4k'] ? 100 : 0) + (b.fhd ? 50 : 0);
        return scoreB - scoreA;
      });

    const best = validMovies[0] || allHits.find((it) => it.url);
    if (!best?.url) return null;
    const is4k = Boolean(best['4k']);
    const proxiedUrl = wrapTvProxyUrl(
      best.url,
      'http://895890bd73a7.jmeekos.com/',
      'OTT-Play/1.0'
    );
    return {
      ok: true,
      type: 'movie',
      sourcePath: `iEdem VIP (${is4k ? '4K UHD' : '1080p Full HD'})`,
      title: best.title,
      duration: (Number(best.duration) || 105) * 60,
      audioNames: [
        is4k ? 'Русский / Original (4K UHD)' : 'Русский / Original (1080p)',
      ],
      hlsUrl: proxiedUrl,
      proxyHlsUrl: proxiedUrl,
      rawHlsUrl: best.url,
      userAgent: effectiveUa,
    };
  }

  // Series (multistream): group by season number and prefer 4K UHD
  const bySeason = new Map();
  for (const it of allHits) {
    const sm = String(it.title || '').match(/Сезон\s*(\d+)/i);
    const sNum = sm ? Number(sm[1]) || 1 : 1;
    const prev = bySeason.get(sNum);
    if (!prev || (!prev['4k'] && it['4k'])) {
      bySeason.set(sNum, it);
    }
  }

  const seasonEntries = [...bySeason.entries()].sort((a, b) => a[0] - b[0]);
  if (seasonEntries.length === 0) return null;

  const fetchedSeasons = await Promise.all(
    seasonEntries.map(async ([sNum, msItem]) => {
      const detail = await callIedemVipApi({ cmd: 'flick', fid: msItem.fid });
      const rawEps = Array.isArray(detail?.items) ? detail.items : [];
      const is4k = Boolean(msItem['4k']);
      const episodes = rawEps
        .filter((e) => e && e.url)
        .map((e, idx) => {
          const em = String(e.title || '').match(/(\d+)/);
          const epNum = em ? Number(em[1]) || idx + 1 : idx + 1;
          return {
            episode: epNum,
            title: e.title || `Серия ${epNum}`,
            url: e.url,
            is4k: Boolean(e['4k'] || is4k),
            duration: 3000,
            audioNames: [
              is4k
                ? 'Русский / Original (4K UHD)'
                : 'Русский / Original (1080p)',
            ],
          };
        })
        .sort((a, b) => a.episode - b.episode);
      return { season: sNum, is4k, episodes };
    })
  );

  const validSeasons = fetchedSeasons.filter((s) => s.episodes.length > 0);
  if (validSeasons.length === 0) return null;

  const exactSeason = validSeasons.find(
    (s) => Number(s.season) === Number(season)
  );
  const targetSeasonObj = exactSeason || validSeasons[0];
  const targetEpObj =
    targetSeasonObj.episodes.find(
      (e) => Number(e.episode) === Number(episode)
    ) || targetSeasonObj.episodes[0];

  if (!targetEpObj?.url) return null;

  // Verify the episode is a full episode (not a 12-second season teaser placeholder)
  const isFullEp = await verifyIedemHlsNotTrailer(targetEpObj.url);
  if (!isFullEp) {
    return null;
  }

  const proxiedUrl = wrapTvProxyUrl(
    targetEpObj.url,
    'http://895890bd73a7.jmeekos.com/',
    'OTT-Play/1.0'
  );

  return {
    ok: true,
    type: 'series',
    sourcePath: `iEdem VIP (${targetEpObj.is4k ? '4K UHD' : '1080p Full HD'})`,
    season: targetSeasonObj.season,
    episode: targetEpObj.episode,
    title: targetEpObj.title,
    duration: targetEpObj.duration,
    audioNames: targetEpObj.audioNames,
    hlsUrl: proxiedUrl,
    proxyHlsUrl: proxiedUrl,
    rawHlsUrl: targetEpObj.url,
    userAgent: effectiveUa,
    seasons: validSeasons.map((s) => ({
      season: s.season,
      episodes: s.episodes.map((e) => ({
        episode: e.episode,
        title: e.title,
        duration: e.duration,
        audioNames: e.audioNames,
      })),
    })),
  };
}

async function searchVkVideosByQuery(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const res = await fetch('https://vkvideo.ru/al_video.php?act=search_video', {
      method: 'POST',
      headers: {
        'User-Agent': DEFAULT_VOD_UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        Origin: 'https://vkvideo.ru',
        Referer: 'https://vkvideo.ru/',
      },
      body: `al=1&q=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const text = new TextDecoder('windows-1251').decode(await res.arrayBuffer());
    const data = JSON.parse(text);
    const list = data?.payload?.[1]?.[2]?.list || [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function resolveFromVkVideoSearch({
  candidates,
  targetYear,
  wantSeries,
  season = 1,
  episode = 1,
  effectiveUa = DEFAULT_VOD_UA,
}) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const primaryTitle =
    candidates.find((c) => /[а-яё]/i.test(c)) || candidates[0];
  const normCands = candidates.map(normCompareTitle).filter(Boolean);

  const isTrailerOrJunk = (t) =>
    /\b(трейлер|тизер|обзор|реакция|разбор|стрим|нарезка|отрывок|клип|trailer|teaser)\b/i.test(
      t
    );

  if (wantSeries) {
    const queries = [
      `${primaryTitle} ${season} сезон ${episode} серия`,
      `${primaryTitle} ${season} сезон ${episode} выпуск`,
      `${primaryTitle} ${season} сезон`,
    ];
    for (const q of queries) {
      const rawList = await searchVkVideosByQuery(q);
      const parsed = rawList
        .map((it) => ({
          oid: it[0],
          vid: it[1],
          thumbnail: String(it[2] || '').replace(/\\\//g, '/'),
          title: decodeVkHtmlEntities(it[3]),
          duration: parseDurationToSeconds(it[5]),
        }))
        .filter((x) => {
          if (x.duration < 1200 || isTrailerOrJunk(x.title)) return false;
          const nt = normCompareTitle(x.title);
          return normCands.some((c) => nt.includes(c));
        });

      if (parsed.length === 0) continue;

      const exactEpRe = new RegExp(
        `(?:^|[^\\d])${episode}\\s*(?:серия|выпуск|ep|серии)(?:[^\\d]|$)`,
        'i'
      );
      const bestEp =
        parsed.find((x) => exactEpRe.test(x.title) && /4k|uhd|2160/i.test(x.title)) ||
        parsed.find((x) => exactEpRe.test(x.title)) ||
        parsed.find((x) => /4k|uhd|2160/i.test(x.title)) ||
        parsed[0];

      const vkStream = await extractVkVideoStreams(bestEp.oid, bestEp.vid);
      if (vkStream && vkStream.bestUrl) {
        return {
          ok: true,
          type: 'series',
          sourcePath: `VK Видео Direct (${vkStream.maxHeight >= 2160 ? '4K UHD' : '1080p Full HD'})`,
          season: Number(season) || 1,
          episode: Number(episode) || 1,
          title: bestEp.title,
          duration: bestEp.duration,
          audioNames: ['Русский (VK Видео Direct)'],
          hlsUrl: vkStream.bestUrl,
          proxyHlsUrl: vkStream.bestUrl,
          rawHlsUrl: vkStream.rawHlsUrl || vkStream.hlsUrl,
          vkQualities: vkStream.qualities,
          userAgent: effectiveUa,
        };
      }
    }
    return null;
  }

  // Movie search on VK Video
  const movieQueries = targetYear
    ? [`${primaryTitle} ${targetYear}`, `${primaryTitle} фильм`]
    : [`${primaryTitle} фильм`, primaryTitle];

  for (const q of movieQueries) {
    const rawList = await searchVkVideosByQuery(q);
    const parsed = rawList
      .map((it) => ({
        oid: it[0],
        vid: it[1],
        thumbnail: String(it[2] || '').replace(/\\\//g, '/'),
        title: decodeVkHtmlEntities(it[3]),
        duration: parseDurationToSeconds(it[5]),
      }))
      .filter((x) => {
        if (x.duration < 3600 || isTrailerOrJunk(x.title)) return false;
        const nt = normCompareTitle(x.title);
        return normCands.some((c) => nt.includes(c));
      });

    if (parsed.length === 0) continue;
    const bestMovie =
      parsed.find((x) => /4k|uhd|2160/i.test(x.title)) || parsed[0];
    const vkStream = await extractVkVideoStreams(bestMovie.oid, bestMovie.vid);
    if (vkStream && vkStream.bestUrl) {
      return {
        ok: true,
        type: 'movie',
        sourcePath: `VK Видео Direct (${vkStream.maxHeight >= 2160 ? '4K UHD' : '1080p Full HD'})`,
        title: bestMovie.title,
        duration: bestMovie.duration,
        audioNames: ['Русский (VK Видео Direct)'],
        hlsUrl: vkStream.bestUrl,
        proxyHlsUrl: vkStream.bestUrl,
        rawHlsUrl: vkStream.rawHlsUrl || vkStream.hlsUrl,
        vkQualities: vkStream.qualities,
        userAgent: effectiveUa,
      };
    }
  }
  return null;
}

async function resolveFromAllohaEmbed({ imdb, kp, season = 1, episode = 1 }) {
  const cleanImdb = String(imdb || '').trim();
  const cleanKp = String(kp || '').trim();
  if (!cleanImdb && !cleanKp) return null;
  const qs = cleanImdb
    ? `imdb=${encodeURIComponent(cleanImdb)}`
    : `kp=${encodeURIComponent(cleanKp)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const res = await fetch(
      `https://api.alloha.tv/?token=04941a9a3ca3ac16e2b4327347bbc1&${qs}`,
      { signal: controller.signal }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const iframe = json?.data?.iframe;
    if (!iframe) return null;
    const sep = iframe.includes('?') ? '&' : '?';
    const embedUrl = json?.data?.seasons
      ? `${iframe}${sep}season=${season}&episode=${episode}`
      : iframe;
    return embedUrl;
  } catch {
    return null;
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
  const cleanKp = String(kp || '').trim();
  const cleanTitle = String(title || '').trim();

  // 1. Check Official VK Video Curated Playlists & Verified Communities first
  const matchedVkShow = VK_CURATED_SHOWS.find(
    (s) =>
      (cleanKp && s.kpIds.includes(cleanKp)) ||
      (cleanTitle && s.titleRe.test(cleanTitle))
  );
  if (matchedVkShow) {
    const vkSeasons = await matchedVkShow.buildSeasons();
    if (Array.isArray(vkSeasons) && vkSeasons.length > 0) {
      const targetSeason =
        vkSeasons.find((s) => Number(s.season) === Number(season)) ||
        vkSeasons[0];
      const targetEp =
        targetSeason.episodes.find(
          (e) => Number(e.episode) === Number(episode)
        ) || targetSeason.episodes[0];
      if (targetEp) {
        if (targetEp.rutubeVideoId) {
          const hlsUrl = await fetchRutubePlayHls(targetEp.rutubeVideoId);
          if (hlsUrl) {
            return {
              ok: true,
              type: 'series',
              sourcePath: 'ТНТ4 • VK / RUTUBE Official (1080p Full HD)',
              season: targetSeason.season,
              episode: targetEp.episode,
              title: targetEp.title,
              duration: targetEp.duration,
              audioNames: ['Русский (Оригинал • 1080p)'],
              hlsUrl,
              userAgent: effectiveUa,
              seasons: vkSeasons.map((s) => ({
                season: s.season,
                episodes: s.episodes.map((ep) => ({
                  episode: ep.episode,
                  title: ep.title,
                  thumbnail: ep.thumbnail,
                  duration: ep.duration,
                  audioNames: ['Русский (Оригинал • 1080p)'],
                })),
              })),
            };
          }
        }
        const vkStream = await extractVkVideoStreams(targetEp.oid, targetEp.vid);
        if (vkStream && vkStream.bestUrl) {
          return {
            ok: true,
            type: 'series',
            sourcePath: `VK Видео Direct (${vkStream.maxHeight >= 2160 ? '4K UHD' : '1080p Full HD'})`,
            season: targetSeason.season,
            episode: targetEp.episode,
            title: targetEp.title,
            duration: targetEp.duration,
            audioNames: ['Русский (VK Видео Direct)'],
            hlsUrl: vkStream.bestUrl,
            rawHlsUrl: vkStream.hlsUrl || vkStream.bestUrl,
            vkQualities: vkStream.qualities,
            userAgent: effectiveUa,
            seasons: vkSeasons.map((s) => ({
              season: s.season,
              episodes: s.episodes.map((ep) => ({
                episode: ep.episode,
                title: ep.title,
                thumbnail: ep.thumbnail,
                duration: ep.duration,
                audioNames: ['Русский (VK Видео Direct)'],
              })),
            })),
          };
        }
      }
    }
  }

  // 2. Check Official RUTUBE Gazprom-Media TV Catalog (ТНТ, Пятница!, PREMIER, СТС)
  const matchedRutubeShow = RUTUBE_CURATED_SHOWS.find(
    (s) =>
      (cleanKp && s.kpIds.includes(cleanKp)) ||
      (cleanTitle && s.titleRe.test(cleanTitle))
  );
  if (matchedRutubeShow) {
    const rutubeRes = await resolveRutubeCuratedShow(
      matchedRutubeShow,
      season,
      episode,
      effectiveUa
    );
    if (rutubeRes && rutubeRes.ok) {
      return rutubeRes;
    }
  }

  // 3. Check iEdem VIP MediaLibrary (4K UHD / 1080p Direct HLS) & VK Video Direct Search (4K UHD / 1080p)
  const titleInfo = await resolveTitleCandidatesAndYear({
    imdb,
    kp: cleanKp,
    title: cleanTitle,
    mediaType,
    year,
  });

  const iedemRes = await resolveFromIedemVip({
    ...titleInfo,
    season,
    episode,
    effectiveUa,
  });
  if (iedemRes && iedemRes.ok) {
    return iedemRes;
  }

  if (cleanKp || /[а-яА-ЯёЁ]/.test(cleanTitle) || titleInfo.ruTitle) {
    const vkSearchRes = await resolveFromVkVideoSearch({
      ...titleInfo,
      season,
      episode,
      effectiveUa,
    });
    if (vkSearchRes && vkSearchRes.ok) {
      return vkSearchRes;
    }
  }

  // 4. Check Kinogram / Collaps Balancer
  const candidates = [];
  if (cleanKp && /^\d+$/.test(cleanKp)) {
    candidates.push(`kp/${cleanKp}`);
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

  if (!html && cleanTitle) {
    const fallbackKpIds = await lookupKpIdsByTitle(cleanTitle, mediaType, year);
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
    const embedUrl = await resolveFromAllohaEmbed({
      imdb,
      kp: cleanKp,
      season,
      episode,
    });
    if (embedUrl) {
      return {
        ok: false,
        embedUrl,
        sourcePath: 'Alloha VIP (1080p)',
        error: 'Using clean Alloha VIP embed fallback',
      };
    }
    return { ok: false, error: 'Stream not found on VOD balancer' };
  }

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
    const rawSeasons = extractBalancedJsonArray(html, seasonsIdx);
    if (Array.isArray(rawSeasons) && rawSeasons.length > 0) {
      const sortedRawSeasons = [...rawSeasons].sort(
        (a, b) => (Number(a?.season) || 1) - (Number(b?.season) || 1)
      );
      const cleanSeasons = sortedRawSeasons.map((s) => ({
        season: Number(s.season) || 1,
        episodes: (Array.isArray(s.episodes) ? [...s.episodes] : [])
          .sort((a, b) => (Number(a?.episode) || 1) - (Number(b?.episode) || 1))
          .map((ep) => ({
            episode: Number(ep.episode) || 1,
            title: ep.title || `Episodul ${ep.episode}`,
            duration: Number(ep.duration) || 0,
            audioNames: Array.isArray(ep.audio?.names)
              ? ep.audio.names
              : ['Русский'],
          })),
      }));

      const targetSeason =
        sortedRawSeasons.find((s) => Number(s.season) === Number(season)) ||
        sortedRawSeasons[0];
      const episodes = Array.isArray(targetSeason?.episodes)
        ? [...targetSeason.episodes].sort(
            (a, b) => (Number(a?.episode) || 1) - (Number(b?.episode) || 1)
          )
        : [];
      const targetEp =
        episodes.find((e) => Number(e.episode) === Number(episode)) ||
        episodes[0];

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

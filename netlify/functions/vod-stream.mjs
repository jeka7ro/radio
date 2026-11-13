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
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : _;
    })
    .replace(/\\\//g, '/')
    .normalize('NFC')
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
  ua = DEFAULT_VOD_UA,
  extraParams = ''
) {
  if (!rawUrl) return '';
  if (String(rawUrl).startsWith('/api/tv-proxy')) return String(rawUrl);
  return `/api/tv-proxy?url=${encodeURIComponent(rawUrl)}&ref=${encodeURIComponent(refUrl)}&ua=${encodeURIComponent(ua)}${extraParams}`;
}

async function extractVkVideoStreams(oid, vid, vkHash = '') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const cleanHash = String(vkHash || '').replace(/[^a-zA-Z0-9]/g, '');
    const res = await fetch('https://vkvideo.ru/al_video.php?act=show', {
      method: 'POST',
      headers: {
        'User-Agent': DEFAULT_VOD_UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        Origin: 'https://vkvideo.ru',
        Referer: 'https://vkvideo.ru/',
      },
      body: `act=show&al=1&video=${oid}_${vid}${cleanHash ? `&list=${cleanHash}` : ''}`,
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const text = new TextDecoder('windows-1251').decode(await res.arrayBuffer());
    const unescapeUrl = (u) =>
      u ? u.replace(/\\\//g, '/').replace(/\\u0026/g, '&') : '';
    const hlsMatch = text.match(/"hls"\s*:\s*"([^"]+)"/);
    const hlsUrl = unescapeUrl(hlsMatch?.[1]);
    const durMatch = text.match(/"duration"\s*:\s*(\d+)/);
    const durationSec = durMatch ? Number(durMatch[1]) || 0 : 0;
    const mp4Matches = [...text.matchAll(/"url(\d+)"\s*:\s*"([^"]+)"/g)];
    const rawMaxMp4Height = mp4Matches.reduce(
      (mx, m) => Math.max(mx, Number(m[1]) || 0),
      0
    );
    const qualities = mp4Matches
      .map((m) => ({ height: Number(m[1]), url: unescapeUrl(m[2]) }))
      .filter((q) => q.height >= 720 && q.url)
      .sort((a, b) => b.height - a.height);

    if (qualities.length === 0 && !hlsUrl) return null;
    const bestMp4 = qualities[0];
    const detectedMaxHeight =
      qualities[0]?.height || (rawMaxMp4Height > 0 ? rawMaxMp4Height : 1080);
    const vkIdToken = cleanHash ? `${oid}_${vid}_${cleanHash}` : `${oid}_${vid}`;
    const vkIdParam = `&vk=${encodeURIComponent(vkIdToken)}`;
    const proxiedHls = hlsUrl
      ? wrapTvProxyUrl(hlsUrl, 'https://vkvideo.ru/', DEFAULT_VOD_UA, vkIdParam)
      : '';
    const proxiedBestMp4 = bestMp4?.url
      ? wrapTvProxyUrl(
          bestMp4.url,
          'https://vkvideo.ru/',
          DEFAULT_VOD_UA,
          `${vkIdParam}&vkq=${bestMp4.height}`
        )
      : '';
    return {
      bestUrl: proxiedHls || proxiedBestMp4,
      hlsUrl: proxiedHls || proxiedBestMp4,
      rawHlsUrl: hlsUrl || bestMp4?.url,
      duration: durationSec,
      maxHeight: detectedMaxHeight,
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
                : `${q.height}p HD`,
        url: wrapTvProxyUrl(
          q.url,
          'https://vkvideo.ru/',
          DEFAULT_VOD_UA,
          `${vkIdParam}&vkq=${q.height}`
        ),
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
    kpIds: ['5508530'],
    imdbIds: ['tt31712367'],
    titleRe:
      /^(?!.*в\s+(?:африке|джунглях|тропиках))(?:шоу\s+)?(?:зв[её]зды|zvyozdy)(?:\b|[.\s•(-]|$)/i,
    buildSeasons: async () => {
      const raw = await fetchVkRawSectionList(-220754053, 'all');
      const seasonsMap = new Map();
      let lastSeenSeason = 1;
      for (const item of [...raw].reverse()) {
        const title = decodeVkHtmlEntities(item[3]);
        const dur = parseDurationToSeconds(item[5]);
        if (dur < 2100) continue;
        if (
          !/^Зв[её]зды(?:\s+\d+)?[.\s:|]/i.test(title) ||
          /тизер|трейлер|анонс|скоро\s+в\s+vk/i.test(title) ||
          /в\s+(?:африке|джунглях|тропиках)/i.test(title)
        ) {
          continue;
        }
        const explicitSeasonMatch =
          title.match(/^Зв[её]зды\s+(\d+)\s*[.:|]/i) ||
          title.match(/(\d+)\s*сезон/i);
        const isMainSeason1Ep =
          !explicitSeasonMatch &&
          /^Зв[её]зды\.\s*(?:Фестиваль|Дуэль|Финал)\b/i.test(title);
        const sNum = explicitSeasonMatch
          ? Number(explicitSeasonMatch[1]) || 1
          : isMainSeason1Ep
            ? 1
            : lastSeenSeason;
        if (explicitSeasonMatch || isMainSeason1Ep) {
          lastSeenSeason = sNum;
        }
        if (!seasonsMap.has(sNum)) seasonsMap.set(sNum, []);
        const list = seasonsMap.get(sNum);
        const epNumMatch = title.match(/(\d+)\s*(?:выпуск|серия)\b/i);
        const parsedEp = epNumMatch ? Number(epNumMatch[1]) : 0;
        const nextSequentialEp =
          (list.length > 0 ? list[list.length - 1].episode : 0) + 1;
        const epNum =
          parsedEp > 0 && !list.some((x) => x.episode === parsedEp)
            ? parsedEp
            : nextSequentialEp;
        list.push({
          season: sNum,
          episode: epNum,
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
    kpIds: ['5318639'],
    imdbIds: ['tt27998787'],
    titleRe: /^(?:шоу\s*)?«?кстати»?(?:\b|$)|\bшоу\s*«?кстати»?|^by\s+the\s+way$/i,
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
    const allResults = [];
    let nextUrl = `https://rutube.ru/api/metainfo/tv/${tvId}/video/?season=${rutubeSeason}&type=2&format=json`;
    let pageCount = 0;
    while (nextUrl && pageCount < 2) {
      pageCount++;
      const res = await fetch(nextUrl, {
        headers: { 'User-Agent': DEFAULT_VOD_UA },
        signal: controller.signal,
      });
      if (!res.ok) break;
      const data = await res.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      allResults.push(...results);
      nextUrl = data?.has_next && typeof data?.next === 'string' ? data.next : null;
    }
    const sorted = [...allResults].sort(
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
        const rawEpNums = rawVids
          .map((v) => Number(v?.episode) || 0)
          .filter((n) => n > 0);
        const minRawEp = rawEpNums.length > 0 ? Math.min(...rawEpNums) : 0;
        const useDirectEpNum = minRawEp === 1;

        const epMap = new Map();
        rawVids.forEach((v, idx) => {
          const titleSeasonEpMatch = String(v.title || '').match(
            /сезон\s*[,:.\s-]*?(?:выпуск\s*(\d+)|(\d+)\s*(?:выпуск|серия))/i
          );
          const parsedTitleEp = Number(
            titleSeasonEpMatch?.[1] || titleSeasonEpMatch?.[2] || 0
          );
          const epNum = useDirectEpNum
            ? Number(v.episode) || idx + 1
            : parsedTitleEp > 0 && parsedTitleEp <= 45
              ? parsedTitleEp
              : idx + 1;
          if (!epMap.has(epNum)) {
            epMap.set(epNum, {
              episode: epNum,
              videoId: v.id,
              title: v.title || `Выпуск ${epNum}`,
              thumbnail: v.thumbnail_url,
              duration: Number(v.duration) || 5400,
              audioNames: ['Русский (Оригинал • 1080p)'],
            });
          }
        });
        return {
          season: sm.displaySeason,
          episodes: [...epMap.values()].sort((a, b) => a.episode - b.episode),
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
        seasonsOut.push({
          season: fb.season,
          episodes: Array.from({ length: fb.count }, (_, idx) => ({
            episode: idx + 1,
            videoId: '',
            title: `Сезон ${fb.season} • Выпуск ${idx + 1}`,
            duration: 5400,
            audioNames: ['Русский (Оригинал • 1080p)'],
          })),
        });
      } else if (existing.episodes.length < fb.count) {
        const existingEpNums = new Set(existing.episodes.map((e) => e.episode));
        for (let ep = 1; ep <= fb.count; ep++) {
          if (!existingEpNums.has(ep)) {
            existing.episodes.push({
              episode: ep,
              videoId: '',
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

  const serializedSeasons = seasonsOut.map((s) => ({
    season: s.season,
    episodes: s.episodes.map((e) => ({
      episode: e.episode,
      title: e.title,
      thumbnail: e.thumbnail,
      duration: e.duration,
      audioNames: e.audioNames,
    })),
  }));

  const targetSeason = seasonsOut.find(
    (s) => Number(s.season) === Number(season)
  );
  const targetEp = targetSeason?.episodes.find(
    (e) => Number(e.episode) === Number(episode)
  );

  if (!targetSeason || !targetEp || !targetEp.videoId) {
    return {
      ok: false,
      type: 'series',
      sourcePath: 'Kinozal VIP (1080p)',
      season: Number(season) || 1,
      episode: Number(episode) || 1,
      seasons: serializedSeasons,
      error: 'Episode not on Rutube; using Kinozal VIP fallback',
    };
  }
  const hlsUrl = await fetchRutubePlayHls(targetEp.videoId);
  if (!hlsUrl) {
    return {
      ok: false,
      type: 'series',
      sourcePath: 'Kinozal VIP (1080p)',
      season: Number(season) || 1,
      episode: Number(episode) || 1,
      seasons: serializedSeasons,
      error: 'Rutube stream unavailable; using Kinozal VIP fallback',
    };
  }

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
    seasons: serializedSeasons,
  };
}

const KINOGRAM_MIRROR_HOSTS = [
  'https://api.namy.ws',
  'https://api.delivembd.ws',
  'https://api.embess.ws',
  'https://api.luxembd.ws',
  'https://api.kinogram.best',
];
let lastWorkingKinogramHost = 'https://api.namy.ws';

async function fetchKinogramEmbed(path, userAgent = '') {
  const effectiveUa = pickSafeDesktopUa(userAgent);
  const orderedHosts = [
    lastWorkingKinogramHost,
    ...KINOGRAM_MIRROR_HOSTS.filter((h) => h !== lastWorkingKinogramHost),
  ];
  for (const host of orderedHosts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
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
      if (!res.ok) continue;
      const html = await res.text();
      if (!html || !html.includes('makePlayer(')) continue;
      lastWorkingKinogramHost = host;
      return html;
    } catch {
      // try next Collaps mirror
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

const KNOWN_SHOW_TITLE_TO_KP = [
  { re: /^(новые\s+)?зв[её]зды\s+в\s+африке(?:\b|[.\s•(-]|$)/i, kpId: '4761950' },
  { re: /^(камеди\s+клаб|comedy\s+club)(?:\b|[.\s•(-]|$)/i, kpId: '471505' },
  {
    re: /^(?!.*в\s+(?:африке|джунглях|тропиках))(?:шоу\s+)?зв[её]зды(?:\b|[.\s•(-]|$)/i,
    kpId: '5508530',
  },
  { re: /^жизнь\s+заново(?:\b|[.\s•(-]|$)/i, kpId: '7958160' },
];

async function lookupKpIdsByTitle(title, mediaType = '', year = '') {
  if (!title || String(title).trim().length < 2) return [];
  const cleanTitle = String(title).trim();
  for (const entry of KNOWN_SHOW_TITLE_TO_KP) {
    if (entry.re.test(cleanTitle)) return [entry.kpId];
  }
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
    const wantSeries = mediaType === 'series' || mediaType === 'tv';
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
        if (hasValidTargetYr && f.year && f.year !== 'null') {
          const fYr = Number(String(f.year || '').slice(0, 4));
          if (Number.isFinite(fYr) && fYr > 1900) {
            if (!wantSeries && Math.abs(fYr - targetYr) > 1) return false;
            if (wantSeries && fYr > targetYr + 1) return false;
          }
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
        const fYr = Number(String(f.year || '').slice(0, 4));
        if (hasValidTargetYr && Number.isFinite(fYr) && Math.abs(fYr - targetYr) <= 1) {
          score += 12;
        } else if ((!f.year || f.year === 'null') && (!hasValidTargetYr || targetYr >= 2025)) {
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
  const wantSeries = mediaType === 'series' || mediaType === 'tv';

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
      (c) => n === c || n === `шоу ${c}` || c === `шоу ${n}`
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
      return matchesTitle(it.title);
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

  const serializedIedemSeasons = validSeasons.map((s) => ({
    season: s.season,
    episodes: s.episodes.map((e) => ({
      episode: e.episode,
      title: e.title,
      duration: e.duration,
      audioNames: e.audioNames,
    })),
  }));

  const exactSeason = validSeasons.find(
    (s) => Number(s.season) === Number(season)
  );
  if (!exactSeason) {
    return {
      ok: false,
      type: 'series',
      seasons: serializedIedemSeasons,
      error: 'Requested season not available on iEdem VIP',
    };
  }
  const targetSeasonObj = exactSeason;
  const targetEpObj = targetSeasonObj.episodes.find(
    (e) => Number(e.episode) === Number(episode)
  );

  if (!targetEpObj?.url) {
    return {
      ok: false,
      type: 'series',
      seasons: serializedIedemSeasons,
      error: 'Requested episode not available on iEdem VIP',
    };
  }

  // Verify the episode is a full episode (not a 12-second season teaser placeholder)
  const isFullEp = await verifyIedemHlsNotTrailer(targetEpObj.url);
  if (!isFullEp) {
    return {
      ok: false,
      type: 'series',
      seasons: serializedIedemSeasons,
      error: 'iEdem VIP returned trailer placeholder',
    };
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
    seasons: serializedIedemSeasons,
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
    /(?:трейлер|тизер|обзор|реакц|реакт|смотр|посмотр|ясновидящ|таро|гадан|разбор|стрим|прохождение|подкаст|нарезка|отрывок|клип|анонс|промо|trailer|teaser)/i.test(
      t
    );

  const matchesTitlePrefix = (nt) =>
    normCands.some(
      (c) =>
        nt.startsWith(c) ||
        nt.startsWith(`шоу ${c}`) ||
        nt.startsWith(`телешоу ${c}`) ||
        nt.startsWith(`сериал ${c}`) ||
        nt.startsWith(`фильм ${c}`) ||
        nt.startsWith(`новые ${c}`)
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
          if (x.duration < 1200 || x.duration > 14400 || isTrailerOrJunk(x.title)) {
            return false;
          }
          const explicitSeasonNum = (() => {
            const mSez =
              String(x.title || '').match(/(\d+)\s*сезон/i) ||
              String(x.title || '').match(/сезон\s*(\d+)/i) ||
              String(x.title || '').match(/\bs0*(\d{1,2})(?:e\d{1,3}|\b)/i);
            if (mSez) return Number(mSez[1]);
            for (const cand of candidates) {
              const escaped = String(cand || '')
                .trim()
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              if (!escaped) continue;
              const mAfterTitle = String(x.title || '').match(
                new RegExp(`(?:^|\\b)${escaped}\\s+(\\d{1,2})\\s*[.:|\\-]`, 'i')
              );
              if (mAfterTitle) return Number(mAfterTitle[1]);
            }
            return 0;
          })();
          if (Number(season) > 1) {
            if (explicitSeasonNum !== Number(season)) {
              return false;
            }
          } else if (explicitSeasonNum > 1) {
            return false;
          }
          const nt = normCompareTitle(x.title);
          return matchesTitlePrefix(nt);
        });

      if (parsed.length === 0) continue;

      const exactEpRe = new RegExp(
        `(?:^|[^\\d])0*${episode}\\s*(?:серия|выпуск|ep|серии)(?:[^\\d]|$)|\\bs0*${season}e0*${episode}\\b`,
        'i'
      );
      const bestEp =
        parsed.find((x) => exactEpRe.test(x.title) && /4k|uhd|2160/i.test(x.title)) ||
        parsed.find((x) => exactEpRe.test(x.title));
      if (!bestEp) continue;

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

function isGenericBalancerEpTitle(title) {
  const t = String(title || '').trim();
  if (!t) return true;
  if (/^(?:Episodul|Episode|Серия|Выпуск)\s*\d+$/i.test(t)) return true;
  if (/\(\d+\s*сезон\)\s*-\s*\d+\s*(?:серия|выпуск)/i.test(t)) return true;
  if (/^Сезон\s*\d+\s*•\s*Выпуск\s*\d+$/i.test(t)) return true;
  return false;
}

function mergeSeasonsCatalogs(...catalogs) {
  const seasonMap = new Map();
  for (const cat of catalogs) {
    if (!Array.isArray(cat)) continue;
    for (const s of cat) {
      const sNum = Number(s?.season);
      if (!sNum || sNum <= 0 || !Array.isArray(s?.episodes)) continue;
      if (!seasonMap.has(sNum)) {
        seasonMap.set(sNum, new Map());
      }
      const epMap = seasonMap.get(sNum);
      for (const ep of s.episodes) {
        const epNum = Number(ep?.episode);
        if (!epNum || epNum <= 0) continue;
        const prev = epMap.get(epNum);
        if (!prev) {
          epMap.set(epNum, { ...ep, episode: epNum });
        } else {
          const preferNewTitle =
            isGenericBalancerEpTitle(prev.title) &&
            !isGenericBalancerEpTitle(ep.title);
          epMap.set(epNum, {
            ...prev,
            title: preferNewTitle ? ep.title : prev.title || ep.title,
            thumbnail: prev.thumbnail || ep.thumbnail,
            duration: prev.duration || ep.duration || 0,
            audioNames:
              Array.isArray(prev.audioNames) && prev.audioNames.length > 0
                ? prev.audioNames
                : ep.audioNames,
          });
        }
      }
    }
  }
  const out = [...seasonMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([season, epMap]) => ({
      season,
      episodes: [...epMap.values()].sort((a, b) => a.episode - b.episode),
    }))
    .filter((s) => s.episodes.length > 0);
  return out.length > 0 ? out : undefined;
}

const roCategoryPostsCache = new Map();
const RO_CATEGORY_CACHE_TTL_MS = 20 * 60 * 1000;

function normalizeRoAscii(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ăâ]/gi, 'a')
    .replace(/[î]/gi, 'i')
    .replace(/[șş]/gi, 's')
    .replace(/[țţ]/gi, 't')
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&#\d+;/g, ' ')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ROMANIAN_CLOUD_SHOWS = [
  {
    imdbIds: ['tt10295772'],
    titleRe: /\basia\s+express\b/i,
    canonicalQuery: 'Asia Express',
    coreTokens: ['asia', 'express'],
    // IMDb/FileList omits the 2 "America Express" seasons (TV S5 & S6), so App S5=TV S7, S6=TV S8, S7=TV S9
    toPortalSeason: (s) => (s >= 5 ? s + 2 : s),
    knownCategories: [
      { appSeason: 7, portalSeason: 9, catId: 234 },
      { appSeason: 6, portalSeason: 8, catId: 186 },
      { appSeason: 5, portalSeason: 7, catId: 170 },
    ],
  },
  {
    imdbIds: ['tt26254014', 'tt26745180'],
    titleRe: /\bamerica\s+express\b/i,
    canonicalQuery: 'America Express',
    coreTokens: ['america', 'express'],
    knownCategories: [
      { appSeason: 2, portalSeason: 2, catId: 145 },
      { appSeason: 1, portalSeason: 1, catId: 99 },
    ],
  },
  {
    imdbIds: ['tt28504410', 'tt8690918'],
    titleRe: /\binsula\s+iubirii\b/i,
    canonicalQuery: 'Insula Iubirii',
    coreTokens: ['insula', 'iubirii'],
  },
  {
    imdbIds: ['tt35405683', 'tt31185469'],
    titleRe: /\bpower\s+couple\b/i,
    canonicalQuery: 'Power Couple',
    coreTokens: ['power', 'couple'],
  },
  {
    imdbIds: ['tt13093364', 'tt6226256'],
    titleRe: /\bchefi\s+la\s+cutite\b/i,
    canonicalQuery: 'Chefi la Cutite',
    coreTokens: ['chefi', 'cutite'],
  },
  {
    imdbIds: ['tt1745739', 'tt2226317', 'tt2299807'],
    titleRe: /\blas\s+fierbinti\b/i,
    canonicalQuery: 'Las Fierbinti',
    coreTokens: ['las', 'fierbinti'],
  },
  {
    imdbIds: ['tt21747100', 'tt11640352'],
    titleRe: /\bsurvivor\s+romania\b/i,
    canonicalQuery: 'Survivor Romania',
    coreTokens: ['survivor'],
    knownCategories: [
      { appSeason: 7, portalSeason: 7, catId: 196 },
      { appSeason: 5, portalSeason: 5, catId: 155, allowAllStars: true },
      { appSeason: 4, portalSeason: 4, catId: 102 },
    ],
  },
  {
    imdbIds: ['tt21603982'],
    titleRe: /\bclanul\b/i,
    canonicalQuery: 'Clanul',
    coreTokens: ['clanul'],
  },
  {
    imdbIds: ['tt33088572'],
    titleRe: /\b(tatutu|tatuajul)\b/i,
    canonicalQuery: 'Tatutu',
    coreTokens: ['tatutu'],
  },
  {
    imdbIds: ['tt34192055'],
    titleRe: /\bscara\s+b\b/i,
    canonicalQuery: 'Scara B',
    coreTokens: ['scara'],
  },
  {
    imdbIds: ['tt28803286'],
    titleRe: /\bcamera\s*609\b/i,
    canonicalQuery: 'Camera 609',
    coreTokens: ['camera', '609'],
  },
  {
    imdbIds: [],
    titleRe: /\bana\s+mi\s+ai\s+fost\s+scrisa\s+in\s+adn\b/i,
    canonicalQuery: 'Ana Mi-ai Fost Scrisa in ADN',
    coreTokens: ['ana', 'adn'],
  },
  {
    imdbIds: [],
    titleRe: /\biubire\s+cu\s+parfum\s+de\s+lavanda\b/i,
    canonicalQuery: 'Iubire cu parfum de lavanda',
    coreTokens: ['parfum', 'lavanda'],
  },
  {
    imdbIds: [],
    titleRe: /\bpoftiti\s+pe\s+la\s+noi\b/i,
    canonicalQuery: 'Poftiti Pe La Noi',
    coreTokens: ['poftiti'],
  },
  {
    imdbIds: [],
    titleRe: /\bbravo\s+ai\s+stil\b/i,
    canonicalQuery: 'Bravo Ai Stil',
    coreTokens: ['bravo', 'stil'],
  },
  {
    imdbIds: [],
    titleRe: /\bjocul\s+cuvintelor\b/i,
    canonicalQuery: 'Jocul Cuvintelor',
    coreTokens: ['jocul', 'cuvintelor'],
  },
];

function detectRomanianShowDescriptor(imdb, rawTitle) {
  const cleanImdb = String(imdb || '').trim().split(':')[0];
  const asciiTitle = normalizeRoAscii(rawTitle)
    .replace(/\(\s*s\d+[^)]*\)/gi, ' ')
    .replace(/\bs\d{1,2}(?:\s*e\d{1,3})?\b/gi, ' ')
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/\b(?:1080[pi]|720p|2160p|antp|protv|voyo|web\s*dl|hdtv|playweb|playtv)\b.*$/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/insula\s+iubirii\s+parodia/i.test(asciiTitle)) {
    return {
      canonicalQuery: 'Insula Iubirii Parodia',
      coreTokens: ['insula', 'parodia'],
      toPortalSeason: (s) => s,
      knownCategories: [],
    };
  }
  if (/chefi\s+la\s+cutite\s+viitorul\s+are\s+gust/i.test(asciiTitle)) {
    return {
      canonicalQuery: 'Chefi la cutite Viitorul are gust',
      coreTokens: ['chefi', 'viitorul'],
      toPortalSeason: (s) => s,
      knownCategories: [],
    };
  }

  for (const show of ROMANIAN_CLOUD_SHOWS) {
    if (
      (cleanImdb && show.imdbIds.includes(cleanImdb)) ||
      (asciiTitle && show.titleRe.test(asciiTitle))
    ) {
      return {
        ...show,
        toPortalSeason: show.toPortalSeason || ((s) => s),
        knownCategories: show.knownCategories || [],
      };
    }
  }
  return null;
}

async function fetchVeziaiciCategoryPosts(catId, ua) {
  const cached = roCategoryPostsCache.get(catId);
  if (cached && Date.now() - cached.ts < RO_CATEGORY_CACHE_TTL_MS) {
    return cached.posts;
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6500);
  try {
    const res = await fetch(
      `https://veziaici.net/wp-json/wp/v2/posts?categories=${catId}&per_page=100&_fields=id,slug,title`,
      {
        headers: { 'User-Agent': ua },
        signal: ctrl.signal,
      }
    );
    if (!res.ok) return [];
    const posts = await res.json();
    if (Array.isArray(posts) && posts.length > 0) {
      roCategoryPostsCache.set(catId, { ts: Date.now(), posts });
      return posts;
    }
    return [];
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

async function extractVidmolyDirectHls(vmId, ua) {
  if (!vmId) return null;
  for (const host of [
    'https://vidmoly.net',
    'https://vidmoly.org',
    'https://vidmoly.biz',
    'https://vidmoly.to',
  ]) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5500);
    try {
      const res = await fetch(`${host}/embed-${vmId}.html`, {
        headers: {
          'User-Agent': ua,
          Referer: 'https://veziaici.net/',
        },
        signal: ctrl.signal,
      });
      if (!res.ok) continue;
      const html = await res.text();
      const m3u8Url = html.match(/https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/i)?.[0];
      if (m3u8Url) {
        return wrapTvProxyUrl(
          m3u8Url,
          `${host}/`,
          ua,
          `&vm=${encodeURIComponent(vmId)}`
        );
      }
    } catch {
      // try next mirror
    } finally {
      clearTimeout(t);
    }
  }
  return null;
}

async function extractRumbleDirectHls(rumbleId, ua) {
  if (!rumbleId) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5500);
  try {
    const res = await fetch(`https://rumble.com/embed/${rumbleId}/`, {
      headers: {
        'User-Agent': ua,
        Referer: 'https://veziaici.net/',
      },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const html = await res.text();
    const allUrls = [
      ...html.matchAll(/https?:\\?\/\\?\/[^"'\s<>]+\.(?:m3u8|mp4)[^"'\s<>]*/gi),
    ].map((m) => m[0].replace(/\\\//g, '/'));
    const hlsVod = allUrls.find((u) => /rumble\.com\/hls-vod\/[^?]+\.m3u8/i.test(u));
    if (hlsVod) return hlsVod;
    const mp4Url = allUrls.find((u) => /\.mp4(\?|$)/i.test(u));
    return mp4Url || null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function matchesRomanianEpisodePost(post, descriptor, portalSeason, episode, allowAllStars = false) {
  const hay = normalizeRoAscii(`${post?.title?.rendered || ''} ${post?.slug || ''}`).toLowerCase();
  if (!hay) return false;
  for (const tok of descriptor.coreTokens) {
    if (!hay.includes(tok.toLowerCase())) return false;
  }
  const epRe = new RegExp(`\\bepisodul\\s*0*${Number(episode)}\\b`, 'i');
  if (!epRe.test(hay)) return false;

  const seasonMatches = [...hay.matchAll(/\bsezonul\s*0*(\d+)\b/gi)].map((m) => Number(m[1]));
  if (seasonMatches.length > 0) {
    return seasonMatches.includes(Number(portalSeason));
  }
  if (allowAllStars && /\ball\s*stars\b/i.test(hay)) {
    return true;
  }
  return Number(portalSeason) === 1;
}

async function resolveFromRomanianCloudVod({
  imdb,
  title,
  season = 1,
  episode = 1,
  effectiveUa,
}) {
  const descriptor = detectRomanianShowDescriptor(imdb, title);
  if (!descriptor) return null;

  const appSeason = Math.max(1, Number(season) || 1);
  const targetEp = Math.max(1, Number(episode) || 1);
  const portalSeason = descriptor.toPortalSeason(appSeason);
  const matchedCat = descriptor.knownCategories.find(
    (c) => c.appSeason === appSeason
  );

  let builtSeasonsCatalog = undefined;
  let targetPost = null;

  const searchQueries = [
    `${descriptor.canonicalQuery} Sezonul ${portalSeason} Episodul ${targetEp}`,
  ];
  if (matchedCat?.allowAllStars) {
    searchQueries.push(
      `${descriptor.canonicalQuery} All Stars Episodul ${targetEp}`
    );
  }
  if (portalSeason === 1) {
    searchQueries.push(`${descriptor.canonicalQuery} Episodul ${targetEp}`);
  }

  const searchPromise = (async () => {
    for (const q of searchQueries) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6500);
      try {
        const res = await fetch(
          `https://veziaici.net/wp-json/wp/v2/posts?search=${encodeURIComponent(
            q
          )}&orderby=relevance&per_page=15&_fields=id,slug,title,content`,
          {
            headers: { 'User-Agent': effectiveUa },
            signal: ctrl.signal,
          }
        );
        if (!res.ok) continue;
        const posts = await res.json();
        if (!Array.isArray(posts)) continue;
        const hit = posts.find((p) =>
          matchesRomanianEpisodePost(
            p,
            descriptor,
            portalSeason,
            targetEp,
            Boolean(matchedCat?.allowAllStars)
          )
        );
        if (hit) return hit;
      } catch {
        // try next query
      } finally {
        clearTimeout(t);
      }
    }
    return null;
  })();

  const categoryPromise =
    descriptor.knownCategories.length > 0
      ? Promise.all(
          descriptor.knownCategories.map(async (catMeta) => {
            const posts = await fetchVeziaiciCategoryPosts(
              catMeta.catId,
              effectiveUa
            );
            const epMap = new Map();
            for (const p of posts) {
              const hay = normalizeRoAscii(
                `${p?.title?.rendered || ''} ${p?.slug || ''}`
              );
              const epM = hay.match(/\bepisodul\s*0*(\d+)\b/i);
              if (!epM) continue;
              const epNum = Number(epM[1]);
              if (!epNum || epMap.has(epNum)) continue;
              epMap.set(epNum, {
                postId: p.id,
                episode: epNum,
                title: normalizeRoAscii(p?.title?.rendered || `Episodul ${epNum}`),
                duration: 10800,
                audioNames: ['Română (Original)'],
              });
            }
            return {
              appSeason: catMeta.appSeason,
              episodes: [...epMap.values()].sort((a, b) => a.episode - b.episode),
            };
          })
        )
      : Promise.resolve([]);

  // Await searchPromise immediately so VK/Vidmoly extraction starts in ~250ms while categoryPromise finishes in parallel!
  targetPost = await searchPromise;

  const buildCatalogFromRaw = (catSeasonsRaw) => {
    if (!Array.isArray(catSeasonsRaw) || catSeasonsRaw.length === 0) return undefined;
    const validSeasons = catSeasonsRaw
      .filter((s) => s.episodes.length > 0)
      .sort((a, b) => a.appSeason - b.appSeason)
      .map((s) => ({
        season: s.appSeason,
        episodes: s.episodes.map(({ episode: epN, title: epT, duration, audioNames }) => ({
          episode: epN,
          title: epT,
          duration,
          audioNames,
        })),
      }));
    return validSeasons.length > 0 ? validSeasons : undefined;
  };

  if (!targetPost) {
    const catSeasonsRaw = await categoryPromise;
    builtSeasonsCatalog = buildCatalogFromRaw(catSeasonsRaw);
    if (Array.isArray(catSeasonsRaw)) {
      const seasonObj = catSeasonsRaw.find((s) => s.appSeason === appSeason);
      const epEntry = seasonObj?.episodes.find((e) => e.episode === targetEp);
      if (epEntry?.postId) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5500);
        try {
          const pRes = await fetch(
            `https://veziaici.net/wp-json/wp/v2/posts/${epEntry.postId}?_fields=id,slug,title,content`,
            { headers: { 'User-Agent': effectiveUa }, signal: ctrl.signal }
          );
          if (pRes.ok) {
            targetPost = await pRes.json();
          }
        } catch {
          // ignore
        } finally {
          clearTimeout(t);
        }
      }
    }
  }

  if (!targetPost?.content?.rendered) {
    return builtSeasonsCatalog
      ? {
          ok: false,
          type: 'series',
          seasons: builtSeasonsCatalog,
          error: 'Requested Romanian episode not yet published on cloud portal',
        }
      : null;
  }

  let postHtml = String(targetPost.content.rendered || '').replace(
    /&#038;|&amp;/gi,
    '&'
  );
  for (const secMatch of postHtml.matchAll(/data-secure="([^"]+)"/gi)) {
    try {
      postHtml +=
        '\n' +
        Buffer.from(secMatch[1], 'base64')
          .toString('utf8')
          .replace(/&#038;|&amp;/gi, '&');
    } catch {
      // ignore invalid base64
    }
  }

  const vkCandidates = [];
  const seenVk = new Set();
  for (const m of postHtml.matchAll(
    /https?:\/\/(?:www\.)?(?:vkvideo\.ru|vk\.ru|vk\.com)\/video_ext\.php\?[^"'\s<>]+/gi
  )) {
    try {
      const u = new URL(m[0]);
      const oid = (u.searchParams.get('oid') || '').trim();
      const vid = (u.searchParams.get('id') || '').trim();
      const hash = (u.searchParams.get('hash') || '').trim();
      if (!oid || !vid) continue;
      const key = `${oid}_${vid}`;
      if (seenVk.has(key)) continue;
      seenVk.add(key);
      vkCandidates.push({ oid, vid, hash });
    } catch {
      // ignore malformed URL
    }
  }

  const vmIds = [
    ...new Set(
      [
        ...postHtml.matchAll(/vidmoly\.[a-z]+\/embed-([a-zA-Z0-9_-]+)\.html/gi),
      ].map((m) => m[1])
    ),
  ];
  const rumbleIds = [
    ...new Set(
      [...postHtml.matchAll(/rumble\.com\/embed\/([a-zA-Z0-9_-]+)/gi)].map(
        (m) => m[1]
      )
    ),
  ];

  const [vkStreamsRaw, vmHlsUrl, rumbleHlsUrl, catSeasonsFinal] = await Promise.all([
    Promise.all(
      vkCandidates
        .slice(0, 3)
        .map((c) => extractVkVideoStreams(c.oid, c.vid, c.hash))
    ),
    vmIds[0]
      ? Promise.race([
          extractVidmolyDirectHls(vmIds[0], effectiveUa),
          new Promise((r) => setTimeout(() => r(null), vkCandidates.length > 0 ? 4000 : 5500)),
        ])
      : Promise.resolve(null),
    rumbleIds[0]
      ? Promise.race([
          extractRumbleDirectHls(rumbleIds[0], effectiveUa),
          new Promise((r) => setTimeout(() => r(null), vkCandidates.length > 0 ? 2200 : 5500)),
        ])
      : Promise.resolve(null),
    builtSeasonsCatalog
      ? Promise.resolve(null)
      : Promise.race([
          categoryPromise,
          new Promise((r) => setTimeout(() => r(null), 1800)),
        ]),
  ]);
  if (!builtSeasonsCatalog && catSeasonsFinal) {
    builtSeasonsCatalog = buildCatalogFromRaw(catSeasonsFinal);
  }

  const validVkStreams = vkStreamsRaw
    .filter((s) => s && s.bestUrl)
    .sort((a, b) => {
      // Always prefer full integral episodes (>= 85 min) over split parts
      const aFull = (a.duration || 0) >= 5100 ? 1 : 0;
      const bFull = (b.duration || 0) >= 5100 ? 1 : 0;
      if (aFull !== bFull) return bFull - aFull;
      if ((b.maxHeight || 0) !== (a.maxHeight || 0)) {
        return (b.maxHeight || 0) - (a.maxHeight || 0);
      }
      return (b.duration || 0) - (a.duration || 0);
    });

  const bestVk = validVkStreams[0] || null;
  const orderedStreams = [];
  if (bestVk?.bestUrl) {
    const vkMaxH = Number(bestVk.maxHeight) || 720;
    orderedStreams.push({
      url: bestVk.bestUrl,
      rawUrl: bestVk.rawHlsUrl || bestVk.bestUrl,
      sourcePath: `România Cloud HD (${vkMaxH >= 1080 ? '1080p Full HD' : vkMaxH >= 720 ? '720p HD' : '480p SD'})`,
      duration: bestVk.duration || 0,
      maxHeight: vkMaxH,
      priorityRank: 1,
      vkQualities: bestVk.qualities,
    });
  }
  if (vmHlsUrl) {
    const decVm = decodeURIComponent(vmHlsUrl);
    const vmMaxH = /_[a-z,]*x[a-z,]*\.urlset/i.test(decVm)
      ? 2160
      : /_[a-z,]*h[a-z,]*\.urlset/i.test(decVm)
        ? 1080
        : /_[a-z,]*n[a-z,]*\.urlset/i.test(decVm)
          ? 720
          : /_[a-z,]*l[a-z,]*\.urlset/i.test(decVm)
            ? 480
            : 720;
    orderedStreams.push({
      url: vmHlsUrl,
      rawUrl: vmHlsUrl,
      sourcePath: `România Cloud HD (Vidmoly ${vmMaxH >= 1080 ? '1080p Full HD' : '720p HD'})`,
      duration: bestVk?.duration || 0,
      maxHeight: vmMaxH,
      priorityRank: 2,
    });
  }
  if (rumbleHlsUrl) {
    orderedStreams.push({
      url: rumbleHlsUrl,
      rawUrl: rumbleHlsUrl,
      sourcePath: 'România Cloud HD (Rumble Direct)',
      duration: bestVk?.duration || 0,
      maxHeight: 480,
      priorityRank: 3,
    });
  }
  // Always prioritize HD (>= 720p) over SD (< 720p), and higher resolution first (with VK preferred on equal HD height)
  orderedStreams.sort((a, b) => {
    const aHd = (a.maxHeight || 0) >= 720 ? 1 : 0;
    const bHd = (b.maxHeight || 0) >= 720 ? 1 : 0;
    if (aHd !== bHd) return bHd - aHd;
    if ((b.maxHeight || 0) !== (a.maxHeight || 0)) {
      return (b.maxHeight || 0) - (a.maxHeight || 0);
    }
    return (a.priorityRank || 9) - (b.priorityRank || 9);
  });

  if (orderedStreams.length === 0) {
    return builtSeasonsCatalog
      ? {
          ok: false,
          type: 'series',
          seasons: builtSeasonsCatalog,
          error: 'No direct HLS stream extracted from Romanian episode page',
        }
      : null;
  }

  const primary = orderedStreams[0];
  const backupHlsUrls = orderedStreams
    .slice(1)
    .map((s) => s.url)
    .filter(Boolean);
  const cleanEpTitle = normalizeRoAscii(
    targetPost.title?.rendered || `${descriptor.canonicalQuery} • S${appSeason}:E${targetEp}`
  );

  return {
    ok: true,
    type: 'series',
    sourcePath: primary.sourcePath,
    season: appSeason,
    episode: targetEp,
    title: cleanEpTitle,
    duration: primary.duration || 0,
    audioNames: ['Română (Original)'],
    hlsUrl: primary.url,
    proxyHlsUrl: primary.url,
    rawHlsUrl: primary.rawUrl,
    backupHlsUrls: backupHlsUrls.length > 0 ? backupHlsUrls : undefined,
    vkQualities: primary.vkQualities,
    userAgent: effectiveUa,
    ...(builtSeasonsCatalog ? { seasons: builtSeasonsCatalog } : {}),
  };
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
  let fallbackSeasonsCatalog = undefined;

  // 0. Check Romanian Cloud TV Shows & Series first (Asia Express, Insula Iubirii, Power Couple, Las Fierbinti, Chefi la Cutite, Clanul, Tatutu, etc.)
  if (mediaType !== 'movie' && detectRomanianShowDescriptor(imdb, cleanTitle)) {
    const roRes = await resolveFromRomanianCloudVod({
      imdb,
      title: cleanTitle,
      season,
      episode,
      effectiveUa,
    });
    if (roRes?.seasons?.length) {
      fallbackSeasonsCatalog = mergeSeasonsCatalogs(
        fallbackSeasonsCatalog,
        roRes.seasons
      );
    }
    if (roRes && roRes.ok) {
      return {
        ...roRes,
        ...(fallbackSeasonsCatalog ? { seasons: fallbackSeasonsCatalog } : {}),
      };
    }
  }

  // 1. Check Official VK Video Curated Playlists & Verified Communities first
  const cleanImdb = String(imdb || '').trim();
  const matchedVkShow = VK_CURATED_SHOWS.find(
    (s) =>
      (cleanKp && s.kpIds.includes(cleanKp)) ||
      (cleanImdb && Array.isArray(s.imdbIds) && s.imdbIds.includes(cleanImdb)) ||
      (cleanTitle && s.titleRe.test(cleanTitle))
  );
  if (matchedVkShow) {
    const vkSeasons = await matchedVkShow.buildSeasons();
    if (Array.isArray(vkSeasons) && vkSeasons.length > 0) {
      const serializedVkSeasons = vkSeasons.map((s) => ({
        season: s.season,
        episodes: s.episodes.map((ep) => ({
          episode: ep.episode,
          title: ep.title,
          thumbnail: ep.thumbnail,
          duration: ep.duration,
          audioNames: ['Русский (VK Видео Direct)'],
        })),
      }));
      fallbackSeasonsCatalog = mergeSeasonsCatalogs(
        fallbackSeasonsCatalog,
        serializedVkSeasons
      );
      const targetSeason = vkSeasons.find(
        (s) => Number(s.season) === Number(season)
      );
      const targetEp = targetSeason?.episodes.find(
        (e) => Number(e.episode) === Number(episode)
      );
      if (targetSeason && targetEp) {
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
              seasons: fallbackSeasonsCatalog,
            };
          }
        }
        if (targetEp.oid && targetEp.vid) {
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
              seasons: fallbackSeasonsCatalog,
            };
          }
        }
      }
    }
  }

  // 2. Check Official RUTUBE Gazprom-Media TV Catalog (ТНТ, Пятница!, PREMIER, СТС)
  let rutubeFallbackRes = null;
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
    if (rutubeRes && Array.isArray(rutubeRes.seasons) && rutubeRes.seasons.length > 0) {
      fallbackSeasonsCatalog = mergeSeasonsCatalogs(
        fallbackSeasonsCatalog,
        rutubeRes.seasons
      );
      rutubeFallbackRes = {
        ...rutubeRes,
        seasons: fallbackSeasonsCatalog,
      };
    }
    if (rutubeRes && rutubeRes.ok) {
      return {
        ...rutubeRes,
        seasons: fallbackSeasonsCatalog || rutubeRes.seasons,
      };
    }
  }

  const isRuTvShowQuery =
    Boolean(matchedVkShow || matchedRutubeShow) ||
    (Number(cleanKp) >= 9001000 && Number(cleanKp) <= 9001999) ||
    /(?:^|[^\p{L}])(кстати|зв[её]зды|большое\s+шоу|натальная\s+карта|токсики|вопрос\s+ребром|прожарка|громкий\s+вопрос|тейбл\s+тайм|шоу\s+истории|неигры|контакты|битва\s+шефов|адская\s+кухня|адский\s+шеф|выжить\s+в|сокровища\s+императора|маска|аватар|конфетка|музыкальная\s+интуиция|стендап|stand\s*up|женский\s+стендап|comedy\s+club|камеди\s+клаб|однажды\s+в\s+россии|импровизаторы|импровизация|битва\s+экстрасенсов|экстрасенсы|пацанки|четыре\s+свадьбы|на\s+ножах|кондитер|молодые\s+ножи|холостяк|невеста|титаны|игры\s+титанов|вызов|последний\s+герой|чбд|что\s+было\s+дальше|ор[её]л\s+и\s+решка|мир\s+наизнанку)(?:[^\p{L}]|$)/iu.test(
      cleanTitle
    );
  const isRussianNativeQuery = Boolean(
    isRuTvShowQuery ||
      /[а-яА-ЯёЁ]/.test(cleanTitle) ||
      (cleanKp && !imdb)
  );

  // For Russian TV Shows (ТВ-Шоу / Emisiuni RU), prioritize VK Видео Direct (#1) before iEdem MediaLibrary & Kinogram!
  if (isRuTvShowQuery && mediaType !== 'movie') {
    const titleInfo = await resolveTitleCandidatesAndYear({
      imdb,
      kp: cleanKp,
      title: cleanTitle,
      mediaType: mediaType || 'series',
      year,
    });
    const vkShowRes = await resolveFromVkVideoSearch({
      ...titleInfo,
      season,
      episode,
      effectiveUa,
    });
    if (vkShowRes && vkShowRes.ok) {
      return {
        ...vkShowRes,
        ...(fallbackSeasonsCatalog ? { seasons: fallbackSeasonsCatalog } : {}),
      };
    }
  }

  const resolveSecondaryProviders = async () => {
    const titleInfo = await resolveTitleCandidatesAndYear({
      imdb,
      kp: cleanKp,
      title: cleanTitle,
      mediaType,
      year,
    });

    if (isRuTvShowQuery && (cleanKp || /[а-яА-ЯёЁ]/.test(cleanTitle) || titleInfo.ruTitle)) {
      const vkSearchFirst = await resolveFromVkVideoSearch({
        ...titleInfo,
        season,
        episode,
        effectiveUa,
      });
      if (vkSearchFirst && vkSearchFirst.ok) {
        return {
          ...vkSearchFirst,
          ...(fallbackSeasonsCatalog ? { seasons: fallbackSeasonsCatalog } : {}),
        };
      }
    }

    const iedemRes = await resolveFromIedemVip({
      ...titleInfo,
      season,
      episode,
      effectiveUa,
    });
    if (iedemRes && Array.isArray(iedemRes.seasons) && iedemRes.seasons.length > 0) {
      fallbackSeasonsCatalog = mergeSeasonsCatalogs(
        fallbackSeasonsCatalog,
        iedemRes.seasons
      );
    }
    if (iedemRes && iedemRes.ok) {
      return {
        ...iedemRes,
        seasons: fallbackSeasonsCatalog || iedemRes.seasons,
      };
    }

    if (!isRuTvShowQuery && (cleanKp || /[а-яА-ЯёЁ]/.test(cleanTitle) || titleInfo.ruTitle)) {
      const vkSearchRes = await resolveFromVkVideoSearch({
        ...titleInfo,
        season,
        episode,
        effectiveUa,
      });
      if (vkSearchRes && vkSearchRes.ok) {
        return {
          ...vkSearchRes,
          ...(fallbackSeasonsCatalog ? { seasons: fallbackSeasonsCatalog } : {}),
        };
      }
    }

    const embedUrl = await resolveFromAllohaEmbed({
      imdb,
      kp: cleanKp,
      season,
      episode,
    });
    if (rutubeFallbackRes || fallbackSeasonsCatalog) {
      return {
        ...(rutubeFallbackRes || {
          ok: false,
          type: 'series',
          error: 'Requested season or episode not available on direct VOD providers',
        }),
        seasons: fallbackSeasonsCatalog || rutubeFallbackRes?.seasons,
        ...(embedUrl ? { embedUrl, sourcePath: 'Alloha VIP (1080p)' } : {}),
      };
    }
    if (embedUrl) {
      return {
        ok: false,
        embedUrl,
        sourcePath: 'Alloha VIP (1080p)',
        error: 'Using clean Alloha VIP embed fallback',
      };
    }
    return { ok: false, error: 'Stream not found on VOD balancer' };
  };

  // 3. Check Kinogram / Collaps Balancer (Exact kp/ or imdb/ ID lookup — Full Multi-Season Catalog & Direct HLS/DASH)
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
    return resolveSecondaryProviders();
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
      const cleanSeasons = sortedRawSeasons.map((s) => {
        const rawEps = (Array.isArray(s.episodes) ? [...s.episodes] : []).sort(
          (a, b) => (Number(a?.episode) || 1) - (Number(b?.episode) || 1)
        );
        const filteredEps =
          cleanKp === '471505' && rawEps.some((ep) => ep.dash)
            ? rawEps.filter((ep) => Boolean(ep.dash))
            : rawEps;
        return {
          season: Number(s.season) || 1,
          episodes: filteredEps.map((ep) => ({
            episode: Number(ep.episode) || 1,
            title: ep.title || `Episodul ${ep.episode}`,
            duration: Number(ep.duration) || 0,
            audioNames: Array.isArray(ep.audio?.names)
              ? ep.audio.names
              : ['Русский'],
          })),
        };
      });

      fallbackSeasonsCatalog = mergeSeasonsCatalogs(
        fallbackSeasonsCatalog,
        cleanSeasons
      );

      const targetSeason = sortedRawSeasons.find(
        (s) => Number(s.season) === Number(season)
      );
      const episodes = Array.isArray(targetSeason?.episodes)
        ? [...targetSeason.episodes].sort(
            (a, b) => (Number(a?.episode) || 1) - (Number(b?.episode) || 1)
          )
        : [];
      let targetEp = episodes.find(
        (e) => Number(e.episode) === Number(episode)
      );
      if (
        cleanKp === '471505' &&
        targetEp &&
        !targetEp.dash &&
        !targetEp.hls &&
        episodes.some((e) => e.dash)
      ) {
        targetEp =
          episodes.find(
            (e) => e.dash && Number(e.episode) >= Number(episode)
          ) ||
          episodes.find((e) => e.dash) ||
          targetEp;
      }

      if (!targetSeason || !targetEp) {
        return resolveSecondaryProviders();
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

        // Prefer iEdem VIP MediaLibrary 4K/1080p H.264 .m3u8 for Russian series (and single-season series) while keeping Collaps seasons & DASH!
        if (cleanSeasons.length <= 1 || isRussianNativeQuery) {
          try {
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
            if (iedemRes && iedemRes.ok && iedemRes.hlsUrl) {
              return {
                ...iedemRes,
                dashUrl: dashUrl || iedemRes.dashUrl,
                dashaUrl: dashaUrl || iedemRes.dashaUrl,
                seasons:
                  mergeSeasonsCatalogs(fallbackSeasonsCatalog, iedemRes.seasons) ||
                  cleanSeasons,
              };
            }
          } catch {
            // ignore iEdem enrichment error
          }
        }

        const proxyHlsUrl = hlsUrl
          ? wrapTvProxyUrl(hlsUrl, `${lastWorkingKinogramHost}/`, effectiveUa)
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
          proxyHlsUrl,
          rawHlsUrl: hlsUrl,
          userAgent: effectiveUa,
          seasons: fallbackSeasonsCatalog || cleanSeasons,
        };
      }

      return resolveSecondaryProviders();
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
    const proxyHlsUrl = hlsUrl
      ? wrapTvProxyUrl(hlsUrl, `${lastWorkingKinogramHost}/`, effectiveUa)
      : undefined;

    if (isRussianNativeQuery) {
      try {
        const titleInfo = await resolveTitleCandidatesAndYear({
          imdb,
          kp: cleanKp,
          title: cleanTitle || titleMatch?.[1] || '',
          mediaType: 'movie',
          year,
        });
        const iedemMovieRes = await resolveFromIedemVip({
          ...titleInfo,
          season: 1,
          episode: 1,
          effectiveUa,
        });
        if (iedemMovieRes && iedemMovieRes.ok && iedemMovieRes.hlsUrl) {
          return {
            ...iedemMovieRes,
            dashUrl: dashUrl || iedemMovieRes.dashUrl,
            dashaUrl: dashaUrl || iedemMovieRes.dashaUrl,
          };
        }
      } catch {
        // ignore iEdem movie enrichment error
      }
    }

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
      proxyHlsUrl,
      rawHlsUrl: hlsUrl,
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

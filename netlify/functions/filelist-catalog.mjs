const DEFAULT_FL_CREDENTIALS = {
  username: 'jeka7ro',
  passkey: 'e5414e22e5327ac79101a9c63522107a',
};

const DEFAULT_KINOZAL_USERNAME = 'popescu20210';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function decodeHtmlEntities(str) {
  if (!str) return '';
  return String(str)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function hashToSyntheticId(infoHash) {
  const clean = String(infoHash || '').trim().toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    h ^= clean.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const abs = Math.abs(h | 0) || 100001;
  return -abs;
}

function parseCleanReleaseInfo(releaseName, categoryName) {
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

  const seriesMatch = raw.match(
    /^(.*?)[.\s]+(?:(19\d{2}|20\d{2})[.\s]+)?(S\d{1,2}(?:E\d{1,2})?|Season[\s.]?\d+)/i
  );
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
      .replace(
        /\b(2160p|1080p|720p|WEB-DL|WEBRip|BluRay|BDRip|HDRip|x264|x265|H\.?264|H\.?265|HEVC|DDP5\.1|AAC).*$/i,
        ''
      )
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

async function fetchFileListApi(action, extraParams) {
  const p = new URLSearchParams({
    username: DEFAULT_FL_CREDENTIALS.username,
    passkey: DEFAULT_FL_CREDENTIALS.passkey,
    action,
    ...extraParams,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(`https://filelist.io/api.php?${p.toString()}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((row) => {
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
      const poster = imdbId
        ? `https://images.metahub.space/poster/medium/${imdbId}/img`
        : '';
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
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function getFileListCatalog({ section = 'ro', query = '', imdb = '' }) {
  const catMap = {
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
    const items = await fetchFileListApi('search-torrents', {
      type: 'imdb',
      query: cleanImdb,
    });
    return items.sort((a, b) => b.seeders - a.seeders);
  }

  if (query) {
    if (/[а-яА-ЯёЁ]/.test(query) && !/[a-zA-Z]/.test(query)) return [];
    const extra = { type: 'name', query };
    if (section === 'xxx') extra.category = '7';
    const items = await fetchFileListApi('search-torrents', extra);
    return items.sort((a, b) => b.seeders - a.seeders);
  }

  const items = await fetchFileListApi('latest-torrents', {
    category: catIds,
    limit: '80',
  });
  return items.sort((a, b) => b.seeders - a.seeders);
}

const KINOZAL_RU_CATEGORIES = {
  top_ru: [5, 16],
  series_ru: [16],
  movies_ru: [5],
  tvshows_ru: [6],
  docs_ru: [12],
  cartoons_ru: [7],
  all_ru: [16, 5, 6, 12],
};

function parseKinozalRowsFromHtml(html, defaultType = 'movie', strictRussianOnly = true) {
  const rows = html.match(/<tr class="(?:gai|tum)">[\s\S]*?<\/tr>/gi) || [];
  const results = [];

  for (const row of rows) {
    const magMatch = row.match(/magnet:\?xt=urn:btih:([a-f0-9]{40})([^"']*)/i);
    const titleMatch = row.match(/href="\/torrent\/(\d+)\/[^"]*">([\s\S]*?)<\/a>/i);
    if (!magMatch || !titleMatch) continue;

    const infoHash = magMatch[1].trim().toLowerCase();
    const rutorId = titleMatch[1].trim();
    const rawTitle = decodeHtmlEntities(titleMatch[2].replace(/<[^>]+>/g, '').trim());
    if (!rawTitle || !/[а-яёА-ЯЁ]/i.test(rawTitle)) continue;

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

    const seedMatch = row.match(
      /<span class="green">[\s\S]*?(?:&nbsp;|\s*)(\d+)<\/span>/i
    );
    const seeders = seedMatch ? parseInt(seedMatch[1], 10) : 10;

    const yearMatch = rawTitle.match(/\((\d{4})(?:-\d{4})?\)/);
    const year = yearMatch ? yearMatch[1] : '2026';

    const isSeries =
      defaultType === 'series' ||
      /\[S\d+|\[\d+x\d+|\bсезон\b|\bсерии\b|\bвыпуск/i.test(rawTitle);

    const quality = /\b(2160p|4k|uhd)\b/i.test(rawTitle)
      ? '4K UHD'
      : /\b1080[pi]\b/i.test(rawTitle)
        ? '1080p Full HD'
        : /\b720p\b/i.test(rawTitle)
          ? '720p HD'
          : '480p SD';

    const cleanName = (preYearPart || rawTitle)
      .replace(/\s*\[.*?\]\s*/g, ' ')
      .replace(/\s*\[.*$/g, '')
      .replace(/\s*\(\d{4}.*$/g, '')
      .replace(/\s*\(.*$/g, '')
      .replace(/\s*\/.*$/g, '')
      .replace(/[.\s-]*Сезон\s*\d+\.?/gi, '')
      .replace(
        /\b(2160p|1080[pi]|720p|4K|UHD|WEB-?DLRip|WEB-?DL|WEBRip|BDRip|Blu-?Ray|HDTVRip|HDTV)\b.*$/i,
        ''
      )
      .replace(/\s+/g, ' ')
      .replace(/[\[\]().,\s-]+$/g, '')
      .trim();

    const synId = hashToSyntheticId(infoHash);
    results.push({
      id: synId,
      name: cleanName || rawTitle,
      releaseTitle: rawTitle,
      year,
      type: isSeries ? 'series' : 'movie',
      quality,
      sizeFormatted,
      seeders,
      infoHash,
      rutorId,
    });
  }

  return results;
}

async function getKinozalRussianCatalog({
  category = 'series_ru',
  years = '',
  query = '',
}) {
  const catIds = KINOZAL_RU_CATEGORIES[category] || [16];
  const getCatDefaultType = (c) => (c === 5 || c === 7 ? 'movie' : 'series');

  const urlTasks = [];
  if (query.trim().length >= 2) {
    for (const c of catIds) {
      urlTasks.push({
        url: `https://rutor.info/search/0/${c}/000/2/${encodeURIComponent(query.trim())}`,
        defType: getCatDefaultType(c),
      });
    }
  } else {
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
  }

  const pages = await Promise.all(
    urlTasks.map(async ({ url: u, defType }) => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(u, {
          headers: { 'User-Agent': USER_AGENT },
          signal: controller.signal,
        });
        if (!res.ok) return [];
        const html = await res.text();
        return parseKinozalRowsFromHtml(html, defType, true);
      } catch {
        return [];
      } finally {
        clearTimeout(t);
      }
    })
  );

  const byCleanTitle = new Map();
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

      const getKzQualScore = (q) =>
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
          categoryId: category,
          networkBadge: is4k ? 'Kinozal 4K' : 'Kinozal FHD',
        });
      } else {
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
          episodesCount:
            Math.max(existing.episodesCount || 0, episodesCount || 0) || undefined,
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

  return Array.from(byCleanTitle.values()).slice(0, 120);
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

  const path = event.path || '';
  const params = event.queryStringParameters || {};

  if (path.endsWith('/status')) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        username: DEFAULT_FL_CREDENTIALS.username,
        hasPasskey: true,
        activeTorrents: 0,
      }),
    };
  }

  if (path.endsWith('/kinozal-catalog')) {
    const items = await getKinozalRussianCatalog({
      category: params.category || 'series_ru',
      years: params.years || '',
      query: params.q || '',
    });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        username: DEFAULT_KINOZAL_USERNAME,
        items,
      }),
    };
  }

  if (path.endsWith('/catalog')) {
    const items = await getFileListCatalog({
      section: params.section || 'ro',
      query: params.q || '',
      imdb: params.imdb || '',
    });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        items,
      }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ ok: false, error: 'Local torrent engine required for P2P stream' }),
  };
}


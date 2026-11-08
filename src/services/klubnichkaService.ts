export interface FileListTorrentCard {
  id: number;
  name: string;
  releaseTitle: string;
  poster?: string;
  background?: string;
  sizeFormatted: string;
  seeders: number;
  freeleech?: boolean;
  isRo?: boolean;
  quality?: string;
  type?: 'movie' | 'series';
  imdbId?: string;
  year?: string;
  uploadDate?: string;
  imdbRating?: string;
  description?: string;
}

export type KlubnichkaCategoryId =
  | 'top_4k'
  | 'latest_hd'
  | 'most_popular'
  | 'top_rated'
  | 'uhd_2160p'
  | 'studio_premium'
  | 'sensual'
  | 'amateur'
  | 'russian_euro'
  | 'filelist_xxx';

export type KlubnichkaSortMode =
  | 'top-weekly'
  | 'latest'
  | 'most-popular'
  | 'top-rated'
  | 'longest';

export interface KlubnichkaVideoCard {
  id: string;
  rawVideoId: string;
  title: string;
  subtitle: string;
  poster: string;
  previewThumbs: string[];
  durationText: string;
  durationSec: number;
  views: number;
  viewsFormatted: string;
  rating: string;
  qualityBadge: string;
  addedDate: string;
  embedUrl: string;
  sourceKind: 'stream' | 'filelist_xxx';
  flTorrent?: FileListTorrentCard;
}

export interface KlubnichkaResolvedStream {
  ok: boolean;
  hlsUrl?: string;
  bestMp4Url?: string;
  qualityBadge: string;
  qualities: Array<{
    id: string;
    label: string;
    height: number;
    url: string;
  }>;
}

export const KLUBNICHKA_CATEGORIES: Array<{
  id: KlubnichkaCategoryId;
  labelRo: string;
  labelEn: string;
  labelRu: string;
  defaultQuery: string;
  defaultOrder: KlubnichkaSortMode;
}> = [
  {
    id: 'top_4k',
    labelRo: 'Top 4K & Full HD',
    labelEn: 'Top 4K & Full HD',
    labelRu: 'Топ 4K и Full HD',
    defaultQuery: '4k',
    defaultOrder: 'top-weekly',
  },
  {
    id: 'latest_hd',
    labelRo: 'Cele mai noi (HD)',
    labelEn: 'Latest Releases (HD)',
    labelRu: 'Новинки (HD)',
    defaultQuery: '1080p',
    defaultOrder: 'latest',
  },
  {
    id: 'most_popular',
    labelRo: 'Cele mai vizionate',
    labelEn: 'Most Viewed',
    labelRu: 'Популярные',
    defaultQuery: '1080p',
    defaultOrder: 'most-popular',
  },
  {
    id: 'top_rated',
    labelRo: 'Top Rating',
    labelEn: 'Top Rated',
    labelRu: 'Лучший рейтинг',
    defaultQuery: '4k',
    defaultOrder: 'top-rated',
  },
  {
    id: 'uhd_2160p',
    labelRo: '4K Ultra HD (2160p)',
    labelEn: '4K Ultra HD (2160p)',
    labelRu: '4K Ultra HD (2160p)',
    defaultQuery: '2160p',
    defaultOrder: 'top-weekly',
  },
  {
    id: 'studio_premium',
    labelRo: 'Studio VIP • Premium',
    labelEn: 'Studio VIP • Premium',
    labelRu: 'Студии VIP • Премиум',
    defaultQuery: 'vixen deeper tushy brazzers',
    defaultOrder: 'top-weekly',
  },
  {
    id: 'sensual',
    labelRo: 'Sensual & Romantic',
    labelEn: 'Sensual & Romantic',
    labelRu: 'Чувственное и Романтика',
    defaultQuery: 'sensual passionate couple',
    defaultOrder: 'top-weekly',
  },
  {
    id: 'amateur',
    labelRo: 'Amateur HD',
    labelEn: 'Amateur HD',
    labelRu: 'Любительское HD',
    defaultQuery: 'amateur homemade hd',
    defaultOrder: 'top-weekly',
  },
  {
    id: 'russian_euro',
    labelRo: 'Euro & RU',
    labelEn: 'Euro & RU',
    labelRu: 'Европа и RU',
    defaultQuery: 'russian european',
    defaultOrder: 'top-weekly',
  },
  {
    id: 'filelist_xxx',
    labelRo: 'FileList XXX (Torrente)',
    labelEn: 'FileList XXX (Torrents)',
    labelRu: 'FileList XXX (Торренты)',
    defaultQuery: '',
    defaultOrder: 'top-weekly',
  },
];

function cleanKlubnichkaTitle(raw: string): string {
  return String(raw || '')
    .replace(/â\x80\x93|â\x80\x94/g, '–')
    .replace(/â\x80\x99/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function formatViewsCount(views: number): string {
  if (!Number.isFinite(views) || views <= 0) return '0';
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${Math.round(views / 1_000)}K`;
  return String(views);
}

function inferVideoQualityBadge(title: string, keywords: string): string {
  const combined = `${title} ${keywords}`.toLowerCase();
  if (combined.includes('2160p') || combined.includes('4k') || combined.includes('uhd')) {
    return '4K UHD';
  }
  if (combined.includes('1440p') || combined.includes('2k')) {
    return '2K QHD';
  }
  if (combined.includes('60fps')) {
    return '1080p 60fps';
  }
  return '1080p Full HD';
}

async function fetchJsonWithProxyFallback(targetUrl: string, referer = 'https://www.eporner.com/'): Promise<any | null> {
  const isEpornerXhr = targetUrl.includes('/xhr/video/');
  if (!isEpornerXhr) {
    try {
      const directRes = await fetch(targetUrl);
      if (directRes.ok) {
        return await directRes.json();
      }
    } catch {
      // fallback to proxy
    }
  }
  try {
    const proxyRes = await fetch(
      `/api/tv-proxy?raw=1&url=${encodeURIComponent(targetUrl)}&ref=${encodeURIComponent(referer)}`
    );
    if (proxyRes.ok) {
      return await proxyRes.json();
    }
  } catch {
    // ignore
  }
  return null;
}

async function fetchTextWithProxyFallback(targetUrl: string, referer = 'https://www.eporner.com/'): Promise<string> {
  try {
    const proxyRes = await fetch(
      `/api/tv-proxy?raw=1&url=${encodeURIComponent(targetUrl)}&ref=${encodeURIComponent(referer)}`
    );
    if (proxyRes.ok) {
      return await proxyRes.text();
    }
  } catch {
    // fallback to direct
  }
  try {
    const directRes = await fetch(targetUrl);
    if (directRes.ok) {
      return await directRes.text();
    }
  } catch {
    // ignore
  }
  return '';
}

export async function fetchKlubnichkaCatalog(options: {
  category: KlubnichkaCategoryId;
  query?: string;
  sort?: KlubnichkaSortMode;
  page?: number;
}): Promise<{ items: KlubnichkaVideoCard[]; hasMore: boolean }> {
  const { category, query = '', sort, page = 1 } = options;
  const cleanQuery = query.trim();

  if (category === 'filelist_xxx') {
    const sortParam = sort === 'latest' ? 'latest' : 'seeders';
    const url = `/api/filelist/catalog?section=xxx&sort=${sortParam}&page=${page}${
      cleanQuery ? `&q=${encodeURIComponent(cleanQuery)}` : ''
    }`;
    const res = await fetch(url);
    if (!res.ok) return { items: [], hasMore: false };
    const data = await res.json();
    const list: FileListTorrentCard[] = Array.isArray(data?.items) ? data.items : [];
    const mapped: KlubnichkaVideoCard[] = list.map((tor) => ({
      id: `klub_fl_${tor.id}`,
      rawVideoId: String(tor.id),
      title: tor.name || tor.releaseTitle,
      subtitle: tor.releaseTitle,
      poster: tor.poster || '',
      previewThumbs: tor.poster ? [tor.poster] : [],
      durationText: tor.sizeFormatted,
      durationSec: 0,
      views: tor.seeders,
      viewsFormatted: `${tor.seeders} seeders`,
      rating: tor.freeleech ? 'FREELEECH' : 'VIP',
      qualityBadge: tor.quality || '1080p Full HD',
      addedDate: tor.uploadDate || tor.year || '2026',
      embedUrl: '',
      sourceKind: 'filelist_xxx',
      flTorrent: tor,
    }));
    return { items: mapped, hasMore: false };
  }

  const catDef =
    KLUBNICHKA_CATEGORIES.find((c) => c.id === category) ||
    KLUBNICHKA_CATEGORIES[0];
  const effectiveQuery = cleanQuery || catDef.defaultQuery || '4k';
  const effectiveOrder = sort || catDef.defaultOrder || 'top-weekly';

  const apiUrl = `https://www.eporner.com/api/v2/video/search/?query=${encodeURIComponent(
    effectiveQuery
  )}&per_page=36&page=${page}&thumbsize=big&order=${encodeURIComponent(
    effectiveOrder
  )}&gay=0&lq=0&format=json`;

  const data = await fetchJsonWithProxyFallback(apiUrl);
  const rawVideos: any[] = Array.isArray(data?.videos) ? data.videos : [];

  const items: KlubnichkaVideoCard[] = rawVideos
    .filter((v) => v && typeof v.id === 'string' && v.default_thumb?.src)
    .map((v) => {
      const title = cleanKlubnichkaTitle(v.title || 'Video HD');
      const rawKeywords = String(v.keywords || '')
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 2 && k.length < 28)
        .slice(0, 4)
        .join(' • ');
      const thumbs: string[] = Array.isArray(v.thumbs)
        ? v.thumbs.map((t: any) => String(t?.src || '')).filter(Boolean)
        : [];
      const viewsNum = Number(v.views || 0);

      return {
        id: `klub_${v.id}`,
        rawVideoId: v.id,
        title,
        subtitle: rawKeywords || 'Klubnichka 18+ • Full HD',
        poster: String(v.default_thumb.src),
        previewThumbs: thumbs.length > 0 ? thumbs : [String(v.default_thumb.src)],
        durationText: String(v.length_min || '15:00'),
        durationSec: Number(v.length_sec || 900),
        views: viewsNum,
        viewsFormatted: `${formatViewsCount(viewsNum)} viz.`,
        rating: String(v.rate || '4.50'),
        qualityBadge: inferVideoQualityBadge(title, String(v.keywords || '')),
        addedDate: String(v.added || '').split(' ')[0] || '2026',
        embedUrl: String(v.embed || `https://www.eporner.com/embed/${v.id}/`),
        sourceKind: 'stream',
      };
    });

  const totalPages = Number(data?.total_pages || 1);
  return {
    items,
    hasMore: page < totalPages && items.length > 0,
  };
}

function decodeKlubnichkaHash(hex32: string): string {
  const toBase36 = (hexPart: string) => parseInt(hexPart, 16).toString(36);
  return (
    toBase36(hex32.substring(0, 8)) +
    toBase36(hex32.substring(8, 16)) +
    toBase36(hex32.substring(16, 24)) +
    toBase36(hex32.substring(24, 32))
  );
}

const streamCacheByVideoId = new Map<string, KlubnichkaResolvedStream>();

export async function resolveKlubnichkaDirectStream(
  rawVideoId: string
): Promise<KlubnichkaResolvedStream> {
  const cleanId = String(rawVideoId || '').replace(/^klub_/, '').trim();
  const cached = streamCacheByVideoId.get(cleanId);
  if (cached) return cached;

  const embedPageUrl = `https://www.eporner.com/embed/${encodeURIComponent(cleanId)}/`;
  const html = await fetchTextWithProxyFallback(embedPageUrl, 'https://www.eporner.com/');
  const hashMatch = html.match(/hash\s*[:=]\s*["']([a-f0-9]{32})["']/i);
  if (!hashMatch?.[1]) {
    return { ok: false, qualityBadge: 'HD', qualities: [] };
  }

  const unlockedHash = decodeKlubnichkaHash(hashMatch[1]);
  const xhrUrl = `https://www.eporner.com/xhr/video/${encodeURIComponent(
    cleanId
  )}?hash=${encodeURIComponent(
    unlockedHash
  )}&domain=www.eporner.com&fallback=false&embed=true&supportedFormats=mp4`;

  const xhrData = await fetchJsonWithProxyFallback(xhrUrl, embedPageUrl);
  if (!xhrData || typeof xhrData !== 'object') {
    return { ok: false, qualityBadge: 'HD', qualities: [] };
  }

  const mp4Map = xhrData.sources?.mp4 || {};
  const qualities: Array<{
    id: string;
    label: string;
    height: number;
    url: string;
  }> = [];

  for (const [labelKey, val] of Object.entries(mp4Map)) {
    const src = (val as any)?.src;
    if (typeof src !== 'string' || !src.startsWith('http')) continue;
    const hMatch = labelKey.match(/(\d{3,4})p/i);
    const height = hMatch ? Number(hMatch[1]) : 720;
    qualities.push({
      id: `mp4_${height}p`,
      label: labelKey,
      height,
      url: src,
    });
  }

  qualities.sort((a, b) => b.height - a.height);
  // Default to 1080p Full HD (or 720p HD) for universal hardware H.264 decoding across all TVs/browsers,
  // while keeping 2160p 4K / 1440p 2K selectable in qualities
  const preferredMp4 =
    qualities.find((q) => q.height === 1080) ||
    qualities.find((q) => q.height === 720) ||
    qualities[0];
  const topHeight = qualities[0]?.height || preferredMp4?.height || 1080;
  const qualityBadge =
    topHeight >= 2160
      ? '4K UHD • 2160p'
      : topHeight >= 1440
        ? '2K QHD • 1440p'
        : topHeight >= 1080
          ? '1080p Full HD'
          : '720p HD';

  const resolved: KlubnichkaResolvedStream = {
    ok: Boolean(preferredMp4?.url),
    hlsUrl: preferredMp4?.url,
    bestMp4Url: preferredMp4?.url,
    qualityBadge,
    qualities,
  };

  if (resolved.ok) {
    streamCacheByVideoId.set(cleanId, resolved);
  }
  return resolved;
}

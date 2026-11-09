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

export type KlubnichkaSourceId =
  | 'all'
  | 'eporner'
  | 'xvideos'
  | 'xnxx'
  | 'filelist_xxx';

export type KlubnichkaCategoryId =
  | 'top_4k'
  | 'latest_hd'
  | 'most_popular'
  | 'top_rated'
  | 'uhd_2160p'
  | 'fps_60'
  | 'studio_premium'
  | 'russian_euro'
  | 'milf_mature'
  | 'teen_18'
  | 'anal_hd'
  | 'lesbian_hd'
  | 'massage_spa'
  | 'sensual'
  | 'amateur'
  | 'big_tits_ass'
  | 'threesome_orgy'
  | 'cosplay_vr'
  | 'long_movies'
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
  providerBadge?: string;
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

export const KLUBNICHKA_SOURCES: Array<{
  id: KlubnichkaSourceId;
  labelRo: string;
  labelEn: string;
  labelRu: string;
}> = [
  {
    id: 'all',
    labelRo: 'Toate Sursele (Mix 4K & HD)',
    labelEn: 'All Sources (4K & HD Mix)',
    labelRu: 'Все источники (Микс 4K и HD)',
  },
  {
    id: 'eporner',
    labelRo: 'Sursa 1 • Eporner 4K / 60fps',
    labelEn: 'Source 1 • Eporner 4K / 60fps',
    labelRu: 'Источник 1 • Eporner 4K / 60fps',
  },
  {
    id: 'xvideos',
    labelRo: 'Sursa 2 • XVideos 1440p / 1080p',
    labelEn: 'Source 2 • XVideos 1440p / 1080p',
    labelRu: 'Источник 2 • XVideos 1440p / 1080p',
  },
  {
    id: 'xnxx',
    labelRo: 'Sursa 3 • XNXX Gold Studio HD',
    labelEn: 'Source 3 • XNXX Gold Studio HD',
    labelRu: 'Источник 3 • XNXX Gold Studio HD',
  },
  {
    id: 'filelist_xxx',
    labelRo: 'Sursa 4 • FileList VIP XXX',
    labelEn: 'Source 4 • FileList VIP XXX',
    labelRu: 'Источник 4 • FileList VIP XXX',
  },
];

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
    defaultQuery: '4k 1080p',
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
    defaultQuery: '1080p hd',
    defaultOrder: 'most-popular',
  },
  {
    id: 'top_rated',
    labelRo: 'Top Rating',
    labelEn: 'Top Rated',
    labelRu: 'Лучший рейтинг',
    defaultQuery: '4k full hd',
    defaultOrder: 'top-rated',
  },
  {
    id: 'uhd_2160p',
    labelRo: '4K Ultra HD (2160p)',
    labelEn: '4K Ultra HD (2160p)',
    labelRu: '4K Ultra HD (2160p)',
    defaultQuery: '2160p 4k',
    defaultOrder: 'top-weekly',
  },
  {
    id: 'fps_60',
    labelRo: '60 FPS Smooth HD',
    labelEn: '60 FPS Smooth HD',
    labelRu: '60 FPS Плавное HD',
    defaultQuery: '60fps 1080p',
    defaultOrder: 'top-weekly',
  },
  {
    id: 'studio_premium',
    labelRo: 'Studio VIP (Vixen, Tushy, Brazzers)',
    labelEn: 'Studio VIP (Vixen, Tushy, Brazzers)',
    labelRu: 'Студии VIP (Vixen, Tushy, Brazzers)',
    defaultQuery: 'vixen deeper tushy brazzers blacked',
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
    id: 'milf_mature',
    labelRo: 'MILF & Mature HD',
    labelEn: 'MILF & Mature HD',
    labelRu: 'MILF и Зрелые HD',
    defaultQuery: 'milf stepmom mature hd',
    defaultOrder: 'top-weekly',
  },
  {
    id: 'teen_18',
    labelRo: 'Young 18+ HD',
    labelEn: 'Young 18+ HD',
    labelRu: 'Молодые 18+ HD',
    defaultQuery: 'young petite 18 hd',
    defaultOrder: 'top-weekly',
  },
  {
    id: 'anal_hd',
    labelRo: 'Anal 4K & HD',
    labelEn: 'Anal 4K & HD',
    labelRu: 'Анал 4K и HD',
    defaultQuery: 'anal tushy 4k hd',
    defaultOrder: 'top-weekly',
  },
  {
    id: 'lesbian_hd',
    labelRo: 'Lesbian & Girls HD',
    labelEn: 'Lesbian & Girls HD',
    labelRu: 'Лесби и Девушки HD',
    defaultQuery: 'lesbian girls sensual hd',
    defaultOrder: 'top-weekly',
  },
  {
    id: 'massage_spa',
    labelRo: 'Massage & Oil HD',
    labelEn: 'Massage & Oil HD',
    labelRu: 'Массаж и Масло HD',
    defaultQuery: 'massage oil nuru hd',
    defaultOrder: 'top-weekly',
  },
  {
    id: 'sensual',
    labelRo: 'Sensual & Romantic',
    labelEn: 'Sensual & Romantic',
    labelRu: 'Чувственное и Романтика',
    defaultQuery: 'sensual passionate romantic couple',
    defaultOrder: 'top-weekly',
  },
  {
    id: 'amateur',
    labelRo: 'Amateur & Homemade HD',
    labelEn: 'Amateur & Homemade HD',
    labelRu: 'Любительское и Домашнее HD',
    defaultQuery: 'amateur homemade real couple hd',
    defaultOrder: 'top-weekly',
  },
  {
    id: 'big_tits_ass',
    labelRo: 'Busty & Curvy HD',
    labelEn: 'Busty & Curvy HD',
    labelRu: 'Пышные формы HD',
    defaultQuery: 'busty big tits big ass hd',
    defaultOrder: 'top-weekly',
  },
  {
    id: 'threesome_orgy',
    labelRo: 'Threesome & Party HD',
    labelEn: 'Threesome & Party HD',
    labelRu: 'Тройничок и Вечеринки HD',
    defaultQuery: 'threesome ffm party hd',
    defaultOrder: 'top-weekly',
  },
  {
    id: 'cosplay_vr',
    labelRo: 'Cosplay & Fantasy HD',
    labelEn: 'Cosplay & Fantasy HD',
    labelRu: 'Косплей и Фантазии HD',
    defaultQuery: 'cosplay uniform roleplay hd',
    defaultOrder: 'top-weekly',
  },
  {
    id: 'long_movies',
    labelRo: 'Filme Complete (Full Movies)',
    labelEn: 'Full Length Movies',
    labelRu: 'Полнометражные фильмы',
    defaultQuery: 'full movie feature film hd',
    defaultOrder: 'longest',
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

function decodeHtmlEntities(str: string): string {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function cleanKlubnichkaTitle(raw: string): string {
  return decodeHtmlEntities(raw)
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

function inferVideoQualityBadge(title: string, keywords: string, fallback = '1080p Full HD'): string {
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
  if (combined.includes('1080p')) {
    return '1080p Full HD';
  }
  if (combined.includes('720p')) {
    return '720p HD';
  }
  return fallback;
}

function buildCdnPreviewThumbs(posterUrl: string): string[] {
  if (!posterUrl) return [];
  // XVideos / XNXX thumbs end with /xv_30_t.jpg or /xn_27_t.jpg -> generate frames 3, 8, 13, 18, 23, 28
  const m = posterUrl.match(/^(https?:\/\/.+\/)(xv|xn)_(\d+)_t\.jpg$/i);
  if (m) {
    const prefix = m[1];
    const kind = m[2];
    return [3, 8, 13, 18, 23, 27].map((idx) => `${prefix}${kind}_${idx}_t.jpg`);
  }
  return [posterUrl];
}

async function fetchJsonWithProxyFallback(
  targetUrl: string,
  referer = 'https://www.eporner.com/'
): Promise<any | null> {
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

async function fetchTextWithProxyFallback(
  targetUrl: string,
  referer = 'https://www.eporner.com/'
): Promise<string> {
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

async function fetchFileListXxxSource(
  cleanQuery: string,
  sort: KlubnichkaSortMode | undefined,
  page: number
): Promise<{ items: KlubnichkaVideoCard[]; hasMore: boolean }> {
  try {
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
      subtitle: `FileList VIP • ${tor.releaseTitle}`,
      poster: tor.poster || '',
      previewThumbs: tor.poster ? [tor.poster] : [],
      durationText: tor.sizeFormatted,
      durationSec: 0,
      views: tor.seeders,
      viewsFormatted: `${tor.seeders} seeders`,
      rating: tor.freeleech ? 'FREELEECH' : 'VIP',
      qualityBadge: tor.quality || '1080p Full HD',
      providerBadge: 'FileList XXX',
      addedDate: tor.uploadDate || tor.year || '2026',
      embedUrl: '',
      sourceKind: 'filelist_xxx',
      flTorrent: tor,
    }));
    return { items: mapped, hasMore: false };
  } catch {
    return { items: [], hasMore: false };
  }
}

async function fetchEpornerSource(
  effectiveQuery: string,
  effectiveOrder: KlubnichkaSortMode,
  page: number,
  perPage = 48
): Promise<{ items: KlubnichkaVideoCard[]; hasMore: boolean }> {
  try {
    const apiUrl = `https://www.eporner.com/api/v2/video/search/?query=${encodeURIComponent(
      effectiveQuery
    )}&per_page=${perPage}&page=${page}&thumbsize=big&order=${encodeURIComponent(
      effectiveOrder
    )}&gay=0&lq=0&format=json`;

    const data = await fetchJsonWithProxyFallback(apiUrl, 'https://www.eporner.com/');
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
          id: `klub_ep_${v.id}`,
          rawVideoId: `ep_${v.id}`,
          title,
          subtitle: rawKeywords ? `Eporner 4K • ${rawKeywords}` : 'Eporner 4K • Direct MP4',
          poster: String(v.default_thumb.src),
          previewThumbs: thumbs.length > 0 ? thumbs : [String(v.default_thumb.src)],
          durationText: String(v.length_min || '15:00'),
          durationSec: Number(v.length_sec || 900),
          views: viewsNum,
          viewsFormatted: `${formatViewsCount(viewsNum)} viz.`,
          rating: String(v.rate || '4.60'),
          qualityBadge: inferVideoQualityBadge(title, String(v.keywords || '')),
          providerBadge: 'Eporner 4K',
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
  } catch {
    return { items: [], hasMore: false };
  }
}

async function fetchXVideosSource(
  effectiveQuery: string,
  effectiveOrder: KlubnichkaSortMode,
  page: number
): Promise<{ items: KlubnichkaVideoCard[]; hasMore: boolean }> {
  try {
    const xvSort =
      effectiveOrder === 'latest'
        ? 'uploaddate'
        : effectiveOrder === 'most-popular'
          ? 'views'
          : effectiveOrder === 'longest'
            ? 'length'
            : 'rating';
    const xvPage = Math.max(0, page - 1);
    const searchUrl = `https://www.xvideos.com/?k=${encodeURIComponent(
      effectiveQuery
    )}&sort=${xvSort}&quality=hd${xvPage > 0 ? `&p=${xvPage}` : ''}`;

    const html = await fetchTextWithProxyFallback(searchUrl, 'https://www.xvideos.com/');
    if (!html) return { items: [], hasMore: false };

    const blocks = html.split(/<div id="video_/i).slice(1);
    const items: KlubnichkaVideoCard[] = [];

    for (const b of blocks) {
      const idMatch = b.match(/data-id="(\d+)"/i);
      const srcMatch = b.match(/data-src="([^"]+)"/i);
      const titleMatch =
        b.match(/class="title"[^>]*>\s*<a[^>]*title="([^"]+)"/i) ||
        b.match(/title="([^"]+)"/i);
      if (!idMatch?.[1] || !srcMatch?.[1] || !titleMatch?.[1]) continue;

      const vidId = idMatch[1];
      const poster = srcMatch[1];
      const title = cleanKlubnichkaTitle(titleMatch[1]);
      const durText = (b.match(/<span class="duration">([^<]+)<\/span>/i)?.[1] || '14 min').trim();
      const hdMark = (b.match(/<span class="video-hd-mark">([^<]+)<\/span>/i)?.[1] || '1080p').trim();
      const channelName = cleanKlubnichkaTitle(
        b.match(/<span class="name">([^<]+)<\/span>/i)?.[1] || 'XVideos Studio'
      );
      const viewsRaw = (
        b.match(/([\d.,]+[kKmM]?)\s*<span class="sprfluous">Views/i)?.[1] || '250K'
      ).toUpperCase();

      items.push({
        id: `klub_xv_${vidId}`,
        rawVideoId: `xv_${vidId}`,
        title,
        subtitle: `XVideos HD • ${channelName}`,
        poster,
        previewThumbs: buildCdnPreviewThumbs(poster),
        durationText: durText,
        durationSec: 840,
        views: 250000,
        viewsFormatted: `${viewsRaw} viz.`,
        rating: hdMark === '1440p' || hdMark === '2160p' || hdMark === '4K' ? '4.85' : '4.65',
        qualityBadge: inferVideoQualityBadge(title, hdMark, `${hdMark} Full HD`),
        providerBadge: 'XVideos HD',
        addedDate: '2026',
        embedUrl: `https://www.xvideos.com/embedframe/${vidId}`,
        sourceKind: 'stream',
      });
    }

    return {
      items,
      hasMore: items.length >= 12,
    };
  } catch {
    return { items: [], hasMore: false };
  }
}

async function fetchXnxxSource(
  effectiveQuery: string,
  effectiveOrder: KlubnichkaSortMode,
  page: number
): Promise<{ items: KlubnichkaVideoCard[]; hasMore: boolean }> {
  try {
    const xnPage = Math.max(0, page - 1);
    const slugQuery = encodeURIComponent(effectiveQuery.trim().replace(/\s+/g, '+'));
    const searchUrl =
      xnPage > 0
        ? `https://www.xnxx.com/search/hd-only/${slugQuery}/${xnPage}`
        : `https://www.xnxx.com/search/hd-only/${slugQuery}`;

    const html = await fetchTextWithProxyFallback(searchUrl, 'https://www.xnxx.com/');
    if (!html) return { items: [], hasMore: false };

    const blocks = html.split(/<div id="video_/i).slice(1);
    const items: KlubnichkaVideoCard[] = [];

    for (const b of blocks) {
      const idMatch = b.match(/data-id="(\d+)"/i);
      const eidMatch = b.match(/data-eid="([^"]+)"/i);
      const srcMatch = b.match(/data-src="([^"]+)"/i);
      const titleMatch =
        b.match(/<div class="thumb-under">\s*<p>\s*<a[^>]*title="([^"]+)"/i) ||
        b.match(/title="([^"]+)"/i);
      if (!idMatch?.[1] || !srcMatch?.[1] || !titleMatch?.[1]) continue;

      const vidId = idMatch[1];
      const eid = eidMatch?.[1] || '';
      const poster = srcMatch[1];
      const title = cleanKlubnichkaTitle(titleMatch[1]);
      const channelName = cleanKlubnichkaTitle(
        b.match(/<span class="name">([^<]+)<\/span>/i)?.[1] || 'XNXX Gold Studio'
      );
      const viewsRaw = (
        b.match(/([\d.,]+[kKmM]?)\s*<span class="icon-f icf-eye">/i)?.[1] || '400K'
      ).toUpperCase();
      const durText = (
        b.match(/<\/span><\/span>\s*([0-9]+\s*min|[0-9]+\s*h\s*[0-9]*\s*min)/i)?.[1] ||
        '15 min'
      ).trim();
      const hdMark = (
        b.match(/<span class="video-hd">[\s\S]*?(\d{3,4}p)/i)?.[1] || '1080p'
      ).trim();

      items.push({
        id: `klub_xn_${vidId}`,
        rawVideoId: `xn_${vidId}_${eid}`,
        title,
        subtitle: `XNXX Gold • ${channelName}`,
        poster,
        previewThumbs: buildCdnPreviewThumbs(poster),
        durationText: durText,
        durationSec: 900,
        views: 400000,
        viewsFormatted: `${viewsRaw} viz.`,
        rating: '4.75',
        qualityBadge: inferVideoQualityBadge(title, hdMark, `${hdMark} Full HD`),
        providerBadge: 'XNXX Gold',
        addedDate: '2026',
        embedUrl: `https://www.xvideos.com/embedframe/${vidId}`,
        sourceKind: 'stream',
      });
    }

    return {
      items,
      hasMore: items.length >= 12,
    };
  } catch {
    return { items: [], hasMore: false };
  }
}

export async function fetchKlubnichkaCatalog(options: {
  category: KlubnichkaCategoryId;
  source?: KlubnichkaSourceId;
  query?: string;
  sort?: KlubnichkaSortMode;
  page?: number;
}): Promise<{ items: KlubnichkaVideoCard[]; hasMore: boolean }> {
  const { category, source = 'all', query = '', sort, page = 1 } = options;
  const cleanQuery = query.trim();

  if (category === 'filelist_xxx' || source === 'filelist_xxx') {
    return fetchFileListXxxSource(cleanQuery, sort, page);
  }

  const catDef =
    KLUBNICHKA_CATEGORIES.find((c) => c.id === category) ||
    KLUBNICHKA_CATEGORIES[0];
  const effectiveQuery = cleanQuery || catDef.defaultQuery || '4k';
  const effectiveOrder = sort || catDef.defaultOrder || 'top-weekly';

  if (source === 'eporner') {
    return fetchEpornerSource(effectiveQuery, effectiveOrder, page, 48);
  }
  if (source === 'xvideos') {
    return fetchXVideosSource(effectiveQuery, effectiveOrder, page);
  }
  if (source === 'xnxx') {
    return fetchXnxxSource(effectiveQuery, effectiveOrder, page);
  }

  // Default: 'all' -> Fetch Eporner 4K + XVideos HD + XNXX Gold in parallel and interleave
  const [epRes, xvRes, xnRes] = await Promise.all([
    fetchEpornerSource(effectiveQuery, effectiveOrder, page, 36),
    fetchXVideosSource(effectiveQuery, effectiveOrder, page),
    fetchXnxxSource(effectiveQuery, effectiveOrder, page),
  ]);

  const combined: KlubnichkaVideoCard[] = [];
  const seenTitles = new Set<string>();
  const maxLen = Math.max(
    epRes.items.length,
    xvRes.items.length,
    xnRes.items.length
  );

  for (let i = 0; i < maxLen; i++) {
    for (const list of [epRes.items, xvRes.items, xnRes.items]) {
      const item = list[i];
      if (!item) continue;
      const normTitle = item.title.toLowerCase().slice(0, 45);
      if (seenTitles.has(normTitle)) continue;
      seenTitles.add(normTitle);
      combined.push(item);
    }
  }

  return {
    items: combined,
    hasMore: epRes.hasMore || xvRes.hasMore || xnRes.hasMore,
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

function ensureNoReferrerMetaTag(): void {
  if (typeof document === 'undefined' || !document.head) return;
  let meta = document.head.querySelector<HTMLMetaElement>('meta[name="referrer"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'referrer';
    document.head.appendChild(meta);
  }
  if (meta.content !== 'no-referrer') {
    meta.content = 'no-referrer';
  }
}

async function resolveHlsEmbedDirectStream(
  rawKey: string,
  embedUrls: string[]
): Promise<KlubnichkaResolvedStream> {
  for (const embedUrl of embedUrls) {
    if (!embedUrl) continue;
    const html = await fetchTextWithProxyFallback(embedUrl, 'https://www.xvideos.com/');
    const hlsMatch = html.match(/setVideoHLS\(["']([^"']+)["']\)/i);
    const mp4HighMatch = html.match(/setVideoUrlHigh\(["']([^"']+)["']\)/i);
    const masterHlsUrl = hlsMatch?.[1] || '';

    if (masterHlsUrl) {
      const qualities: Array<{
        id: string;
        label: string;
        height: number;
        url: string;
      }> = [];

      try {
        const baseDir = masterHlsUrl.slice(0, masterHlsUrl.lastIndexOf('/') + 1);
        const masterTxt = await fetchTextWithProxyFallback(masterHlsUrl, 'https://www.xvideos.com/');
        const lines = masterTxt.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('#EXT-X-STREAM-INF:')) {
            const resMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
            const nameMatch = line.match(/NAME="([^"]+)"/i);
            const nextLine = (lines[i + 1] || '').trim();
            if (nextLine && !nextLine.startsWith('#')) {
              const height = resMatch
                ? Number(resMatch[1])
                : parseInt(nameMatch?.[1] || '1080', 10) || 1080;
              const subUrl = nextLine.startsWith('http')
                ? nextLine
                : `${baseDir}${nextLine}`;
              qualities.push({
                id: `hls_${height}p`,
                label:
                  height >= 2160
                    ? '2160p 4K UHD'
                    : height >= 1440
                      ? '1440p 2K QHD'
                      : height >= 1080
                        ? '1080p Full HD'
                        : `${height}p HD`,
                height,
                url: subUrl,
              });
            }
          }
        }
      } catch {
        // fallback to masterHlsUrl directly
      }

      qualities.sort((a, b) => b.height - a.height);
      const topQuality = qualities[0];
      const bestUrl = topQuality?.url || masterHlsUrl;
      const topHeight = topQuality?.height || 1080;
      const qualityBadge =
        topHeight >= 2160
          ? '4K UHD • 2160p'
          : topHeight >= 1440
            ? '2K QHD • 1440p'
            : topHeight >= 1080
              ? '1080p Full HD'
              : '720p HD';

      if (qualities.length === 0) {
        qualities.push({
          id: 'hls_auto',
          label: '1080p Full HD (Auto HLS)',
          height: 1080,
          url: masterHlsUrl,
        });
      }

      const resolved: KlubnichkaResolvedStream = {
        ok: true,
        hlsUrl: bestUrl,
        bestMp4Url: bestUrl,
        qualityBadge,
        qualities,
      };
      streamCacheByVideoId.set(rawKey, resolved);
      return resolved;
    }

    if (mp4HighMatch?.[1]) {
      const mp4Url = mp4HighMatch[1];
      const resolved: KlubnichkaResolvedStream = {
        ok: true,
        hlsUrl: mp4Url,
        bestMp4Url: mp4Url,
        qualityBadge: '720p HD',
        qualities: [
          {
            id: 'mp4_720p',
            label: '720p HD Direct MP4',
            height: 720,
            url: mp4Url,
          },
        ],
      };
      streamCacheByVideoId.set(rawKey, resolved);
      return resolved;
    }
  }

  return { ok: false, qualityBadge: 'HD', qualities: [] };
}

export async function resolveKlubnichkaDirectStream(
  rawVideoId: string
): Promise<KlubnichkaResolvedStream> {
  ensureNoReferrerMetaTag();
  const cleanRaw = String(rawVideoId || '').replace(/^klub_/, '').trim();
  const cached = streamCacheByVideoId.get(cleanRaw);
  if (cached) return cached;

  // Source 2: XVideos HD / 1440p / 1080p Direct HLS
  if (cleanRaw.startsWith('xv_')) {
    const xvId = cleanRaw.replace(/^xv_/, '');
    return resolveHlsEmbedDirectStream(cleanRaw, [
      `https://www.xvideos.com/embedframe/${encodeURIComponent(xvId)}`,
    ]);
  }

  // Source 3: XNXX Gold Studio HD Direct HLS
  if (cleanRaw.startsWith('xn_')) {
    const parts = cleanRaw.replace(/^xn_/, '').split('_');
    const xvId = parts[0] || '';
    const eid = parts[1] || '';
    return resolveHlsEmbedDirectStream(cleanRaw, [
      xvId ? `https://www.xvideos.com/embedframe/${encodeURIComponent(xvId)}` : '',
      eid ? `https://www.xnxx.com/video-${encodeURIComponent(eid)}/_` : '',
    ]);
  }

  // Source 1: Eporner 4K / 60fps Direct MP4
  const cleanId = cleanRaw.replace(/^ep_/, '');
  const embedPageUrl = `https://www.eporner.com/embed/${encodeURIComponent(cleanId)}/`;
  const html = await fetchTextWithProxyFallback(embedPageUrl, 'https://www.eporner.com/');
  const hashMatch =
    html.match(/player\.hash\s*=\s*["']([a-f0-9]{32})["']/i) ||
    html.match(/\bhash\s*[:=]\s*["']([a-f0-9]{32})["']/i);
  if (!hashMatch?.[1]) {
    return { ok: false, qualityBadge: 'HD', qualities: [] };
  }

  const vidMatch =
    html.match(/player\.vid\s*=\s*["']([^"']+)["']/i) ||
    html.match(/\bvid\s*[:=]\s*["']([^"'/]+)["']/i);
  const effectiveVid = vidMatch?.[1] || cleanId;

  const unlockedHash = decodeKlubnichkaHash(hashMatch[1]);
  const xhrUrl = `https://www.eporner.com/xhr/video/${encodeURIComponent(
    effectiveVid
  )}?hash=${encodeURIComponent(
    unlockedHash
  )}&domain=www.eporner.com&fallback=false&embed=false&supportedFormats=mp4`;

  let xhrData = await fetchJsonWithProxyFallback(xhrUrl, 'https://www.eporner.com/');
  if (!xhrData || typeof xhrData !== 'object' || !xhrData.sources?.mp4) {
    const fallbackXhrUrl = `https://www.eporner.com/xhr/video/${encodeURIComponent(
      effectiveVid
    )}?hash=${encodeURIComponent(
      unlockedHash
    )}&domain=www.eporner.com&fallback=false&embed=true&supportedFormats=mp4`;
    xhrData = await fetchJsonWithProxyFallback(fallbackXhrUrl, embedPageUrl);
  }
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
    const rawSrc = (val as any)?.src;
    if (typeof rawSrc !== 'string' || !rawSrc.startsWith('http')) continue;
    const src = `${rawSrc}${rawSrc.includes('?') ? '&' : '?'}nr=1`;
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
    streamCacheByVideoId.set(cleanRaw, resolved);
  }
  return resolved;
}

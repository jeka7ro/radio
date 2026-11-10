import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Play,
  Heart,
  Clock,
  Sparkles,
  Check,
  Plus,
  Tv,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  CinemetaItem,
  SeriesEpisode,
  TvSectionId,
  TvUiLang,
  VodWatchProgressEntry,
  formatWatchSeconds,
} from '../../views/smartTvLampaHelpers';

export interface CalendarEpisodeItem {
  id: string;
  series: CinemetaItem;
  imdbId: string;
  season: number;
  episode: number;
  title: string;
  overview?: string;
  releasedIso?: string;
  releaseTs: number | null;
  thumbnail: string;
  isFavoriteSeries: boolean;
  isUpcoming: boolean;
  isReleasedToday: boolean;
  isRecent: boolean;
  watchedPct: number;
  currentTimeSec: number;
  durationSec: number;
  isWatched: boolean;
}

interface CachedSeriesCalendarMeta {
  imdbId: string;
  name: string;
  poster?: string;
  background?: string;
  episodes: SeriesEpisode[];
  fetchedAt: number;
}

const SERIES_CALENDAR_CACHE: Record<string, CachedSeriesCalendarMeta> = {};

// Popular series suggestions so users can 1-click add favorite series to populate their Calendar
const POPULAR_FAVORITE_SERIES_SUGGESTIONS: CinemetaItem[] = [
  {
    id: 'tt31510819',
    type: 'series',
    name: 'MobLand',
    releaseInfo: '2025–',
    imdbRating: '8.4',
    poster: 'https://images.metahub.space/poster/medium/tt31510819/img',
    background: 'https://images.metahub.space/background/medium/tt31510819/img',
  },
  {
    id: 'tt3581920',
    type: 'series',
    name: 'The Last of Us',
    releaseInfo: '2023–',
    imdbRating: '8.7',
    poster: 'https://images.metahub.space/poster/medium/tt3581920/img',
    background: 'https://images.metahub.space/background/medium/tt3581920/img',
  },
  {
    id: 'tt11280740',
    type: 'series',
    name: 'Severance',
    releaseInfo: '2022–',
    imdbRating: '8.7',
    poster: 'https://images.metahub.space/poster/medium/tt11280740/img',
    background: 'https://images.metahub.space/background/medium/tt11280740/img',
  },
  {
    id: 'tt13406094',
    type: 'series',
    name: 'The White Lotus',
    releaseInfo: '2021–',
    imdbRating: '8.0',
    poster: 'https://images.metahub.space/poster/medium/tt13406094/img',
    background: 'https://images.metahub.space/background/medium/tt13406094/img',
  },
  {
    id: 'tt9288030',
    type: 'series',
    name: 'Reacher',
    releaseInfo: '2022–',
    imdbRating: '8.0',
    poster: 'https://images.metahub.space/poster/medium/tt9288030/img',
    background: 'https://images.metahub.space/background/medium/tt9288030/img',
  },
  {
    id: 'tt20245448',
    type: 'series',
    name: 'Daredevil: Born Again',
    releaseInfo: '2025–',
    imdbRating: '8.6',
    poster: 'https://images.metahub.space/poster/medium/tt20245448/img',
    background: 'https://images.metahub.space/background/medium/tt20245448/img',
  },
  {
    id: 'tt9253284',
    type: 'series',
    name: 'Andor',
    releaseInfo: '2022–',
    imdbRating: '8.4',
    poster: 'https://images.metahub.space/poster/medium/tt9253284/img',
    background: 'https://images.metahub.space/background/medium/tt9253284/img',
  },
  {
    id: 'tt2085059',
    type: 'series',
    name: 'Black Mirror',
    releaseInfo: '2011–',
    imdbRating: '8.7',
    poster: 'https://images.metahub.space/poster/medium/tt2085059/img',
    background: 'https://images.metahub.space/background/medium/tt2085059/img',
  },
  {
    id: 'tt14688458',
    type: 'series',
    name: 'Silo',
    releaseInfo: '2023–',
    imdbRating: '8.1',
    poster: 'https://images.metahub.space/poster/medium/tt14688458/img',
    background: 'https://images.metahub.space/background/medium/tt14688458/img',
  },
  {
    id: 'tt9813792',
    type: 'series',
    name: 'From',
    releaseInfo: '2022–',
    imdbRating: '7.8',
    poster: 'https://images.metahub.space/poster/medium/tt9813792/img',
    background: 'https://images.metahub.space/background/medium/tt9813792/img',
  },
  {
    id: 'tt4574334',
    type: 'series',
    name: 'Stranger Things',
    releaseInfo: '2016–2025',
    imdbRating: '8.7',
    poster: 'https://images.metahub.space/poster/medium/tt4574334/img',
    background: 'https://images.metahub.space/background/medium/tt4574334/img',
  },
  {
    id: 'tt11198330',
    type: 'series',
    name: 'House of the Dragon',
    releaseInfo: '2022–',
    imdbRating: '8.4',
    poster: 'https://images.metahub.space/poster/medium/tt11198330/img',
    background: 'https://images.metahub.space/background/medium/tt11198330/img',
  },
];

async function fetchSeriesEpisodesMeta(
  series: CinemetaItem
): Promise<CachedSeriesCalendarMeta | null> {
  const existing = SERIES_CALENDAR_CACHE[series.id];
  if (existing && Date.now() - existing.fetchedAt < 1000 * 60 * 30) {
    return existing;
  }

  let imdbId = series.id.startsWith('tt') ? series.id : '';
  if (!imdbId) {
    const kpId =
      series.kpId ||
      (series.id.startsWith('kp_') ? series.id.replace(/^kp_/, '') : '');
    if (kpId) {
      try {
        const kpRes = await fetch(
          `https://kinopoiskapiunofficial.tech/api/v2.2/films/${kpId}`,
          {
            headers: {
              'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
            },
          }
        );
        if (kpRes.ok) {
          const kpData = await kpRes.json();
          if (
            typeof kpData?.imdbId === 'string' &&
            kpData.imdbId.startsWith('tt')
          ) {
            imdbId = kpData.imdbId;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  if (!imdbId && series.name) {
    try {
      const cleanName = series.name
        .replace(/\s*\(S\d+[^)]*\)\s*/gi, '')
        .trim();
      const searchRes = await fetch(
        `https://v3-cinemeta.strem.io/catalog/series/top/search=${encodeURIComponent(
          cleanName
        )}.json`
      );
      if (searchRes.ok) {
        const sData = await searchRes.json();
        const firstTt = sData?.metas?.find(
          (m: any) => typeof m?.id === 'string' && m.id.startsWith('tt')
        );
        if (firstTt?.id) {
          imdbId = String(firstTt.id);
        }
      }
    } catch {
      // ignore
    }
  }

  if (!imdbId) return null;

  try {
    const res = await fetch(
      `https://v3-cinemeta.strem.io/meta/series/${imdbId}.json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.meta;
    if (!meta || !Array.isArray(meta.videos)) return null;

    const validEpisodes: SeriesEpisode[] = meta.videos
      .map((v: any) => ({
        id: String(v.id || `${imdbId}:${v.season}:${v.episode ?? v.number}`),
        name: String(
          v.name || v.title || `Episodul ${v.episode ?? v.number ?? 1}`
        ),
        season: Number(v.season ?? 0),
        episode: Number(v.episode ?? v.number ?? 0),
        released: v.released || v.firstAired || undefined,
        firstAired: v.firstAired || v.released || undefined,
        overview: v.overview || v.description || undefined,
        thumbnail: v.thumbnail || undefined,
      }))
      .filter((ep: SeriesEpisode) => ep.season > 0 && ep.episode > 0)
      .sort((a: SeriesEpisode, b: SeriesEpisode) =>
        a.season !== b.season ? a.season - b.season : a.episode - b.episode
      );

    const cached: CachedSeriesCalendarMeta = {
      imdbId,
      name: meta.name || series.name,
      poster:
        meta.poster ||
        series.poster ||
        `https://images.metahub.space/poster/medium/${imdbId}/img`,
      background:
        meta.background ||
        series.background ||
        `https://images.metahub.space/background/medium/${imdbId}/img`,
      episodes: validEpisodes,
      fetchedAt: Date.now(),
    };
    SERIES_CALENDAR_CACHE[series.id] = cached;
    return cached;
  } catch {
    return null;
  }
}

interface SmartTvSeriesCalendarSectionProps {
  tr: (ro: string, en: string, ru: string) => string;
  uiLang: TvUiLang;
  activeProfileName: string;
  savedVodItems: CinemetaItem[];
  watchProgressMap: Record<string, VodWatchProgressEntry>;
  onOpenVodEpisode: (
    item: CinemetaItem,
    autoPlayImmediately: boolean,
    season: number,
    episode: number
  ) => void;
  onToggleSaveVodItem: (item: CinemetaItem) => void;
  onNavigateToSection: (section: TvSectionId) => void;
}

export const SmartTvSeriesCalendarSection: React.FC<
  SmartTvSeriesCalendarSectionProps
> = ({
  tr,
  uiLang,
  activeProfileName,
  savedVodItems,
  watchProgressMap,
  onOpenVodEpisode,
  onToggleSaveVodItem,
  onNavigateToSection,
}) => {
  const [sourceScope, setSourceScope] = useState<'favorites' | 'all'>(
    'favorites'
  );
  const [activeTab, setActiveTab] = useState<
    'all' | 'recent' | 'upcoming' | 'upnext'
  >('all');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('ALL');
  const [isLoadingMeta, setIsLoadingMeta] = useState<boolean>(false);
  const [seriesMetaMap, setSeriesMetaMap] = useState<
    Record<string, CachedSeriesCalendarMeta>
  >({});
  const [refreshTick, setRefreshTick] = useState<number>(0);

  // Favorite series from savedVodItems
  const favoriteSeriesList = useMemo(() => {
    const seen = new Set<string>();
    const list: CinemetaItem[] = [];
    for (const item of savedVodItems) {
      if (item && item.type === 'series' && !seen.has(item.id)) {
        seen.add(item.id);
        list.push(item);
      }
    }
    return list;
  }, [savedVodItems]);

  // Series from watch history
  const historySeriesList = useMemo(() => {
    const seen = new Set<string>();
    const list: CinemetaItem[] = [];
    const entries = Object.values(watchProgressMap)
      .filter((e) => e && e.item && e.item.type === 'series')
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    for (const entry of entries) {
      if (!seen.has(entry.item.id)) {
        seen.add(entry.item.id);
        list.push(entry.item);
      }
    }
    return list;
  }, [watchProgressMap]);

  // Combined tracked series based on scope (if user has 0 favorite series but has history series, include history automatically)
  const trackedSeriesList = useMemo(() => {
    const effectiveScope =
      favoriteSeriesList.length === 0 && historySeriesList.length > 0
        ? 'all'
        : sourceScope;

    if (effectiveScope === 'favorites') {
      return favoriteSeriesList;
    }

    const seen = new Set<string>();
    const combined: CinemetaItem[] = [];
    for (const s of [...favoriteSeriesList, ...historySeriesList]) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        combined.push(s);
      }
    }
    return combined;
  }, [favoriteSeriesList, historySeriesList, sourceScope]);

  // Reset selectedSeriesId if no longer in tracked list
  useEffect(() => {
    if (
      selectedSeriesId !== 'ALL' &&
      !trackedSeriesList.some((s) => s.id === selectedSeriesId)
    ) {
      setSelectedSeriesId('ALL');
    }
  }, [selectedSeriesId, trackedSeriesList]);

  // Fetch episode lists for all tracked series
  useEffect(() => {
    if (trackedSeriesList.length === 0) {
      setIsLoadingMeta(false);
      return;
    }

    let cancelled = false;
    const missing = trackedSeriesList.filter(
      (s) => !SERIES_CALENDAR_CACHE[s.id]
    );
    if (missing.length > 0 || refreshTick > 0) {
      setIsLoadingMeta(true);
    }

    const loadAll = async () => {
      const results: Record<string, CachedSeriesCalendarMeta> = {};
      const batchSize = 5;
      for (let i = 0; i < trackedSeriesList.length; i += batchSize) {
        if (cancelled) return;
        const batch = trackedSeriesList.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (s) => {
            const meta = await fetchSeriesEpisodesMeta(s);
            if (meta) {
              results[s.id] = meta;
            }
          })
        );
      }
      if (!cancelled) {
        setSeriesMetaMap((prev) => ({ ...prev, ...results }));
        setIsLoadingMeta(false);
      }
    };

    void loadAll();
    return () => {
      cancelled = true;
    };
  }, [trackedSeriesList, refreshTick]);

  const formatReleaseDateLabel = useCallback(
    (releaseTs: number | null, isUpcoming: boolean, isToday: boolean) => {
      if (!releaseTs) {
        return tr('Disponibil', 'Available', 'Доступно');
      }
      if (isToday) {
        return tr('APĂRUT AZI', 'OUT TODAY', 'СЕГОДНЯ');
      }
      const now = new Date();
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      ).getTime();
      const targetDay = new Date(releaseTs);
      const startOfTarget = new Date(
        targetDay.getFullYear(),
        targetDay.getMonth(),
        targetDay.getDate()
      ).getTime();
      const diffDays = Math.round(
        (startOfTarget - startOfToday) / (1000 * 60 * 60 * 24)
      );

      const locale =
        uiLang === 'ru' ? 'ru-RU' : uiLang === 'en' ? 'en-US' : 'ro-RO';
      const dateFormatted = targetDay.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year:
          targetDay.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });

      if (isUpcoming) {
        if (diffDays === 1) {
          return `${tr('MÂINE', 'TOMORROW', 'ЗАВТРА')} • ${dateFormatted}`;
        }
        if (diffDays > 1 && diffDays <= 14) {
          return `${tr(
            `Peste ${diffDays} zile`,
            `In ${diffDays} days`,
            `Через ${diffDays} дн.`
          )} • ${dateFormatted}`;
        }
        return `${tr('În curând', 'Upcoming', 'Скоро')} • ${dateFormatted}`;
      }

      if (diffDays === -1) {
        return `${tr('Ieri', 'Yesterday', 'Вчера')} • ${dateFormatted}`;
      }
      if (diffDays < -1 && diffDays >= -14) {
        const ago = Math.abs(diffDays);
        return `${tr(
          `Acum ${ago} zile`,
          `${ago}d ago`,
          `${ago} дн. назад`
        )} • ${dateFormatted}`;
      }
      return dateFormatted;
    },
    [tr, uiLang]
  );

  // Compute structured calendar lists:
  // 1) upcomingEpisodes (release date > today)
  // 2) recentNewEpisodes (released in last 90 days OR latest 3 aired episodes of each favorite series)
  // 3) upNextPerSeries (next unwatched or in-progress episode for each tracked series + latest aired info)
  const {
    upcomingEpisodes,
    recentNewEpisodes,
    upNextPerSeries,
    seriesSummaryBadges,
  } = useMemo(() => {
    const now = new Date();
    const startOfTodayTs = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    const endOfTodayTs = startOfTodayTs + 24 * 60 * 60 * 1000 - 1;
    const recentCutoffTs = startOfTodayTs - 90 * 24 * 60 * 60 * 1000;

    const upcoming: CalendarEpisodeItem[] = [];
    const recent: CalendarEpisodeItem[] = [];
    const upNext: Array<{
      series: CinemetaItem;
      nextEp: CalendarEpisodeItem;
      latestAiredEp: CalendarEpisodeItem | null;
      totalSeasons: number;
      totalEpisodes: number;
    }> = [];
    const summaryMap: Record<
      string,
      {
        latestLabel: string;
        hasNewRecent: boolean;
        hasUpcoming: boolean;
      }
    > = {};

    const favIdSet = new Set(favoriteSeriesList.map((s) => s.id));

    const buildEpisodeItem = (
      series: CinemetaItem,
      meta: CachedSeriesCalendarMeta,
      ep: SeriesEpisode
    ): CalendarEpisodeItem => {
      const parsedTs = ep.released ? Date.parse(ep.released) : NaN;
      const releaseTs = Number.isFinite(parsedTs) ? parsedTs : null;
      const isUpcoming = releaseTs !== null && releaseTs > endOfTodayTs;
      const isReleasedToday =
        releaseTs !== null &&
        releaseTs >= startOfTodayTs &&
        releaseTs <= endOfTodayTs;
      const isRecent =
        releaseTs !== null &&
        releaseTs >= recentCutoffTs &&
        releaseTs <= endOfTodayTs;

      const progEntry = watchProgressMap[series.id];
      const epKey = `S${ep.season}E${ep.episode}`;
      const epProg = progEntry?.episodeProgressMap?.[epKey];
      const curSec =
        epProg?.currentTime ??
        (progEntry?.season === ep.season && progEntry?.episode === ep.episode
          ? progEntry?.currentTime ?? 0
          : 0);
      const durSec =
        epProg?.duration ??
        (progEntry?.season === ep.season && progEntry?.episode === ep.episode
          ? progEntry?.duration ?? 0
          : 0);
      const watchedPct =
        durSec > 0
          ? Math.min(100, Math.round((curSec / durSec) * 100))
          : curSec > 60
            ? 25
            : 0;
      const isWatched = watchedPct >= 85;

      const thumbnail =
        ep.thumbnail ||
        `https://episodes.metahub.space/${meta.imdbId}/${ep.season}/${ep.episode}/w780.jpg`;

      return {
        id: `${series.id}_S${ep.season}E${ep.episode}`,
        series: {
          ...series,
          poster: series.poster || meta.poster,
          background: series.background || meta.background,
        },
        imdbId: meta.imdbId,
        season: ep.season,
        episode: ep.episode,
        title: ep.name || `Episodul ${ep.episode}`,
        overview: ep.overview,
        releasedIso: ep.released,
        releaseTs,
        thumbnail,
        isFavoriteSeries: favIdSet.has(series.id),
        isUpcoming,
        isReleasedToday,
        isRecent,
        watchedPct,
        currentTimeSec: curSec,
        durationSec: durSec,
        isWatched,
      };
    };

    const targetSeries =
      selectedSeriesId === 'ALL'
        ? trackedSeriesList
        : trackedSeriesList.filter((s) => s.id === selectedSeriesId);

    const seenRecentIds = new Set<string>();

    for (const series of targetSeries) {
      const meta = seriesMetaMap[series.id] || SERIES_CALENDAR_CACHE[series.id];
      if (!meta || meta.episodes.length === 0) continue;

      const allMapped = meta.episodes.map((ep) =>
        buildEpisodeItem(series, meta, ep)
      );

      // 1. Upcoming episodes for this series (take next 4 upcoming episodes per series so a single show doesn't flood)
      const seriesUpcoming = allMapped
        .filter((e) => e.isUpcoming)
        .sort((a, b) => (a.releaseTs || 0) - (b.releaseTs || 0));

      for (const uEp of seriesUpcoming.slice(0, 4)) {
        upcoming.push(uEp);
      }

      // 2. Aired episodes (releaseTs <= endOfTodayTs or null)
      const airedEps = allMapped.filter((e) => !e.isUpcoming);
      const latestAiredEp =
        airedEps.length > 0 ? airedEps[airedEps.length - 1] : null;

      // Include all episodes released in last 90 days + the latest 3 aired episodes of this series
      const recentForSeries = airedEps.filter((e) => e.isRecent);
      const latestThreeAired = airedEps.slice(-3);
      for (const rEp of [...recentForSeries, ...latestThreeAired]) {
        if (!seenRecentIds.has(rEp.id)) {
          seenRecentIds.add(rEp.id);
          recent.push(rEp);
        }
      }

      // 3. Determine Next Episode to Watch ("Up Next") for this series
      const prog = watchProgressMap[series.id];
      let nextToWatch: CalendarEpisodeItem | null = null;
      if (prog && prog.season && prog.episode) {
        const curIdx = airedEps.findIndex(
          (e) => e.season === prog.season && e.episode === prog.episode
        );
        if (curIdx >= 0) {
          const curEp = airedEps[curIdx];
          if (curEp.isWatched && airedEps[curIdx + 1]) {
            nextToWatch = airedEps[curIdx + 1];
          } else {
            nextToWatch = curEp;
          }
        }
      }
      if (!nextToWatch) {
        // Default to the latest aired episode if it's unwatched, or S1:E1
        nextToWatch = latestAiredEp || allMapped[0] || null;
      }

      const maxSeason = allMapped.reduce(
        (acc, e) => (e.season > acc ? e.season : acc),
        1
      );

      if (nextToWatch) {
        upNext.push({
          series: {
            ...series,
            poster: series.poster || meta.poster,
            background: series.background || meta.background,
          },
          nextEp: nextToWatch,
          latestAiredEp,
          totalSeasons: maxSeason,
          totalEpisodes: allMapped.length,
        });
      }

      summaryMap[series.id] = {
        latestLabel: latestAiredEp
          ? `S${latestAiredEp.season} · E${latestAiredEp.episode}`
          : seriesUpcoming[0]
            ? `S${seriesUpcoming[0].season} · E${seriesUpcoming[0].episode}`
            : 'S1 · E1',
        hasNewRecent: recentForSeries.length > 0,
        hasUpcoming: seriesUpcoming.length > 0,
      };
    }

    // Sort upcoming chronologically (soonest first)
    upcoming.sort((a, b) => (a.releaseTs || 0) - (b.releaseTs || 0));

    // Sort recent/new episodes newest first (by releaseTs desc, fallback season/episode desc)
    recent.sort((a, b) => {
      if (a.releaseTs && b.releaseTs && a.releaseTs !== b.releaseTs) {
        return b.releaseTs - a.releaseTs;
      }
      if (a.releaseTs && !b.releaseTs) return -1;
      if (!a.releaseTs && b.releaseTs) return 1;
      if (a.season !== b.season) return b.season - a.season;
      return b.episode - a.episode;
    });

    return {
      upcomingEpisodes: upcoming,
      recentNewEpisodes: recent,
      upNextPerSeries: upNext,
      seriesSummaryBadges: summaryMap,
    };
  }, [
    trackedSeriesList,
    selectedSeriesId,
    seriesMetaMap,
    favoriteSeriesList,
    watchProgressMap,
  ]);

  const renderEpisodeCard = (
    epItem: CalendarEpisodeItem,
    badgeOverride?: string
  ) => {
    const dateLabel =
      badgeOverride ||
      formatReleaseDateLabel(
        epItem.releaseTs,
        epItem.isUpcoming,
        epItem.isReleasedToday
      );
    const seriesPoster =
      epItem.series.poster ||
      `https://images.metahub.space/poster/medium/${epItem.imdbId}/img`;
    const fallbackBackdrop =
      epItem.series.background ||
      `https://images.metahub.space/background/medium/${epItem.imdbId}/img`;

    return (
      <div
        key={epItem.id}
        className="group rounded-2xl tahoe-glass border border-white/10 hover:border-white/30 transition-all overflow-hidden flex flex-col shadow-lg"
      >
        <button
          type="button"
          data-vod-card="true"
          onClick={() =>
            onOpenVodEpisode(
              epItem.series,
              !epItem.isUpcoming,
              epItem.season,
              epItem.episode
            )
          }
          className="relative aspect-video w-full bg-zinc-900 overflow-hidden text-left focus:outline-none focus:ring-4 focus:ring-inset focus:ring-white cursor-pointer"
        >
          <img
            src={epItem.thumbnail}
            alt={`${epItem.series.name} S${epItem.season}E${epItem.episode}`}
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget;
              if (
                fallbackBackdrop &&
                target.src !== fallbackBackdrop &&
                !target.dataset.triedBackdrop
              ) {
                target.dataset.triedBackdrop = '1';
                target.src = fallbackBackdrop;
              } else if (seriesPoster && target.src !== seriesPoster) {
                target.src = seriesPoster;
              }
            }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/25" />

          {/* Top Left: Release Date / Status Pill */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-tight backdrop-blur-md shadow ${
                epItem.isReleasedToday
                  ? 'bg-emerald-500/90 text-zinc-950 font-extrabold'
                  : epItem.isUpcoming
                    ? 'bg-amber-500/90 text-zinc-950 font-extrabold'
                    : epItem.isRecent
                      ? 'bg-[#1e3a8a]/90 text-white border border-sky-400/40'
                      : 'bg-black/75 text-zinc-200 border border-white/15'
              }`}
            >
              {dateLabel}
            </span>
          </div>

          {/* Top Right: Favorite + Watched / New status */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
            {epItem.isWatched ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/45 text-emerald-200 text-[10px] font-bold backdrop-blur-md inline-flex items-center gap-1">
                <Check className="w-3 h-3" />
                {tr('Văzut', 'Watched', 'Просмотрено')}
              </span>
            ) : !epItem.isUpcoming ? (
              <span className="px-2 py-0.5 rounded-full bg-sky-500/90 text-zinc-950 text-[10px] font-extrabold tracking-tight shadow">
                {tr('NOU', 'NEW', 'НОВАЯ')}
              </span>
            ) : null}
            {epItem.isFavoriteSeries && (
              <span className="w-6 h-6 rounded-full bg-black/70 backdrop-blur-md border border-white/15 inline-flex items-center justify-center text-rose-500 text-xs">
                </span>
            )}
          </div>

          {/* Center Hover Play Button */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
            <span className="w-11 h-11 rounded-full bg-white/95 text-zinc-950 flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.6)] scale-95 group-hover:scale-100 transition-transform">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </span>
          </div>

          {/* Bottom Inside Thumbnail: Mini Poster + Series Name + S:E */}
          <div className="absolute inset-x-2.5 bottom-2.5 flex items-end gap-2.5">
            <img
              src={seriesPoster}
              alt={epItem.series.name}
              loading="lazy"
              className="w-8 h-11 rounded-lg object-cover border border-white/25 shadow-md shrink-0 hidden sm:block"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-white/20 backdrop-blur-md text-white text-[10px] font-extrabold tracking-tight shrink-0">
                  S{epItem.season} · E{epItem.episode}
                </span>
                <span className="text-xs sm:text-[13px] font-extrabold text-white truncate drop-shadow">
                  {epItem.series.name}
                </span>
              </div>
              <div className="text-[11px] sm:text-xs font-medium text-zinc-200 truncate mt-0.5">
                {epItem.title}
              </div>
            </div>
          </div>

          {/* Watch Progress Bar if partially watched */}
          {epItem.watchedPct > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
              <div
                className="h-full bg-white"
                style={{ width: `${epItem.watchedPct}%` }}
              />
            </div>
          )}
        </button>

        {/* Compact Footer Row */}
        <div className="px-3 py-2 flex items-center justify-between gap-2 bg-white/[0.02] border-t border-white/5 text-[11px] text-zinc-400">
          <span className="truncate">
            {epItem.currentTimeSec > 10 && !epItem.isWatched
              ? `${tr('Continuă de la', 'Resume at', 'Продолжить с')} ${formatWatchSeconds(epItem.currentTimeSec)}`
              : epItem.isUpcoming
                ? tr('Lansare programată', 'Scheduled release', 'Скоро выйдет')
                : `${tr('Sezonul', 'Season', 'Сезон')} ${epItem.season} • ${tr('Episodul', 'Episode', 'Серия')} ${epItem.episode}`}
          </span>
          <button
            type="button"
            onClick={() =>
              onOpenVodEpisode(
                epItem.series,
                false,
                epItem.season,
                epItem.episode
              )
            }
            className="px-2 py-0.5 rounded-md bg-white/[0.07] hover:bg-white hover:text-zinc-950 focus:bg-white focus:text-zinc-950 focus:outline-none text-zinc-200 font-semibold transition-colors shrink-0 cursor-pointer"
          >
            {tr('Toate episoadele', 'All episodes', 'Все серии')}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-16">
      {/* TOP HEADER PANEL (Apple macOS Tahoe Liquid Glass) */}
      <div className="rounded-3xl tahoe-glass border border-white/10 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white shadow-inner shrink-0">
              <Calendar className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight truncate">
                {tr(
                  'Calendar Episoade Noi — Seriale Favorite',
                  'New Episodes Calendar — Favorite Series',
                  'Календарь новых серий — Избранные сериалы'
                )}
              </h1>
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                {tr(
                  `Profil: ${activeProfileName} • Episoade noi, lansări viitoare și următorul episod pentru serialele tale din Favorite (${favoriteSeriesList.length})`,
                  `Profile: ${activeProfileName} • New episodes, upcoming releases & next episode for your Favorite series (${favoriteSeriesList.length})`,
                  `Профиль: ${activeProfileName} • Новые серии и расписание для ваших избранных сериалов (${favoriteSeriesList.length})`
                )}
              </p>
            </div>
          </div>

          {/* Right Controls: Source Scope + Refresh */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/10 p-0.5">
              <button
                type="button"
                onClick={() => setSourceScope('favorites')}
                className={`h-8 px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${
                  sourceScope === 'favorites'
                    ? 'bg-white text-zinc-950 shadow'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                <span>
                  {tr('Doar Favorite', 'Favorites Only', 'Только Избранное')} (
                  {favoriteSeriesList.length})
                </span>
              </button>
              {historySeriesList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSourceScope('all')}
                  className={`h-8 px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${
                    sourceScope === 'all'
                      ? 'bg-white text-zinc-950 shadow'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {tr(
                      'Favorite + Istoric',
                      'Favorites + History',
                      'Избранное + История'
                    )}
                  </span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                for (const s of trackedSeriesList) {
                  delete SERIES_CALENDAR_CACHE[s.id];
                }
                setRefreshTick((t) => t + 1);
              }}
              title={tr(
                'Actualizează calendarul de episoade',
                'Refresh episodes calendar',
                'Обновить календарь серий'
              )}
              className="h-8 px-3 rounded-full bg-white/[0.07] hover:bg-white hover:text-zinc-950 focus:bg-white focus:text-zinc-950 focus:outline-none border border-white/10 text-xs font-semibold text-zinc-200 inline-flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoadingMeta ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">
                {tr('Actualizează', 'Refresh', 'Обновить')}
              </span>
            </button>
          </div>
        </div>

        {/* Category Filter Tabs + Series Filter Chips */}
        {trackedSeriesList.length > 0 && (
          <div className="flex flex-col gap-3 pt-2 border-t border-white/10">
            {/* View Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {(
                [
                  {
                    id: 'all',
                    label: tr(
                      'Toate Secțiunile',
                      'All Sections',
                      'Все разделы'
                    ),
                    count:
                      upcomingEpisodes.length +
                      recentNewEpisodes.length,
                  },
                  {
                    id: 'recent',
                    label: tr(
                      'Episoade Noi & Recente',
                      'New & Recent Episodes',
                      'Новые и недавние серии'
                    ),
                    count: recentNewEpisodes.length,
                  },
                  {
                    id: 'upcoming',
                    label: tr(
                      'În Curând / Viitoare',
                      'Upcoming Releases',
                      'Скоро выйдут'
                    ),
                    count: upcomingEpisodes.length,
                  },
                  {
                    id: 'upnext',
                    label: tr(
                      'Următorul de Văzut',
                      'Up Next for You',
                      'Следующая серия'
                    ),
                    count: upNextPerSeries.length,
                  },
                ] as const
              ).map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`h-8 px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-2 shrink-0 transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${
                      isActive
                        ? 'bg-white text-zinc-950 shadow'
                        : 'bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 border border-white/10'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isActive
                          ? 'bg-zinc-950/15 text-zinc-950'
                          : 'bg-white/10 text-zinc-300'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Horizontal Favorite Series Pills (Filter by a specific Favorite Series) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedSeriesId('ALL')}
                className={`h-9 px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2 shrink-0 transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${
                  selectedSeriesId === 'ALL'
                    ? 'bg-white text-zinc-950 shadow'
                    : 'bg-white/[0.05] hover:bg-white/[0.12] text-zinc-300 border border-white/10'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>
                  {tr('Toate Serialele', 'All Series', 'Все сериалы')} (
                  {trackedSeriesList.length})
                </span>
              </button>

              {trackedSeriesList.map((series) => {
                const isSelected = selectedSeriesId === series.id;
                const badgeInfo = seriesSummaryBadges[series.id];
                const poster =
                  series.poster ||
                  `https://images.metahub.space/poster/medium/${series.id}/img`;
                return (
                  <button
                    key={`cal_filter_${series.id}`}
                    type="button"
                    onClick={() =>
                      setSelectedSeriesId(isSelected ? 'ALL' : series.id)
                    }
                    className={`h-9 pl-1.5 pr-3 rounded-xl text-xs font-semibold inline-flex items-center gap-2 shrink-0 transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${
                      isSelected
                        ? 'bg-white text-zinc-950 shadow'
                        : 'bg-white/[0.05] hover:bg-white/[0.12] text-zinc-200 border border-white/10'
                    }`}
                  >
                    <img
                      src={poster}
                      alt={series.name}
                      loading="lazy"
                      className="w-5 h-7 rounded object-cover shrink-0"
                    />
                    <span className="max-w-[140px] truncate">{series.name}</span>
                    {badgeInfo?.latestLabel && (
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          isSelected
                            ? 'bg-zinc-950/15 text-zinc-950'
                            : badgeInfo.hasNewRecent
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                              : 'bg-white/10 text-zinc-400'
                        }`}
                      >
                        {badgeInfo.latestLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* LOADING INDICATOR WHEN FETCHING EPISODE LISTS */}
      {isLoadingMeta &&
        upcomingEpisodes.length === 0 &&
        recentNewEpisodes.length === 0 && (
          <div className="py-12 rounded-3xl tahoe-glass border border-white/10 flex flex-col items-center justify-center gap-3 text-zinc-300">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
            <p className="text-xs sm:text-sm font-medium">
              {tr(
                'Se încarcă episoadele noi pentru serialele tale din Favorite...',
                'Loading new episodes for your Favorite series...',
                'Загрузка новых серий для ваших избранных сериалов...'
              )}
            </p>
          </div>
        )}

      {/* EMPTY STATE IF NO FAVORITE SERIES YET */}
      {trackedSeriesList.length === 0 && (
        <div className="rounded-3xl tahoe-glass border border-white/10 p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 inline-flex items-center justify-center mx-auto">
            <Heart className="w-6 h-6 fill-rose-500/30" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white">
            {tr(
              'Nu ai adăugat încă niciun serial la Favorite ',
              'You have no TV series saved in Favorites yet',
              'У вас пока нет сериалов в Избранном '
            )}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto">
            {tr(
              'Adaugă serialele tale preferate mai jos cu un singur click pe „+ Favorite” sau din secțiunea Seriale, iar aici în Calendar îți vor apărea automat toate episoadele noi și viitoare!',
              'Add your favorite TV series below with 1 click on "+ Favorite" or from the TV Series section, and all new & upcoming episodes will appear here automatically!',
              'Добавьте любимые сериалы ниже одним нажатием на «+ Избранное», и все новые серии появятся здесь автоматически!'
            )}
          </p>
          <div className="pt-1 flex items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigateToSection('series')}
              className="h-9 px-4 rounded-full bg-white text-zinc-950 font-bold text-xs inline-flex items-center gap-2 hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-white cursor-pointer"
            >
              <Tv className="w-4 h-4" />
              <span>
                {tr(
                  'Explorează toate Serialele →',
                  'Browse all TV Series →',
                  'Открыть все сериалы →'
                )}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* SECTION 1: UPCOMING RELEASES ("În Curând — Calendar Lansări Viitoare") */}
      {(activeTab === 'all' || activeTab === 'upcoming') &&
        upcomingEpisodes.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>
                  {tr(
                    'În Curând — Episoade Viitoare Programate',
                    'Coming Soon — Scheduled Upcoming Episodes',
                    'Скоро выйдут — Запланированные серии'
                  )}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold">
                  {upcomingEpisodes.length}
                </span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {upcomingEpisodes.map((ep) => renderEpisodeCard(ep))}
            </div>
          </div>
        )}

      {/* SECTION 2: NEW & RECENTLY AIRED EPISODES ("Episoade Noi & Apărute Recent") */}
      {(activeTab === 'all' || activeTab === 'recent') &&
        recentNewEpisodes.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-400" />
                <span>
                  {tr(
                    'Episoade Noi — Seriale din Favorite',
                    'New Episodes — Favorite Series',
                    'Новые серии — Избранные сериалы'
                  )}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 text-xs font-bold">
                  {recentNewEpisodes.length}
                </span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {recentNewEpisodes.map((ep) => renderEpisodeCard(ep))}
            </div>
          </div>
        )}

      {/* SECTION 3: UP NEXT PER FAVORITE SERIES ("Următorul Episod de Văzut pentru Fiecare Serial din Favorite") */}
      {(activeTab === 'all' || activeTab === 'upnext') &&
        upNextPerSeries.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                <span>
                  {tr(
                    'Următorul Episod de Văzut — Toate Serialele Favorite',
                    'Up Next to Watch — All Favorite Series',
                    'Следующая серия к просмотру — Все избранные сериалы'
                  )}
                </span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {upNextPerSeries.map(({ nextEp, latestAiredEp }) => {
                const badge =
                  nextEp.currentTimeSec > 10 && !nextEp.isWatched
                    ? tr('CONTINUĂ EPISODUL', 'CONTINUE EPISODE', 'ПРОДОЛЖИТЬ')
                    : latestAiredEp &&
                        latestAiredEp.season === nextEp.season &&
                        latestAiredEp.episode === nextEp.episode
                      ? tr('ULTIMUL EPISOD APĂRUT', 'LATEST EPISODE', 'ПОСЛЕДНЯЯ СЕРИЯ')
                      : tr('URMĂTORUL EPISOD', 'UP NEXT', 'СЛЕДУЮЩАЯ СЕРИЯ');
                return renderEpisodeCard(nextEp, badge);
              })}
            </div>
          </div>
        )}

      {/* SECTION 4: QUICK ADD POPULAR SERIES TO FAVORITES & CALENDAR */}
      <div className="space-y-3 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-zinc-200 tracking-tight flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
              <span>
                {tr(
                  'Adaugă Rapid Seriale în Favorite & Calendar',
                  'Quick-Add Series to Favorites & Calendar',
                  'Быстро добавить сериалы в Избранное и Календарь'
                )}
              </span>
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {tr(
                'Apasă pe un serial pentru a-l adăuga sau elimina din Favorite — episoadele lui apar imediat în Calendarul de mai sus.',
                'Click any series to add or remove from Favorites — its episodes appear immediately in the Calendar above.',
                'Нажмите на сериал, чтобы добавить его в Избранное — его серии сразу появятся в Календаре выше.'
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {POPULAR_FAVORITE_SERIES_SUGGESTIONS.map((sug) => {
            const isSaved = savedVodItems.some((x) => x.id === sug.id);
            return (
              <div
                key={`cal_sug_${sug.id}`}
                className={`rounded-2xl p-2 flex items-center gap-2.5 border transition-all ${
                  isSaved
                    ? 'bg-white/12 border-white/30'
                    : 'tahoe-glass border-white/10 hover:border-white/25'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onOpenVodEpisode(sug, false, 1, 1)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left focus:outline-none cursor-pointer"
                >
                  <img
                    src={sug.poster}
                    alt={sug.name}
                    loading="lazy"
                    className="w-9 h-13 rounded-lg object-cover shrink-0 border border-white/15"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">
                      {sug.name}
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                      {sug.releaseInfo} {sug.imdbRating ? `• ${sug.imdbRating}` : ''}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleSaveVodItem(sug)}
                  title={
                    isSaved
                      ? tr('Elimină din Favorite', 'Remove from Favorites', 'Убрать из Избранного')
                      : tr('Adaugă în Favorite & Calendar', 'Add to Favorites & Calendar', 'В Избранное и Календарь')
                  }
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${
                    isSaved
                      ? 'bg-rose-500 text-white shadow'
                      : 'bg-white/10 hover:bg-white text-zinc-200 hover:text-zinc-950'
                  }`}
                >
                  {isSaved ? (
                    <Heart className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};


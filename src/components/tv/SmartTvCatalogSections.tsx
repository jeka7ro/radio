import React, { useEffect, useState } from "react";
import {
  Loader2,
  SlidersHorizontal,
  Search,
  Delete,
  Heart,
  Music,
  Disc,
  SkipBack,
  Pause,
  Play,
  SkipForward,
  Maximize2,
  PictureInPicture2,
  VolumeX,
  Volume2,
  Tv,
  Film,
  X,
  Sparkles,
  Lock,
} from "lucide-react";
import { isAdultTvChannel } from "../../services/tvApi";
import { resolveChannelEpg, getEpgTimingStats } from "../../services/epgService";
import { setActiveTvPlaylistContext } from "./TvOsdChannelList";
import { TvPlayerModal } from "./TvPlayerModal";
import { StationAvatar } from "../common/StationAvatar";
import { toggleRadioPip } from "../player/RadioPipPlayer";
import { StreamingPlatformLogo } from "../common/StreamingPlatformLogo";
import { getCountryFlagEmoji } from "../../services/geoLanguageService";
import { SmartTvKlubnichkaSection } from "./SmartTvKlubnichkaSection";
import {
  CinemetaItem,
  TV_LIVE_REGIONS,
  TV_LIVE_CATEGORIES,
  RADIO_COUNTRIES,
  ON_SCREEN_KEYS_LATIN,
  ON_SCREEN_KEYS_CYRILLIC,
  STREAMING_PLATFORMS,
  isStreamingPlatformSection,
  YOUTUBE_CATEGORIES,
  sanitizeDeviceName,
  SeriesEpisodeStats,
  resolveSeriesEpisodeStats,
  formatSeriesCardBadgeText,
  formatSeriesCardSubtitleText,
  getVodCardRatingInfo,
  isAdminJekaProfile,
} from "../../views/smartTvLampaHelpers";

export const SmartTvCatalogSections: React.FC<any> = React.memo(({
  section,
  platformMediaTab,
  setPlatformMediaTab,
  tr,
  isVodLoading,
  vodItems,
  savedVodItems,
  handleFocusVodItem,
  handleOpenVod,
  hasMoreVod,
  isLoadingMoreVod,
  vodPage,
  setVodPage,
  fetchVodCatalog,
  setIsCatalogDrawerOpen,
  setFilterSubMenu,
  setIsFilterDrawerOpen,
  originCountry,
  tvSearchInputRef,
  tvSearchQuery,
  setTvSearchQuery,
  setIsTvKeyboardOpen,
  isTvKeyboardOpen,
  setKeyboardAlphabet,
  keyboardAlphabet,
  adultContentEnabled,
  tvRegionId,
  setTvRegionId,
  setTvCategoryId,
  favoriteTvChannels,
  customTvChannels,
  tvCategoryId,
  isTvLoading,
  tvChannels,
  playTvChannel,
  toggleFavoriteTvChannel,
  currentStation,
  radioStations,
  favorites,
  playerStatus,
  activeRadioTrack,
  isMuted,
  volume,
  playStation,
  setIsTvRadioPlayerOpen,
  nowPlayingTitle,
  playPreviousStation,
  stopRadio,
  playNextAvailableStation,
  toggleFavorite,
  toggleMute,
  setVolume,
  radioSearchInputRef,
  radioSearchQuery,
  setRadioSearchQuery,
  setIsRadioKeyboardOpen,
  isRadioKeyboardOpen,
  radioCountry,
  setRadioCountry,
  isRadioLoading,
  searchQuery,
  setSearchQuery,
  setFlSearchQuery,
  setSection,
  requestTvFullscreen,
  isSearchLoading,
  searchResults,
  ytCategory,
  ytSearchQuery,
  setYtSearchQuery,
  setYtCategory,
  setIsYtKeyboardOpen,
  isYtKeyboardOpen,
  isYtLoading,
  ytItems,
  handlePlayYouTubeVideo,
  flCategory,
  flSearchQuery,
  setFlCategory,
  setFlSort,
  flSort,
  setIsFlKeyboardOpen,
  isFlKeyboardOpen,
  isFlLoading,
  flItems,
  activeProfile,
  historyList,
  handleClearAllWatchProgress,
  handleRemoveWatchProgressItem,
  renderPosterProgressOverlay,
  likedMusicTracks = [],
  currentMusicTrack,
  isMusicPlaying,
  handlePlayMusicTrack,
  handleToggleMusicPlayPause,
  handleToggleLikeMusicTrack,
  seriesEpStatsMap = {},
}: Record<string, any> & {
  vodItems: any[];
  savedVodItems: any[];
  favoriteTvChannels: any[];
  customTvChannels: any[];
  tvChannels: any[];
  radioStations: any[];
  favorites: any[];
  searchResults: any[];
  ytItems: any[];
  flItems: any[];
  historyList: any[];
  setTvSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setIsTvKeyboardOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setKeyboardAlphabet: React.Dispatch<React.SetStateAction<'LAT' | 'CYR'>>;
  setRadioSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setIsRadioKeyboardOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setYtSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setIsYtKeyboardOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFlSort: React.Dispatch<React.SetStateAction<'seeders' | 'latest'>>;
  setIsFlKeyboardOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFlSearchQuery: React.Dispatch<React.SetStateAction<string>>;
}) => {
  const [stationLiveTracks, setStationLiveTracks] = React.useState<
    Record<
      string,
      {
        title: string;
        artist?: string;
        album?: string;
        coverUrl?: string;
        artistAvatarUrl?: string;
      }
    >
  >({});
  const [isKlubnichkaOpen, setIsKlubnichkaOpen] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (section !== 'torrents' || !isAdminJekaProfile(activeProfile)) {
      setIsKlubnichkaOpen(false);
    }
  }, [section, activeProfile]);

  React.useEffect(() => {
    if (currentStation?.stationuuid && activeRadioTrack?.title) {
      setStationLiveTracks((prev) => ({
        ...prev,
        [currentStation.stationuuid]: activeRadioTrack,
      }));
    }
  }, [currentStation?.stationuuid, activeRadioTrack]);

  React.useEffect(() => {
    if (section !== 'favorites' && section !== 'radio') return;
    let cancelled = false;

    const stationsToPoll =
      section === 'favorites'
        ? favorites.slice(0, 24)
        : [
            ...favorites.slice(0, 16),
            ...radioStations
              .filter(
                (r: any) =>
                  !favorites.some((f: any) => f.stationuuid === r.stationuuid)
              )
              .slice(0, 16),
          ];

    if (stationsToPoll.length === 0) return;

    const pollStations = async () => {
      const batchSize = 6;
      for (let i = 0; i < stationsToPoll.length; i += batchSize) {
        if (cancelled) return;
        const batch = stationsToPoll.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (st: any) => {
            const streamUrl = String(st?.url_resolved || st?.url || '').trim();
            if (!streamUrl || !st?.stationuuid) return;
            try {
              const res = await fetch(
                `/api/radio-meta?url=${encodeURIComponent(
                  streamUrl
                )}&name=${encodeURIComponent(st.name || '')}&_t=${Date.now()}`
              );
              if (!res.ok || cancelled) return;
              const data = await res.json();
              if (!cancelled && data?.track?.title) {
                setStationLiveTracks((prev) => ({
                  ...prev,
                  [st.stationuuid]: {
                    title: data.track.title,
                    artist: data.track.artist || undefined,
                    album: data.track.album || undefined,
                    coverUrl:
                      data.track.coverUrl ||
                      data.track.artistAvatarUrl ||
                      undefined,
                    artistAvatarUrl:
                      data.track.artistAvatarUrl ||
                      data.track.coverUrl ||
                      undefined,
                  },
                }));
              }
            } catch {
              // ignore individual station error
            }
          })
        );
      }
    };

    void pollStations();
    const timer = window.setInterval(() => {
      void pollStations();
    }, 18000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [section, favorites, radioStations]);

  // 4K UHD Dedicated Section State & Fetcher (Movies + Series in 4K, newest first, with LG TV optimized search)
  const [uhdMediaFilter, setUhdMediaFilter] = React.useState<'all' | 'movie' | 'series'>('all');
  const [uhdSearchQuery, setUhdSearchQuery] = React.useState<string>('');
  const [isUhdKeyboardOpen, setIsUhdKeyboardOpen] = React.useState<boolean>(false);
  const [uhdItems, setUhdItems] = React.useState<CinemetaItem[]>([]);
  const [isUhdLoading, setIsUhdLoading] = React.useState<boolean>(false);
  const uhdSearchInputRef = React.useRef<HTMLInputElement | null>(null);
  const [uhdSeriesEpStats, setUhdSeriesEpStats] = React.useState<Record<string, SeriesEpisodeStats>>({});

  React.useEffect(() => {
    if (section !== 'uhd_4k' || uhdItems.length === 0) return;
    const toFetch = uhdItems
      .filter(
        (it) =>
          it.type === 'series' &&
          !seriesEpStatsMap[it.id] &&
          !uhdSeriesEpStats[it.id]
      )
      .slice(0, 36);
    if (toFetch.length === 0) return;
    let cancelled = false;
    void (async () => {
      const batchSize = 6;
      for (let i = 0; i < toFetch.length; i += batchSize) {
        if (cancelled) break;
        const batch = toFetch.slice(i, i + batchSize);
        const res = await Promise.all(
          batch.map(async (it) => ({
            id: it.id,
            stats: await resolveSeriesEpisodeStats(it),
          }))
        );
        if (cancelled) break;
        setUhdSeriesEpStats((prev) => {
          const next = { ...prev };
          for (const r of res) {
            if (r.stats) next[r.id] = r.stats;
          }
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section, uhdItems, seriesEpStatsMap, uhdSeriesEpStats]);

  React.useEffect(() => {
    if (section !== 'uhd_4k') return;
    let cancelled = false;
    setIsUhdLoading(true);
    const q = uhdSearchQuery.trim();

    const extractYearNum = (item: CinemetaItem): number => {
      const m = String(item.releaseInfo || item.year || '').match(/\b(19\d{2}|20\d{2})\b/);
      return m ? Number(m[1]) : 2025;
    };

    const timer = window.setTimeout(async () => {
      try {
        if (q.length >= 2) {
          const [flMovRes, flSerRes, cmMovRes, cmSerRes, kpRes] = await Promise.allSettled([
            fetch(`/api/filelist/catalog?section=movies_4k&sort=latest&q=${encodeURIComponent(q)}`).then((r) =>
              r.ok ? r.json() : { items: [] }
            ),
            fetch(`/api/filelist/catalog?section=series_4k&sort=latest&q=${encodeURIComponent(q)}`).then((r) =>
              r.ok ? r.json() : { items: [] }
            ),
            fetch(
              `https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(q)}.json`
            ).then((r) => (r.ok ? r.json() : { metas: [] })),
            fetch(
              `https://v3-cinemeta.strem.io/catalog/series/top/search=${encodeURIComponent(q)}.json`
            ).then((r) => (r.ok ? r.json() : { metas: [] })),
            fetch(
              `https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(q)}&page=1`,
              {
                headers: {
                  'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
                },
              }
            ).then((r) => (r.ok ? r.json() : { films: [] })),
          ]);

          if (cancelled) return;
          const combined: CinemetaItem[] = [];
          const seenIds = new Set<string>();
          const seenNames = new Set<string>();

          const addUnique = (item: CinemetaItem) => {
            if (!item?.id || !item?.name) return;
            const normName = `${item.type}:${item.name.toLowerCase().trim()}`;
            if (seenIds.has(item.id) || seenNames.has(normName)) {
              const existing = combined.find(
                (x) =>
                  x.id === item.id ||
                  `${x.type}:${x.name.toLowerCase().trim()}` === normName
              );
              if (existing) {
                if (!existing.imdbRating && item.imdbRating) existing.imdbRating = item.imdbRating;
                if (!existing.ratingKinopoisk && item.ratingKinopoisk) existing.ratingKinopoisk = item.ratingKinopoisk;
                if (!existing.country && item.country) existing.country = item.country;
              }
              return;
            }
            seenIds.add(item.id);
            seenNames.add(normName);
            combined.push({
              ...item,
              qualityBadge: item.qualityBadge || '4K UHD',
            });
          };

          for (const res of [flMovRes, flSerRes]) {
            if (res.status === 'fulfilled' && Array.isArray(res.value?.items)) {
              for (const tor of res.value.items) {
                addUnique({
                  id: tor.imdbId || `fl_${tor.id}`,
                  flTorrentId: tor.id,
                  releaseTitle: tor.releaseTitle,
                  sizeFormatted: tor.sizeFormatted,
                  seeders: tor.seeders,
                  freeleech: tor.freeleech,
                  isRo: tor.isRo,
                  qualityBadge: tor.quality || '4K UHD',
                  type: tor.type === 'series' ? 'series' : 'movie',
                  name: tor.name,
                  releaseInfo: tor.year || '2026',
                  poster: tor.poster,
                  genres: tor.genres,
                });
              }
            }
          }

          if (cmMovRes.status === 'fulfilled' && Array.isArray(cmMovRes.value?.metas)) {
            for (const m of cmMovRes.value.metas) {
              addUnique({ ...m, type: 'movie', qualityBadge: '4K UHD' });
            }
          }
          if (cmSerRes.status === 'fulfilled' && Array.isArray(cmSerRes.value?.metas)) {
            for (const s of cmSerRes.value.metas) {
              addUnique({ ...s, type: 'series', qualityBadge: '4K UHD' });
            }
          }
          if (kpRes.status === 'fulfilled' && Array.isArray(kpRes.value?.films)) {
            for (const f of kpRes.value.films) {
              const isSer =
                f.type === 'TV_SERIES' || f.type === 'MINI_SERIES' || f.type === 'TV_SHOW';
              const ratingNum = parseFloat(String(f.rating || '0'));
              const countryStr = Array.isArray(f.countries)
                ? f.countries.map((c: any) => c.country).filter(Boolean).join(', ')
                : undefined;
              addUnique({
                id: `kp_${f.filmId}`,
                kpId: String(f.filmId),
                type: isSer ? 'series' : 'movie',
                name: f.nameEn || f.nameRu || `Film #${f.filmId}`,
                nameOriginal: f.nameEn || undefined,
                releaseInfo: f.year && f.year !== 'null' ? String(f.year) : '2026',
                imdbRating: ratingNum > 0 ? String(ratingNum) : undefined,
                ratingKinopoisk: ratingNum > 0 ? String(ratingNum) : undefined,
                country: countryStr,
                poster: f.posterUrlPreview || f.posterUrl,
                qualityBadge: '4K UHD',
              });
            }
          }

          combined.sort((a, b) => {
            const aFl = a.flTorrentId ? 1 : 0;
            const bFl = b.flTorrentId ? 1 : 0;
            if (bFl !== aFl) return bFl - aFl;
            const yDiff = extractYearNum(b) - extractYearNum(a);
            if (yDiff !== 0) return yDiff;
            const rA = parseFloat(String(a.imdbRating || '0')) || 0;
            const rB = parseFloat(String(b.imdbRating || '0')) || 0;
            return rB - rA;
          });

          setUhdItems(combined);
          return;
        }

        // Default 4K Catalog: Newest 4K Movies & Series from FileList 4K + Cinemeta Top + Kinopoisk 2025-2026
        const [flMov4kRes, flSer4kRes, cmMovTopRes, cmSerTopRes, kpNewRes] =
          await Promise.allSettled([
            fetch('/api/filelist/catalog?section=movies_4k&sort=latest&q=').then((r) =>
              r.ok ? r.json() : { items: [] }
            ),
            fetch('/api/filelist/catalog?section=series_4k&sort=latest&q=').then((r) =>
              r.ok ? r.json() : { items: [] }
            ),
            fetch('https://v3-cinemeta.strem.io/catalog/movie/top.json').then((r) =>
              r.ok ? r.json() : { metas: [] }
            ),
            fetch('https://v3-cinemeta.strem.io/catalog/series/top.json').then((r) =>
              r.ok ? r.json() : { metas: [] }
            ),
            fetch(
              'https://kinopoiskapiunofficial.tech/api/v2.2/films?type=ALL&order=NUM_VOTE&yearFrom=2025&yearTo=2026&page=1',
              {
                headers: {
                  'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
                },
              }
            ).then((r) => (r.ok ? r.json() : { items: [] })),
          ]);

        if (cancelled) return;
        const combined: CinemetaItem[] = [];
        const seenIds = new Set<string>();
        const seenNames = new Set<string>();

        const addUnique = (item: CinemetaItem) => {
          if (!item?.id || !item?.name) return;
          const normName = `${item.type}:${item.name.toLowerCase().trim()}`;
          if (seenIds.has(item.id) || seenNames.has(normName)) {
            const existing = combined.find(
              (x) =>
                x.id === item.id ||
                `${x.type}:${x.name.toLowerCase().trim()}` === normName
            );
            if (existing) {
              if (!existing.imdbRating && item.imdbRating) existing.imdbRating = item.imdbRating;
              if (!existing.ratingKinopoisk && item.ratingKinopoisk) existing.ratingKinopoisk = item.ratingKinopoisk;
              if (!existing.country && item.country) existing.country = item.country;
            }
            return;
          }
          seenIds.add(item.id);
          seenNames.add(normName);
          combined.push({
            ...item,
            qualityBadge: item.qualityBadge || '4K UHD',
          });
        };

        for (const res of [flMov4kRes, flSer4kRes]) {
          if (res.status === 'fulfilled' && Array.isArray(res.value?.items)) {
            for (const tor of res.value.items) {
              addUnique({
                id: tor.imdbId || `fl_${tor.id}`,
                flTorrentId: tor.id,
                releaseTitle: tor.releaseTitle,
                sizeFormatted: tor.sizeFormatted,
                seeders: tor.seeders,
                freeleech: tor.freeleech,
                isRo: tor.isRo,
                qualityBadge: tor.quality || '4K UHD',
                type: tor.type === 'series' ? 'series' : 'movie',
                name: tor.name,
                releaseInfo: tor.year || '2026',
                poster: tor.poster,
                genres: tor.genres,
              });
            }
          }
        }

        if (kpNewRes.status === 'fulfilled' && Array.isArray(kpNewRes.value?.items)) {
          for (const f of kpNewRes.value.items) {
            const isSer =
              f.type === 'TV_SERIES' || f.type === 'MINI_SERIES' || f.type === 'TV_SHOW';
            const validImdb = f.imdbId && /^tt\d+$/.test(f.imdbId) ? f.imdbId : '';
            const ratingVal = f.ratingImdb || f.ratingKinopoisk;
            const countryStr = Array.isArray(f.countries)
              ? f.countries.map((c: any) => c.country).filter(Boolean).join(', ')
              : undefined;
            addUnique({
              id: validImdb || `kp_${f.kinopoiskId}`,
              kpId: String(f.kinopoiskId),
              type: isSer ? 'series' : 'movie',
              name: f.nameOriginal || f.nameEn || f.nameRu || `Film #${f.kinopoiskId}`,
              nameOriginal: f.nameOriginal || f.nameEn || undefined,
              releaseInfo: f.year && String(f.year) !== 'null' ? String(f.year) : '2026',
              imdbRating: ratingVal ? String(ratingVal) : undefined,
              ratingKinopoisk: f.ratingKinopoisk ? String(f.ratingKinopoisk) : undefined,
              country: countryStr,
              poster: validImdb
                ? `https://images.metahub.space/poster/medium/${validImdb}/img`
                : f.posterUrlPreview || f.posterUrl,
              qualityBadge: '4K UHD',
            });
          }
        }

        const movMetas =
          cmMovTopRes.status === 'fulfilled' && Array.isArray(cmMovTopRes.value?.metas)
            ? cmMovTopRes.value.metas
            : [];
        const serMetas =
          cmSerTopRes.status === 'fulfilled' && Array.isArray(cmSerTopRes.value?.metas)
            ? cmSerTopRes.value.metas
            : [];
        const maxLen = Math.max(movMetas.length, serMetas.length);
        for (let i = 0; i < maxLen; i++) {
          if (movMetas[i]) {
            addUnique({ ...movMetas[i], type: 'movie', qualityBadge: '4K UHD' });
          }
          if (serMetas[i]) {
            addUnique({ ...serMetas[i], type: 'series', qualityBadge: '4K UHD' });
          }
        }

        combined.sort((a, b) => {
          const yDiff = extractYearNum(b) - extractYearNum(a);
          if (yDiff !== 0) return yDiff;
          const aFl = a.flTorrentId ? 1 : 0;
          const bFl = b.flTorrentId ? 1 : 0;
          if (bFl !== aFl) return bFl - aFl;
          const rA = parseFloat(String(a.imdbRating || '0')) || 0;
          const rB = parseFloat(String(b.imdbRating || '0')) || 0;
          return rB - rA;
        });

        setUhdItems(combined);
      } catch {
        if (!cancelled) setUhdItems([]);
      } finally {
        if (!cancelled) setIsUhdLoading(false);
      }
    }, q ? 240 : 10);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [section, uhdSearchQuery]);

  const filteredUhdItems = React.useMemo(() => {
    if (uhdMediaFilter === 'all') return uhdItems;
    return uhdItems.filter((item) => item.type === uhdMediaFilter);
  }, [uhdItems, uhdMediaFilter]);

  return (
    <>
                {/* SECTION 0B: LAMPA CATEGORY & STREAMING PLATFORM VIEWS ("Фильмы", "Мультфильмы", "Сериалы", Netflix, HBO Max, Apple TV+, Disney+, Prime Video, SkyShowtime) */}
                {(section === 'movies' ||
                  section === 'cartoons' ||
                  section === 'series' ||
                  isStreamingPlatformSection(section)) && (
                    <div className="space-y-6 pb-16">
                      {/* MOBILE-ONLY SEGMENTED SWITCHER FOR UNIFIED "FILME & SERIALE" TAB (< 768px) */}
                      {(section === 'movies' || section === 'series') && (
                        <div className="md:hidden flex items-center gap-2 p-1 rounded-2xl bg-white/[0.06] border border-white/10">
                          <button
                            type="button"
                            onClick={() => setSection('movies')}
                            className={`flex-1 h-10 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-2 transition-all cursor-pointer ${
                              section === 'movies'
                                ? 'bg-white text-[#141414] shadow-md'
                                : 'text-zinc-300 hover:text-white'
                            }`}
                          >
                            <span>{tr('Filme', 'Movies', 'Фильмы')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSection('series')}
                            className={`flex-1 h-10 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-2 transition-all cursor-pointer ${
                              section === 'series'
                                ? 'bg-white text-[#141414] shadow-md'
                                : 'text-zinc-300 hover:text-white'
                            }`}
                          >
                            <span>{tr('Seriale', 'TV Series', 'Сериалы')}</span>
                          </button>
                        </div>
                      )}

                      {isStreamingPlatformSection(section) && (() => {
                        const activePlat =
                          STREAMING_PLATFORMS.find((p) => p.id === section) ||
                          STREAMING_PLATFORMS[0];
                        return (
                          <div className="space-y-3.5">
                            {/* Horizontal Platform Switcher Dock (All Streaming Platforms + YouTube Premium in one sleek top bar) */}
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                              {STREAMING_PLATFORMS.map((plat) => {
                                const isActivePlat = section === plat.id;
                                return (
                                  <button
                                    key={plat.id}
                                    type="button"
                                    onClick={() => {
                                      setPlatformMediaTab('series');
                                      setSection(plat.id);
                                    }}
                                    className={`h-10 pl-2 pr-4 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-2.5 shrink-0 transition-all focus:outline-none focus:ring-4 focus:ring-white cursor-pointer ${
                                      isActivePlat
                                        ? 'bg-white text-[#141414] shadow-lg scale-[1.02]'
                                        : 'bg-white/[0.06] hover:bg-white/[0.14] text-zinc-200 border border-white/15'
                                    }`}
                                  >
                                    <StreamingPlatformLogo
                                      platformId={plat.id}
                                      size="sm"
                                    />
                                    <span>{plat.label}</span>
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() => setSection('youtube')}
                                className="h-10 pl-2 pr-4 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-2.5 shrink-0 transition-all bg-white/[0.06] hover:bg-white/[0.14] text-zinc-200 border border-white/15 focus:outline-none focus:ring-4 focus:ring-white cursor-pointer"
                              >
                                <StreamingPlatformLogo
                                  platformId="youtube"
                                  size="sm"
                                />
                                <span>YouTube Premium</span>
                              </button>
                            </div>

                            <div
                              className={`p-4 sm:p-5 rounded-3xl bg-gradient-to-r ${activePlat.accentGradient} border border-white/15 flex flex-wrap items-center justify-between gap-4 shadow-xl`}
                            >
                            <div className="flex items-center gap-3.5">
                              <StreamingPlatformLogo
                                platformId={activePlat.id}
                                size="lg"
                              />
                              <div>
                                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                                  {activePlat.label} —{' '}
                                  {platformMediaTab === 'series'
                                    ? tr(
                                      'Seriale Originale & În Tendințe',
                                      'Original & Trending Series',
                                      'Оригинальные и популярные сериалы'
                                    )
                                    : platformMediaTab === 'movie'
                                      ? tr(
                                        'Filme pe Platformă',
                                        'Platform Movies',
                                        'Фильмы на платформе'
                                      )
                                      : tr(
                                        'Seriale & Filme Complete',
                                        'All Series & Movies',
                                        'Все сериалы и фильмы'
                                      )}
                                </h2>
                                <p className="text-xs text-zinc-300 mt-0.5">
                                  {tr(
                                    'Apasă OK pe orice serial pentru a alege sezonul, episodul și a-l reda direct (Server 1 Full HD / FileList / Subtitrare RO).',
                                    'Press OK on any series to pick season, episode and play immediately.',
                                    'Нажмите OK на любом сериале для выбора сезона, серии и просмотра.'
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {(
                                [
                                  {
                                    id: 'series',
                                    label: tr('Seriale', 'TV Series', 'Сериалы'),
                                  },
                                  {
                                    id: 'movie',
                                    label: tr('Filme', 'Movies', 'Фильмы'),
                                  },
                                  {
                                    id: 'all',
                                    label: tr('Toate', 'All', 'Все'),
                                  },
                                ] as const
                              ).map((tab) => {
                                const isTabActive = platformMediaTab === tab.id;
                                return (
                                  <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setPlatformMediaTab(tab.id)}
                                    className={`h-10 px-4 rounded-full text-xs sm:text-sm font-extrabold transition-all focus:outline-none focus:ring-4 focus:ring-white cursor-pointer ${isTabActive
                                        ? 'bg-white text-[#141414] shadow-md'
                                        : 'bg-white/10 hover:bg-white/20 text-zinc-200 border border-white/15 focus:bg-white focus:text-[#141414]'
                                      }`}
                                  >
                                    {tab.label}
                                  </button>
                                );
                              })}
                            </div>
                            </div>
                          </div>
                        );
                      })()}

                      {isVodLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
                          <Loader2 className="w-10 h-10 text-white animate-spin" />
                          <span className="text-sm font-medium">
                            {tr(
                              'Se încarcă catalogul...',
                              'Loading catalog...',
                              'Загрузка каталога...'
                            )}
                          </span>
                        </div>
                      ) : vodItems.length === 0 ? (
                        <div className="py-16 px-6 rounded-2xl bg-[#202020] border border-white/10 text-center space-y-2">
                          <div className="text-base font-bold text-white">
                            {tr(
                              'Nu s-au găsit titluri',
                              'No titles found',
                              'Ничего не найдено'
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Shelf 1: Сейчас смотрят / Seriale Originale & Hituri */}
                          <div className="space-y-3.5">
                            <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                              {isStreamingPlatformSection(section)
                                ? tr(
                                  `Originale & Hituri ${STREAMING_PLATFORMS.find((p) => p.id === section)?.label || ''}`,
                                  `${STREAMING_PLATFORMS.find((p) => p.id === section)?.label || ''} Originals & Hits`,
                                  `Хиты и оригиналы ${STREAMING_PLATFORMS.find((p) => p.id === section)?.label || ''}`
                                )
                                : tr(
                                  'În tendințe acum',
                                  'Trending Now',
                                  'Сейчас смотрят'
                                )}
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-3 sm:gap-4">
                              {vodItems.slice(0, 12).map((item) => {
                                const isFav = savedVodItems.some(
                                  (x) => x.id === item.id
                                );
                                const posterUrl =
                                  item.poster ||
                                  `https://images.metahub.space/poster/medium/${item.id}/img`;
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    data-vod-card="true"
                                    onFocus={() => handleFocusVodItem(item)}
                                    onMouseEnter={() => handleFocusVodItem(item)}
                                    onClick={() => handleOpenVod(item)}
                                    className="group text-left focus:outline-none cursor-pointer max-w-[220px] w-full"
                                  >
                                    <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                      <img
                                        src={posterUrl}
                                        alt={item.name}
                                        loading="lazy"
                                        onError={(e) => {
                                          const fallback = `https://images.metahub.space/poster/medium/${item.id}/img`;
                                          if (e.currentTarget.src !== fallback) {
                                            e.currentTarget.src = fallback;
                                          }
                                        }}
                                        className="w-full h-full object-cover"
                                      />
                                      {(() => {
                                        const rInfo = getVodCardRatingInfo(item);
                                        return (
                                          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 pointer-events-none">
                                            <span className="px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-sm border border-white/15 text-white text-[10px] font-extrabold tracking-tight shadow inline-flex items-center gap-1">
                                              <span className={rInfo.isRussian ? 'text-[#ff5500]' : 'text-amber-400'}>
                                                {rInfo.source}
                                              </span>
                                              <span>{rInfo.value}</span>
                                            </span>
                                            <span
                                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow ${item.type === 'series'
                                                  ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                                                  : 'bg-amber-500/90 text-zinc-950'
                                                }`}
                                            >
                                              {item.type === 'series'
                                                ? formatSeriesCardBadgeText(item, seriesEpStatsMap[item.id] || uhdSeriesEpStats[item.id], tr)
                                                : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                      {isFav && (
                                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                          ❤
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-2.5 px-0.5">
                                      <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                        {item.name}
                                      </div>
                                      <div className="text-xs text-zinc-400 mt-0.5">
                                        {formatSeriesCardSubtitleText(item, seriesEpStatsMap[item.id] || uhdSeriesEpStats[item.id], tr)}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Shelf 2: Рекомендуем посмотреть */}
                          {vodItems.length > 12 && (
                            <div className="space-y-3.5 pt-2">
                              <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                                {isStreamingPlatformSection(section)
                                  ? tr(
                                    `Catalog ${STREAMING_PLATFORMS.find((p) => p.id === section)?.label || ''} (${vodItems.length - 12})`,
                                    `More on ${STREAMING_PLATFORMS.find((p) => p.id === section)?.label || ''} (${vodItems.length - 12})`,
                                    `Каталог ${STREAMING_PLATFORMS.find((p) => p.id === section)?.label || ''} (${vodItems.length - 12})`
                                  )
                                  : tr(
                                    'Recomandate pentru tine',
                                    'Recommended for You',
                                    'Рекомендуем посмотреть'
                                  )}
                              </h2>
                              <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-x-3 sm:gap-x-4 gap-y-5 sm:gap-y-6">
                                {vodItems.slice(12).map((item) => {
                                  const isFav = savedVodItems.some(
                                    (x) => x.id === item.id
                                  );
                                  const posterUrl =
                                    item.poster ||
                                    `https://images.metahub.space/poster/medium/${item.id}/img`;
                                  return (
                                    <button
                                      key={item.id}
                                      type="button"
                                      data-vod-card="true"
                                      onFocus={() => handleFocusVodItem(item)}
                                      onMouseEnter={() => handleFocusVodItem(item)}
                                      onClick={() => handleOpenVod(item)}
                                      className="group w-full block text-left focus:outline-none cursor-pointer"
                                    >
                                      <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                        <img
                                          src={posterUrl}
                                          alt={item.name}
                                          loading="lazy"
                                          onError={(e) => {
                                            const fallback = `https://images.metahub.space/poster/medium/${item.id}/img`;
                                            if (e.currentTarget.src !== fallback) {
                                              e.currentTarget.src = fallback;
                                            }
                                          }}
                                          className="w-full h-full object-cover"
                                        />
                                        {(() => {
                                          const rInfo = getVodCardRatingInfo(item);
                                          return (
                                            <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 pointer-events-none">
                                              <span className="px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-sm border border-white/15 text-white text-[10px] font-extrabold tracking-tight shadow inline-flex items-center gap-1">
                                                <span className={rInfo.isRussian ? 'text-[#ff5500]' : 'text-amber-400'}>
                                                  {rInfo.source}
                                                </span>
                                                <span>{rInfo.value}</span>
                                              </span>
                                              <span
                                                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow ${item.type === 'series'
                                                    ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                                                    : 'bg-amber-500/90 text-zinc-950'
                                                  }`}
                                              >
                                                {item.type === 'series'
                                                  ? formatSeriesCardBadgeText(item, seriesEpStatsMap[item.id] || uhdSeriesEpStats[item.id], tr)
                                                  : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                                              </span>
                                            </div>
                                          );
                                        })()}
                                        {isFav && (
                                          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                            ❤
                                          </span>
                                        )}
                                      </div>
                                      <div className="mt-2.5 px-0.5">
                                        <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                          {item.name}
                                        </div>
                                        <div className="text-xs text-zinc-400 mt-0.5">
                                          <span>{formatSeriesCardSubtitleText(item, seriesEpStatsMap[item.id] || uhdSeriesEpStats[item.id], tr)}</span>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {hasMoreVod && (
                            <div className="pt-4 flex justify-center">
                              <button
                                type="button"
                                disabled={isLoadingMoreVod}
                                onClick={() => {
                                  const next = vodPage + 1;
                                  setVodPage(next);
                                  void fetchVodCatalog(next, true);
                                }}
                                className="h-11 px-8 rounded-xl bg-gradient-to-r from-[#d4d4d4] via-[#ffffff] to-[#c8c8c8] text-[#141414] focus:outline-none focus:ring-4 focus:ring-white font-semibold text-sm inline-flex items-center gap-2 shadow-lg cursor-pointer"
                              >
                                {isLoadingMoreVod ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {tr('Se încarcă...', 'Loading...', 'Загрузка...')}
                                  </>
                                ) : (
                                  <>{tr('Încarcă mai multe', 'Load More', 'Показать ещё')}</>
                                )}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                {/* DEDICATED 4K UHD SECTION (MOVIES & SERIES IN 4K, NEWEST FIRST + LG TV REMOTE SEARCH BAR) */}
                {section === 'uhd_4k' && (
                  <div className="space-y-6 pb-16">
                    {/* Top Header + Filter Tabs (Same Lampa dark colors as Filme / Seriale / Căutare) */}
                    <div className="flex flex-wrap items-center justify-between">
                      <div className="mr-4 mb-3">
                        <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                          {tr(
                            'Filme și Seriale 4K Ultra HD',
                            '4K Ultra HD Movies & Series',
                            'Фильмы и Сериалы 4K Ultra HD'
                          )}
                        </h2>
                      </div>

                      {/* Filter Tabs with standard Lampa dark/white pills */}
                      <div className="flex flex-wrap items-center mb-3">
                        {(
                          [
                            {
                              id: 'all' as const,
                              label: tr('Toate', 'All', 'Все'),
                            },
                            {
                              id: 'movie' as const,
                              label: tr('Filme', 'Movies', 'Фильмы'),
                            },
                            {
                              id: 'series' as const,
                              label: tr('Seriale', 'Series', 'Сериалы'),
                            },
                          ]
                        ).map((tab) => {
                          const isActive = uhdMediaFilter === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setUhdMediaFilter(tab.id)}
                              className={`h-10 px-4 rounded-full text-xs sm:text-sm font-extrabold mr-2 mb-1.5 transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-white ${
                                isActive
                                  ? 'bg-white text-[#141414] shadow-md'
                                  : 'bg-white/10 hover:bg-white/20 text-zinc-200 border border-white/15 focus:bg-white focus:text-[#141414]'
                              }`}
                            >
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* LG TV Optimized Search Bar (Identical Lampa dark colors #202020 / #141414 as Căutare) */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#202020] border border-white/10 space-y-4">
                      <div className="flex flex-wrap items-center justify-between">
                        <div className="flex-1 min-w-[240px] h-12 px-4 rounded-xl bg-[#141414] border border-white/20 focus-within:border-white flex items-center justify-between mr-2.5 mb-2 sm:mb-0">
                          <Search className="w-5 h-5 text-zinc-400 shrink-0 mr-3" />
                          <input
                            ref={uhdSearchInputRef}
                            data-uhd-search-input="true"
                            type="text"
                            value={uhdSearchQuery}
                            onChange={(e) => setUhdSearchQuery(e.target.value)}
                            placeholder={tr(
                              'Caută film sau serial 4K...',
                              'Search 4K movie or series...',
                              'Поиск 4K фильма или сериала...'
                            )}
                            className="flex-1 min-w-0 bg-transparent text-base sm:text-lg font-bold text-white placeholder:text-zinc-500 placeholder:font-normal focus:outline-none select-text"
                          />
                          {uhdSearchQuery.trim().length > 0 && (
                            <button
                              type="button"
                              onClick={() => setUhdSearchQuery('')}
                              className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 focus:bg-white focus:text-zinc-950 focus:outline-none text-xs font-bold text-zinc-300 shrink-0 cursor-pointer ml-2"
                            >
                              {tr('Șterge tot', 'Clear all', 'Очистить')}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => setIsUhdKeyboardOpen((prev) => !prev)}
                            className={`h-11 px-4 rounded-xl text-xs sm:text-sm font-bold border border-white/10 transition-colors cursor-pointer focus:outline-none ${
                              isUhdKeyboardOpen
                                ? 'bg-white text-[#141414]'
                                : 'bg-[#2a2a2a] hover:bg-[#343434] text-white focus:bg-white focus:text-[#141414]'
                            }`}
                          >
                            {isUhdKeyboardOpen
                              ? tr('Ascunde Tastatura TV', 'Hide TV Keyboard', 'Скрыть клавиатуру')
                              : tr('Tastatură TV', 'TV Keyboard', 'Клавиатура ТВ')}
                          </button>
                        </div>
                      </div>

                      {/* On-Screen D-Pad Remote Keyboard (Identical Lampa dark keys as Căutare) */}
                      {isUhdKeyboardOpen && (
                        <div className="grid grid-cols-9 sm:grid-cols-12 gap-1.5 pt-2">
                          {ON_SCREEN_KEYS_LATIN.map((char) => (
                            <button
                              key={char}
                              type="button"
                              onClick={() => setUhdSearchQuery((prev) => prev + char.toLowerCase())}
                              className="h-10 sm:h-11 rounded-xl bg-[#2a2a2a] hover:bg-[#343434] focus:bg-white focus:text-[#141414] focus:outline-none text-white font-bold text-sm sm:text-base flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                            >
                              {char}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setUhdSearchQuery((prev) => prev + ' ')}
                            className="col-span-4 h-10 sm:h-11 rounded-xl bg-[#2a2a2a] hover:bg-[#343434] focus:bg-white focus:text-[#141414] focus:outline-none text-white font-bold text-xs sm:text-sm flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                          >
                            {tr('Spațiu', 'Space', 'Пробел')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setUhdSearchQuery((prev) => prev.slice(0, -1))}
                            className="col-span-4 h-10 sm:h-11 rounded-xl bg-[#2a2a2a] hover:bg-[#343434] focus:bg-white focus:text-[#141414] focus:outline-none text-zinc-200 font-bold text-xs sm:text-sm flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                          >
                            ⌫ {tr('Șterge', 'Backspace', 'Стереть')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setUhdSearchQuery('')}
                            className="col-span-4 h-10 sm:h-11 rounded-xl bg-[#2a2a2a] hover:bg-[#343434] focus:bg-rose-600 focus:text-white focus:outline-none text-rose-400 font-bold text-xs sm:text-sm flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
                          >
                            ✕ {tr('Curăță', 'Clear', 'Очистить')}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 4K UHD Cards Grid (Exact same design & colors as Filme / Seriale) */}
                    {isUhdLoading && filteredUhdItems.length === 0 ? (
                      <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
                        <Loader2 className="w-10 h-10 text-white animate-spin" />
                        <span className="text-sm font-medium">
                          {tr(
                            'Se încarcă catalogul...',
                            'Loading catalog...',
                            'Загрузка каталога...'
                          )}
                        </span>
                      </div>
                    ) : filteredUhdItems.length === 0 ? (
                      <div className="py-16 px-6 rounded-2xl bg-[#202020] border border-white/10 text-center space-y-2">
                        <p className="text-base font-bold text-white mb-2">
                          {tr(
                            'Nu s-au găsit titluri',
                            'No titles found',
                            'Ничего не найдено'
                          )}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setUhdSearchQuery('');
                            setUhdMediaFilter('all');
                          }}
                          className="mt-2 h-10 px-5 rounded-xl bg-white text-[#141414] text-xs sm:text-sm font-bold focus:outline-none focus:ring-4 focus:ring-white cursor-pointer"
                        >
                          {tr('Resetează filtrul', 'Reset filter', 'Сбросить фильтр')}
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Shelf 1: Cele mai noi (Primele 12 cele mai noi) */}
                        <div className="space-y-3.5">
                          <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                            {uhdSearchQuery.trim().length > 0
                              ? tr(
                                  `Rezultate pentru „${uhdSearchQuery.trim()}” (${filteredUhdItems.length})`,
                                  `Results for "${uhdSearchQuery.trim()}" (${filteredUhdItems.length})`,
                                  `Результаты для «${uhdSearchQuery.trim()}» (${filteredUhdItems.length})`
                                )
                              : tr(
                                  'În tendințe acum',
                                  'Trending Now',
                                  'Сейчас смотрят'
                                )}
                          </h2>

                          <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-3 sm:gap-4">
                            {(uhdSearchQuery.trim().length > 0
                              ? filteredUhdItems
                              : filteredUhdItems.slice(0, 12)
                            ).map((item) => {
                              const isFav = savedVodItems.some((x) => x.id === item.id);
                              const posterUrl =
                                item.poster ||
                                `https://images.metahub.space/poster/medium/${item.id}/img`;
                              return (
                                <button
                                  key={`uhd-top-${item.id}`}
                                  type="button"
                                  data-vod-card="true"
                                  onFocus={() => handleFocusVodItem(item)}
                                  onMouseEnter={() => handleFocusVodItem(item)}
                                  onClick={() => handleOpenVod(item)}
                                  className="group text-left focus:outline-none cursor-pointer max-w-[220px] w-full"
                                >
                                  <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                    <img
                                      src={posterUrl}
                                      alt={item.name}
                                      loading="lazy"
                                      onError={(e) => {
                                        const fallback = `https://images.metahub.space/poster/medium/${item.id}/img`;
                                        if (e.currentTarget.src !== fallback) {
                                          e.currentTarget.src = fallback;
                                        }
                                      }}
                                      className="w-full h-full object-cover"
                                    />
                                    {(() => {
                                      const rInfo = getVodCardRatingInfo(item);
                                      return (
                                        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 pointer-events-none">
                                          <span className="px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-sm border border-white/15 text-white text-[10px] font-extrabold tracking-tight shadow inline-flex items-center gap-1">
                                            <span className={rInfo.isRussian ? 'text-[#ff5500]' : 'text-amber-400'}>
                                              {rInfo.source}
                                            </span>
                                            <span>{rInfo.value}</span>
                                          </span>
                                          <span
                                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow ${
                                              item.type === 'series'
                                                ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                                                : 'bg-amber-500/90 text-zinc-950'
                                            }`}
                                          >
                                            {item.type === 'series'
                                              ? formatSeriesCardBadgeText(item, seriesEpStatsMap[item.id] || uhdSeriesEpStats[item.id], tr)
                                              : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                    {isFav && (
                                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                        ❤
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-2.5 px-0.5">
                                    <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                      {item.name}
                                    </div>
                                    <div className="text-xs text-zinc-400 mt-0.5">
                                      {formatSeriesCardSubtitleText(item, seriesEpStatsMap[item.id] || uhdSeriesEpStats[item.id], tr)}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Shelf 2: Recomandate pentru tine */}
                        {uhdSearchQuery.trim().length === 0 && filteredUhdItems.length > 12 && (
                          <div className="space-y-3.5 pt-2">
                            <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                              {tr(
                                'Recomandate pentru tine',
                                'Recommended for You',
                                'Рекомендуем посмотреть'
                              )}
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-x-3 sm:gap-x-4 gap-y-5 sm:gap-y-6">
                              {filteredUhdItems.slice(12).map((item) => {
                                const isFav = savedVodItems.some((x) => x.id === item.id);
                                const posterUrl =
                                  item.poster ||
                                  `https://images.metahub.space/poster/medium/${item.id}/img`;
                                return (
                                  <button
                                    key={`uhd-rest-${item.id}`}
                                    type="button"
                                    data-vod-card="true"
                                    onFocus={() => handleFocusVodItem(item)}
                                    onMouseEnter={() => handleFocusVodItem(item)}
                                    onClick={() => handleOpenVod(item)}
                                    className="group w-full block text-left focus:outline-none cursor-pointer"
                                  >
                                    <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                      <img
                                        src={posterUrl}
                                        alt={item.name}
                                        loading="lazy"
                                        onError={(e) => {
                                          const fallback = `https://images.metahub.space/poster/medium/${item.id}/img`;
                                          if (e.currentTarget.src !== fallback) {
                                            e.currentTarget.src = fallback;
                                          }
                                        }}
                                        className="w-full h-full object-cover"
                                      />
                                      {(() => {
                                        const rInfo = getVodCardRatingInfo(item);
                                        return (
                                          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 pointer-events-none">
                                            <span className="px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-sm border border-white/15 text-white text-[10px] font-extrabold tracking-tight shadow inline-flex items-center gap-1">
                                              <span className={rInfo.isRussian ? 'text-[#ff5500]' : 'text-amber-400'}>
                                                {rInfo.source}
                                              </span>
                                              <span>{rInfo.value}</span>
                                            </span>
                                            <span
                                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow ${
                                                item.type === 'series'
                                                  ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                                                  : 'bg-amber-500/90 text-zinc-950'
                                              }`}
                                            >
                                              {item.type === 'series'
                                                ? formatSeriesCardBadgeText(item, seriesEpStatsMap[item.id] || uhdSeriesEpStats[item.id], tr)
                                                : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                      {isFav && (
                                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                          ❤
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-2.5 px-0.5">
                                      <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                        {item.name}
                                      </div>
                                      <div className="text-xs text-zinc-400 mt-0.5">
                                        <span>{formatSeriesCardSubtitleText(item, seriesEpStatsMap[item.id] || uhdSeriesEpStats[item.id], tr)}</span>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* SECTION 1 & 2: DEDICATED LAMPA CATALOG ("Каталог") & FILTER ("Фильтр") RESULTS */}
                {(section === 'catalog' || section === 'filter') && (
                  <div className="space-y-4 pb-16">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                        {section === 'catalog'
                          ? tr('Catalog', 'Catalog', 'Каталог')
                          : tr('Filtru', 'Filter', 'Фильтр')}
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          if (section === 'catalog') {
                            setIsCatalogDrawerOpen(true);
                          } else {
                            setFilterSubMenu(null);
                            setIsFilterDrawerOpen(true);
                          }
                        }}
                        className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#d4d4d4] via-[#ffffff] to-[#c8c8c8] text-[#141414] text-xs sm:text-sm font-medium inline-flex items-center gap-2 shadow cursor-pointer"
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                        <span>
                          {section === 'catalog'
                            ? tr('Deschide Catalog', 'Open Catalog', 'Открыть Каталог')
                            : tr('Configurează Filtru', 'Configure Filter', 'Настроить Фильтр')}
                        </span>
                      </button>
                    </div>

                    {/* Lampa 5-Column Poster Grid */}
                    {isVodLoading ? (
                      <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
                        <Loader2 className="w-10 h-10 text-white animate-spin" />
                        <span className="text-sm font-medium">
                          {tr(
                            'Se încarcă catalogul...',
                            'Loading catalog...',
                            'Загрузка каталога...'
                          )}
                        </span>
                      </div>
                    ) : vodItems.length === 0 ? (
                      <div className="py-16 px-6 rounded-2xl bg-[#202020] border border-white/10 text-center space-y-2">
                        <div className="text-base font-extrabold text-white">
                          {originCountry === 'FAV'
                            ? tr(
                              'Nu ai niciun titlu salvat la Favorite încă',
                              'No saved favorites yet',
                              'В избранном пока ничего нет'
                            )
                            : tr(
                              'Nu s-au găsit titluri pentru acest filtru',
                              'No titles found for this filter',
                              'По этому фильтру ничего не найдено'
                            )}
                        </div>
                        <p className="text-xs text-zinc-400">
                          {originCountry === 'FAV'
                            ? tr(
                              'Deschide orice film sau serial și apasă pe butonul „La Favorite”.',
                              'Open any movie or series and click the Bookmark button.',
                              'Откройте любой фильм или сериал и нажмите «В Избранное».'
                            )
                            : tr(
                              'Alege altă țară sau alt gen din filtrele de sus.',
                              'Choose another country or genre from the filters above.',
                              'Выберите другую страну или жанр в фильтре.'
                            )}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-x-3 sm:gap-x-4 gap-y-5 sm:gap-y-6 pt-1">
                          {vodItems.map((item) => {
                            const isFav = savedVodItems.some(
                              (x) => x.id === item.id
                            );
                            const posterUrl =
                              item.poster ||
                              `https://images.metahub.space/poster/medium/${item.id}/img`;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                data-vod-card="true"
                                onFocus={() => handleFocusVodItem(item)}
                                onMouseEnter={() => handleFocusVodItem(item)}
                                onClick={() => handleOpenVod(item)}
                                className="group w-full block text-left focus:outline-none cursor-pointer"
                              >
                                <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                  <img
                                    src={posterUrl}
                                    alt={item.name}
                                    loading="lazy"
                                    className="w-full h-full object-cover"
                                  />
                                  {(() => {
                                    const rInfo = getVodCardRatingInfo(item);
                                    return (
                                      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 pointer-events-none">
                                        <span className="px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-sm border border-white/15 text-white text-[10px] font-extrabold tracking-tight shadow inline-flex items-center gap-1">
                                          <span className={rInfo.isRussian ? 'text-[#ff5500]' : 'text-amber-400'}>
                                            {rInfo.source}
                                          </span>
                                          <span>{rInfo.value}</span>
                                        </span>
                                        <span
                                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow ${
                                            item.type === 'series'
                                              ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                                              : 'bg-amber-500/90 text-zinc-950'
                                          }`}
                                        >
                                          {item.type === 'series'
                                            ? formatSeriesCardBadgeText(item, seriesEpStatsMap[item.id] || uhdSeriesEpStats[item.id], tr)
                                            : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                  {isFav && (
                                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                      ❤
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2.5 px-0.5">
                                  <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                    {item.name}
                                  </div>
                                  <div className="text-xs text-zinc-400 mt-0.5">
                                    {formatSeriesCardSubtitleText(item, seriesEpStatsMap[item.id] || uhdSeriesEpStats[item.id], tr)}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {hasMoreVod && (
                          <div className="pt-4 flex justify-center">
                            <button
                              type="button"
                              disabled={isLoadingMoreVod}
                              onClick={() => {
                                const next = vodPage + 1;
                                setVodPage(next);
                                void fetchVodCatalog(next, true);
                              }}
                              className="h-11 px-8 rounded-xl bg-gradient-to-r from-[#d4d4d4] via-[#ffffff] to-[#c8c8c8] text-[#141414] focus:outline-none focus:ring-4 focus:ring-white font-semibold text-sm inline-flex items-center gap-2 shadow-lg cursor-pointer"
                            >
                              {isLoadingMoreVod ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  {tr('Se încarcă...', 'Loading...', 'Загрузка...')}
                                </>
                              ) : (
                                <>{tr('Încarcă mai multe', 'Load More', 'Показать ещё')}</>
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* SECTION 3: LIVE TV CHANNELS — FIXED SPLIT-VIEW MODE (AUTO-STARTS FIRST FAVORITE CHANNEL ON LEFT + FIXED CHANNEL GRID ON RIGHT) */}
                {section === 'tv' && <TvPlayerModal inlineEmbeddedMode />}

                {/* SECTION 4: RADIO ONLINE (WITH DEDICATED PLAYER DECK + ARTWORK + SONG INFO + FAVORITES + COUNTRY FILTER) */}
                {section === 'radio' && (
                  <div className="space-y-5 pb-16">
                    {/* DEDICATED SMART TV RADIO PLAYER PANEL ("În aparte cu player, cu poză și info piesă") */}
                    {(() => {
                      const activeStation =
                        currentStation || radioStations[0] || favorites[0] || null;
                      if (!activeStation) return null;
                      const isPlayingCurrent =
                        currentStation?.stationuuid ===
                        activeStation.stationuuid &&
                        playerStatus === 'playing';
                      const isLoadingCurrent =
                        currentStation?.stationuuid ===
                        activeStation.stationuuid &&
                        playerStatus === 'loading';
                      const isFavActive = favorites.some(
                        (f) => f.stationuuid === activeStation.stationuuid
                      );
                      const trackInfo =
                        currentStation?.stationuuid === activeStation.stationuuid
                          ? activeRadioTrack
                          : null;
                      const effectiveVolPct = Math.round(
                        (isMuted ? 0 : volume) * 100
                      );
                      const stationTags = activeStation.tags
                        ? activeStation.tags
                          .split(',')
                          .map((t: string) => t.trim())
                          .filter(Boolean)
                          .slice(0, 4)
                        : [];

                      return (
                        <div
                          data-top-hero-card="true"
                          className="relative rounded-2xl bg-gradient-to-br from-[#0f172a]/90 via-[#141824]/95 to-[#0b1120]/95 border border-blue-500/20 shadow-[0_18px_45px_rgba(0,0,0,0.8)] overflow-hidden p-3.5 sm:p-4 lg:p-5"
                        >
                          {/* Blurred Artwork Ambient Background */}
                          {trackInfo?.coverUrl && (
                            <img
                              src={trackInfo.coverUrl}
                              alt=""
                              aria-hidden="true"
                              className="absolute inset-0 w-full h-full object-cover opacity-20 blur-3xl scale-125 pointer-events-none select-none"
                            />
                          )}
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0c0e14]/90 via-[#111522]/85 to-[#0c0e14]/90" />

                          <div className="relative z-10 flex flex-col md:flex-row items-center gap-4 lg:gap-5 w-full">
                            {/* Left: Station Logo + Spinning Vinyl Disc (ONLY vinyl grooves/sheen spin; center song photo stays upright!) */}
                            <div className="relative flex items-center shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  playStation(activeStation, radioStations);
                                }}
                                title={tr('Redă / Pauză', 'Play / Pause', 'Старт / Пауза')}
                                style={{ borderRadius: '16px' }}
                                className="relative inline-flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28 z-10 group shrink-0 overflow-hidden shadow-[0_12px_30px_rgba(0,0,0,0.85)] ring-1 ring-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                              >
                                <StationAvatar
                                  name={activeStation.name}
                                  favicon={activeStation.favicon}
                                  homepage={activeStation.homepage}
                                  size="lg"
                                  isPlaying={false}
                                  className="!w-full !h-full group-hover:scale-105 transition-transform duration-300"
                                />
                              </button>

                              {/* Vinyl Record: Outer Vinyl Ring Spins, Inner Song Cover Photo Stays Upright & Stationary */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (!trackInfo) {
                                    playStation(activeStation, radioStations);
                                    return;
                                  }
                                  const q = trackInfo.artist
                                    ? `${trackInfo.artist} ${trackInfo.title}`
                                    : trackInfo.title;
                                  window.dispatchEvent(
                                    new CustomEvent('smartcinema:open-music-query', {
                                      detail: {
                                        query: q,
                                        label: trackInfo.artist
                                          ? `${trackInfo.title} — ${trackInfo.artist}`
                                          : trackInfo.title,
                                      },
                                    })
                                  );
                                }}
                                title={
                                  trackInfo
                                    ? tr(
                                        'Ascultă această piesă în Muzică',
                                        'Listen to this song in Music',
                                        'Слушать этот трек в Музыке'
                                      )
                                    : activeStation.name
                                }
                                className="hidden sm:flex -ml-7 w-24 h-24 sm:w-28 sm:h-28 rounded-full shadow-[0_10px_28px_rgba(0,0,0,0.95)] items-center justify-center relative cursor-pointer focus:outline-none overflow-hidden"
                              >
                                {/* Spinning Vinyl Disc Grooves & Light Sheen ONLY */}
                                <div
                                  style={{
                                    background:
                                      'conic-gradient(from 0deg, #09090b 0deg, #27272a 42deg, #09090b 88deg, #09090b 180deg, #27272a 222deg, #09090b 268deg, #09090b 360deg)',
                                  }}
                                  className={`absolute inset-0 rounded-full border-2 border-zinc-700/80 ${
                                    isPlayingCurrent
                                      ? 'animate-[spin_4s_linear_infinite]'
                                      : ''
                                  }`}
                                >
                                  <div className="absolute inset-1.5 rounded-full border border-white/15 pointer-events-none" />
                                  <div className="absolute inset-3 rounded-full border border-dashed border-white/15 pointer-events-none" />
                                  <div className="absolute inset-5 rounded-full border border-amber-400/25 pointer-events-none" />
                                </div>

                                {/* Stationary Upright Song Cover Photo in Center (NEVER spins upside down) */}
                                {trackInfo?.coverUrl || trackInfo?.artistAvatarUrl ? (
                                  <div className="relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-amber-400/70 shadow-lg bg-zinc-900">
                                    <img
                                      src={trackInfo.coverUrl || trackInfo.artistAvatarUrl}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="relative z-10 w-12 h-12 rounded-full bg-zinc-900/95 border border-white/15 flex items-center justify-center">
                                    <Music className="w-5 h-5 text-blue-400" />
                                  </div>
                                )}
                              </button>
                            </div>

                            {/* Right Content: 2 Compact Zero-Waste Rows (Row 1: Station Header + Equalizer | Row 2: Large Artist Photo & Song Info + Controls + Volume) */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between gap-2.5 w-full">
                              {/* ROW 1: Station Name + Inline Badges on Left, Symmetrical Soundwave on Right */}
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                  <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-white tracking-tight truncate max-w-[260px] sm:max-w-[380px]">
                                    {activeStation.name}
                                  </h1>

                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${
                                      isPlayingCurrent
                                        ? 'bg-blue-500/25 text-blue-300 border border-blue-400/40'
                                        : isLoadingCurrent
                                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                          : 'bg-white/10 text-zinc-300 border border-white/10'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        isPlayingCurrent
                                          ? 'bg-blue-400 animate-ping'
                                          : isLoadingCurrent
                                            ? 'bg-amber-400 animate-pulse'
                                            : 'bg-zinc-400'
                                      }`}
                                    />
                                    {isPlayingCurrent
                                      ? tr('ÎN DIRECT • ON AIR', 'LIVE • ON AIR', 'В ЭФИРЕ • ON AIR')
                                      : isLoadingCurrent
                                        ? tr('SE CONECTEAZĂ...', 'CONNECTING...', 'ПОДКЛЮЧЕНИЕ...')
                                        : tr('PREGĂTIT', 'READY', 'ГОТОВО')}
                                  </span>

                                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-zinc-200 text-[11px] font-semibold inline-flex items-center gap-1 shrink-0">
                                    <span>{getCountryFlagEmoji(activeStation.countrycode)}</span>
                                    <span>{activeStation.country || activeStation.countrycode}</span>
                                  </span>

                                  {activeStation.bitrate ? (
                                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold shrink-0">
                                      {activeStation.bitrate} kbps
                                      {activeStation.codec ? ` • ${activeStation.codec.toUpperCase()}` : ''}
                                    </span>
                                  ) : null}

                                  {stationTags.length > 0 && (
                                    <span className="hidden xl:inline text-[11px] text-zinc-400 truncate">
                                      • {stationTags.slice(0, 3).join(' • ')}
                                    </span>
                                  )}
                                </div>

                                {/* Symmetrical Acoustic Soundwave Visualizer */}
                                <div
                                  className="flex items-center gap-[3px] h-6 px-2 shrink-0"
                                  aria-hidden="true"
                                >
                                  {[38, 65, 92, 54, 100, 74, 46, 88, 60, 40].map((peak, i) => (
                                    <span
                                      key={`radio_top_eq_${i}`}
                                      style={{
                                        height: isPlayingCurrent ? `${peak}%` : '22%',
                                        animationDelay: `${i * 0.09}s`,
                                        animationDuration: `${0.48 + (i % 4) * 0.12}s`,
                                      }}
                                      className={`w-[3px] rounded-full transition-all ${
                                        isPlayingCurrent
                                          ? 'bg-gradient-to-b from-amber-300 via-emerald-400 to-cyan-400 shadow-[0_0_8px_rgba(52,211,153,0.45)] eq-bar'
                                          : 'bg-white/15'
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>

                              {/* ROW 2: Unified Zero-Waste Deck — Large Artist Photo + Song Title on Left, Transport & Volume Controls on Right */}
                              <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 w-full">
                                {/* Now Playing Box with Large Upright Artist Photo (56x56 / 64x64) */}
                                <div
                                  style={{ borderRadius: '16px' }}
                                  className="px-3 py-2 bg-black/50 border border-white/10 flex items-center gap-3 min-w-0 xl:max-w-[460px] flex-1 overflow-hidden"
                                >
                                  {trackInfo?.artistAvatarUrl || trackInfo?.coverUrl ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const artistQ =
                                          trackInfo.artist || trackInfo.title;
                                        window.dispatchEvent(
                                          new CustomEvent(
                                            'smartcinema:open-music-query',
                                            {
                                              detail: {
                                                query: artistQ,
                                                label: artistQ,
                                              },
                                            }
                                          )
                                        );
                                      }}
                                      title={tr(
                                        `Vezi toate piesele artistului „${trackInfo.artist || activeStation.name}” în Muzică`,
                                        `View all songs by "${trackInfo.artist || activeStation.name}" in Music`,
                                        `Все треки «${trackInfo.artist || activeStation.name}» в Музыке`
                                      )}
                                      className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-amber-400/50 shadow-lg shrink-0 group/artphoto cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
                                    >
                                      <img
                                        src={
                                          trackInfo.artistAvatarUrl ||
                                          trackInfo.coverUrl
                                        }
                                        alt={trackInfo.artist || trackInfo.title}
                                        className="w-full h-full object-cover group-hover/artphoto:scale-105 transition-transform"
                                      />
                                    </button>
                                  ) : (
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
                                      <Music className="w-6 h-6" />
                                    </div>
                                  )}

                                  <div className="min-w-0 flex-1 flex flex-col justify-center overflow-hidden">
                                    {trackInfo ? (
                                      <>
                                        {/* Top Line: Artist / Author */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const artistQ =
                                              trackInfo.artist || trackInfo.title;
                                            window.dispatchEvent(
                                              new CustomEvent(
                                                'smartcinema:open-music-query',
                                                {
                                                  detail: {
                                                    query: artistQ,
                                                    label: artistQ,
                                                  },
                                                }
                                              )
                                            );
                                          }}
                                          className="text-xs sm:text-sm font-extrabold text-amber-300 hover:text-amber-200 hover:underline truncate text-left cursor-pointer"
                                        >
                                          {trackInfo.artist || activeStation.name}
                                        </button>

                                        {/* Bottom Line: Song Title */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const q = trackInfo.artist
                                              ? `${trackInfo.artist} ${trackInfo.title}`
                                              : trackInfo.title;
                                            window.dispatchEvent(
                                              new CustomEvent(
                                                'smartcinema:open-music-query',
                                                {
                                                  detail: {
                                                    query: q,
                                                    label: trackInfo.artist
                                                      ? `${trackInfo.title} — ${trackInfo.artist}`
                                                      : trackInfo.title,
                                                  },
                                                }
                                              )
                                            );
                                          }}
                                          className="text-sm sm:text-base font-black text-white hover:text-amber-300 hover:underline truncate text-left cursor-pointer mt-0.5"
                                        >
                                          {trackInfo.title}
                                        </button>
                                      </>
                                    ) : (
                                      <div className="min-w-0">
                                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">
                                          {tr('Piesa în curs', 'Now Playing', 'Сейчас играет')}
                                        </div>
                                        <div className="text-xs sm:text-sm font-bold text-zinc-200 truncate mt-0.5">
                                          {currentStation?.stationuuid ===
                                            activeStation.stationuuid && nowPlayingTitle
                                            ? nowPlayingTitle
                                            : isPlayingCurrent
                                              ? `${tr('Transmisiune Live', 'Live Broadcast', 'Прямой эфир')} — ${activeStation.name}`
                                              : tr(
                                                  'Selectează Play pentru a asculta live',
                                                  'Select Play to listen live',
                                                  'Нажмите Play для прямого эфира'
                                                )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Transport Buttons, Actions & Volume Bar on the Right of the Same Row */}
                                <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2 shrink-0">
                                {/* Left Group: Play/Pause + Prev/Next + Favorite + PiP + Player Mare */}
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      playStation(activeStation, radioStations);
                                    }}
                                    className={`h-9 px-4 rounded-full font-extrabold text-xs inline-flex items-center gap-1.5 shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer shrink-0 ${
                                      isPlayingCurrent
                                        ? 'bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white border border-blue-400/40'
                                        : 'bg-white text-[#0f172a] hover:bg-zinc-200'
                                    }`}
                                  >
                                    {isLoadingCurrent ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : isPlayingCurrent ? (
                                      <Pause className="w-3.5 h-3.5 fill-current" />
                                    ) : (
                                      <Play className="w-3.5 h-3.5 fill-current" />
                                    )}
                                    <span>
                                      {isPlayingCurrent
                                        ? tr('Pauză', 'Pause', 'Пауза')
                                        : tr('Play Live', 'Play Live', 'Play Live')}
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={playPreviousStation}
                                    title={tr('Postul anterior', 'Previous station', 'Предыдущая станция')}
                                    className="w-8 h-8 rounded-full bg-white/[0.07] border border-white/10 hover:bg-white hover:text-[#0f172a] focus:bg-white focus:text-[#0f172a] focus:outline-none text-zinc-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                  >
                                    <SkipBack className="w-3.5 h-3.5 fill-current" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={playNextAvailableStation}
                                    title={tr('Postul următor', 'Next station', 'Следующая станция')}
                                    className="w-8 h-8 rounded-full bg-white/[0.07] border border-white/10 hover:bg-white hover:text-[#0f172a] focus:bg-white focus:text-[#0f172a] focus:outline-none text-zinc-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                  >
                                    <SkipForward className="w-3.5 h-3.5 fill-current" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => toggleFavorite(activeStation)}
                                    title={
                                      isFavActive
                                        ? tr('Elimină de la Favorite', 'Remove from Favorites', 'Удалить из избранного')
                                        : tr('Adaugă la Favorite', 'Add to Favorites', 'В избранное')
                                    }
                                    className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors focus:outline-none focus:ring-2 focus:ring-white cursor-pointer shrink-0 ${
                                      isFavActive
                                        ? 'bg-rose-500/90 border-rose-400/50 text-white shadow-sm'
                                        : 'bg-white/[0.07] border-white/10 text-zinc-300 hover:bg-white hover:text-[#0f172a]'
                                    }`}
                                  >
                                    <Heart
                                      className={`w-3.5 h-3.5 ${isFavActive ? 'fill-current' : ''}`}
                                    />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        currentStation?.stationuuid !==
                                        activeStation.stationuuid
                                      ) {
                                        playStation(activeStation, radioStations);
                                      }
                                      window.setTimeout(() => {
                                        void toggleRadioPip();
                                      }, 60);
                                    }}
                                    title={tr(
                                      'MiniPlayer Picture-in-Picture (fereastră flotantă în afara paginii)',
                                      'Picture-in-Picture MiniPlayer (floating window outside page)',
                                      'Мини-плеер Картинка-в-картинке'
                                    )}
                                    className="w-8 h-8 rounded-full bg-white/[0.07] border border-white/10 hover:bg-white hover:text-[#0f172a] focus:bg-white focus:text-[#0f172a] focus:outline-none text-zinc-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                  >
                                    <PictureInPicture2 className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        currentStation?.stationuuid !==
                                        activeStation.stationuuid
                                      ) {
                                        playStation(activeStation, radioStations);
                                      }
                                      setIsTvRadioPlayerOpen(true);
                                    }}
                                    title={tr('Deschide Playerul Radio pe tot ecranul', 'Open Fullscreen Radio Player', 'Открыть плеер на весь экран')}
                                    className="h-8 px-3.5 rounded-full bg-white/[0.07] border border-white/10 hover:bg-white hover:text-[#0f172a] focus:bg-white focus:text-[#0f172a] focus:outline-none text-zinc-100 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                                  >
                                    <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                                    <span className="whitespace-nowrap">
                                      {tr('Player Mare', 'Full Player', 'Плеер')}
                                    </span>
                                  </button>
                                </div>

                                {/* Right Group on the SAME Row: Compact Volume Control Pill */}
                                <div className="flex items-center gap-2 bg-white/[0.06] px-3 py-1.5 rounded-full border border-white/10 shrink-0">
                                  <button
                                    type="button"
                                    onClick={toggleMute}
                                    title={isMuted ? 'Activează sunetul' : 'Mut'}
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-zinc-300 hover:text-white focus:outline-none shrink-0 cursor-pointer"
                                  >
                                    {isMuted || volume === 0 ? (
                                      <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                                    ) : (
                                      <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVolume(Math.max(0, Number((volume - 0.1).toFixed(2))))
                                    }
                                    className="w-5 h-5 rounded-full bg-white/10 hover:bg-white hover:text-[#0f172a] text-xs font-bold flex items-center justify-center shrink-0 cursor-pointer"
                                  >
                                    −
                                  </button>
                                  <input
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.02}
                                    value={isMuted ? 0 : volume}
                                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                                    aria-label="Volum Radio"
                                    className="w-20 sm:w-24 accent-blue-500 h-1.5 rounded-full cursor-pointer"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVolume(Math.min(1, Number((volume + 0.1).toFixed(2))))
                                    }
                                    className="w-5 h-5 rounded-full bg-white/10 hover:bg-white hover:text-[#0f172a] text-xs font-bold flex items-center justify-center shrink-0 cursor-pointer"
                                  >
                                    +
                                  </button>
                                  <span className="text-[11px] font-extrabold text-zinc-200 w-8 text-right tabular-nums shrink-0">
                                    {effectiveVolPct}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      );
                    })()}

                    {/* Dedicated Radio Search Bar + Expandable On-Screen TV Remote Keyboard */}
                    <div className="p-3.5 rounded-2xl bg-[#1c1c1c] border border-white/15 shadow-lg space-y-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="flex-1 min-w-[220px] h-11 px-4 rounded-xl bg-[#121212] border-2 border-white/15 focus-within:border-[#60a5fa] flex items-center gap-3">
                          <Search className="w-5 h-5 text-[#60a5fa] shrink-0" />
                          <input
                            ref={radioSearchInputRef}
                            type="text"
                            value={radioSearchQuery}
                            onChange={(e) => setRadioSearchQuery(e.target.value)}
                            placeholder={tr(
                              'Caută post radio după nume sau gen (ex: Kiss FM, Europa FM, Rock, Dance)...',
                              'Search radio station by name or genre (e.g. Kiss FM, Europa FM, Rock, Dance)...',
                              'Поиск радиостанции по названию или жанру (например: Kiss FM, Rock, Dance)...'
                            )}
                            className="flex-1 min-w-0 bg-transparent text-sm sm:text-base font-bold text-white placeholder:text-zinc-500 placeholder:font-normal focus:outline-none select-text"
                          />
                          {radioSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setRadioSearchQuery('')}
                              className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 focus:bg-white focus:text-[#141414] focus:outline-none text-xs font-extrabold text-zinc-200 shrink-0 cursor-pointer"
                            >
                              ✕ {tr('Șterge', 'Clear', 'Сброс')}
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsRadioKeyboardOpen((prev) => !prev)}
                          className={`h-11 px-4 rounded-xl text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 border-2 transition-all focus:outline-none focus:ring-4 focus:ring-white cursor-pointer ${isRadioKeyboardOpen
                              ? 'bg-[#1e3a8a] text-white border border-[#3b82f6]/50 border-[#bfdbfe] shadow-lg'
                              : 'bg-[#262626] hover:bg-[#323232] focus:bg-[#1e3a8a] focus:text-white text-white border-white/15'
                            }`}
                        >
                          <Search className="w-4 h-4" />
                          <span>
                            {isRadioKeyboardOpen
                              ? tr('▲ Ascunde Tastatura TV', '▲ Hide TV Keyboard', '▲ Скрыть клавиатуру')
                              : tr('⌨ Tastatură TV (Telecomandă)', '⌨ TV Remote Keyboard', '⌨ Экранная клавиатура')}
                          </span>
                        </button>

                        {isRadioKeyboardOpen && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setKeyboardAlphabet((prev) =>
                                  prev === 'LAT' ? 'CYR' : 'LAT'
                                )
                              }
                              className="h-11 px-3.5 rounded-xl bg-[#262626] hover:bg-[#323232] focus:bg-white focus:text-[#141414] focus:outline-none text-white text-xs sm:text-sm font-bold border border-white/10 cursor-pointer"
                            >
                              {keyboardAlphabet === 'LAT'
                                ? 'АБВ (Chirilice RU)'
                                : 'ABC (Latine RO/EN)'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRadioSearchQuery((q) => q + ' ')}
                              className="h-11 px-4 rounded-xl bg-[#262626] hover:bg-[#323232] focus:bg-white focus:text-[#141414] focus:outline-none text-white text-xs sm:text-sm font-bold border border-white/10 cursor-pointer"
                            >
                              Spațiu
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setRadioSearchQuery((q) => q.slice(0, -1))
                              }
                              className="h-11 px-3.5 rounded-xl bg-[#262626] hover:bg-[#323232] focus:bg-rose-600 focus:text-white focus:outline-none text-rose-400 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 border border-white/10 cursor-pointer"
                            >
                              <Delete className="w-4 h-4" />
                              <span>Șterge</span>
                            </button>
                          </>
                        )}
                      </div>

                      {isRadioKeyboardOpen && (
                        <div className="grid grid-cols-9 sm:grid-cols-12 gap-1.5 pt-1">
                          {(keyboardAlphabet === 'LAT'
                            ? ON_SCREEN_KEYS_LATIN
                            : ON_SCREEN_KEYS_CYRILLIC
                          ).map((ch) => (
                            <button
                              key={`radio_kb_${ch}`}
                              type="button"
                              onClick={() => setRadioSearchQuery((q) => q + ch)}
                              className="h-10 rounded-xl bg-[#141414] hover:bg-white hover:text-[#141414] focus:bg-[#1e3a8a] focus:text-white focus:ring-2 focus:ring-white focus:outline-none text-white font-bold text-sm transition-colors border border-white/10 cursor-pointer"
                            >
                              {ch}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {RADIO_COUNTRIES.map((rc) => {
                        const active = radioCountry === rc.code;
                        return (
                          <button
                            key={rc.code}
                            type="button"
                            onClick={() => setRadioCountry(rc.code)}
                            className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs sm:text-sm whitespace-nowrap shrink-0 transition-all focus:outline-none cursor-pointer ${active
                                ? 'bg-gradient-to-r from-[#d4d4d4] via-[#ffffff] to-[#c8c8c8] text-[#141414] font-semibold shadow-md'
                                : 'bg-[#222222] hover:bg-[#2c2c2c] focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] text-zinc-300 border border-white/5'
                              }`}
                          >
                            {tr(rc.label, rc.labelEn, rc.labelRu)}
                            {rc.code === 'FAV' ? ` (${favorites.length})` : ''}
                          </button>
                        );
                      })}
                    </div>

                    {isRadioLoading ? (
                      <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
                        <Loader2 className="w-10 h-10 text-white animate-spin" />
                        <span className="text-sm font-bold">
                          Se încarcă posturile radio...
                        </span>
                      </div>
                    ) : (() => {
                      const qRadio = radioSearchQuery.trim().toLowerCase();
                      const filteredRadio = (
                        qRadio
                          ? (() => {
                            const combined = [...radioStations, ...favorites];
                            const seen = new Set<string>();
                            return combined.filter((s) => {
                              if (seen.has(s.stationuuid)) return false;
                              seen.add(s.stationuuid);
                              return true;
                            });
                          })()
                          : radioStations
                      ).filter((s) => {
                        if (!qRadio) return true;
                        return (
                          s.name.toLowerCase().includes(qRadio) ||
                          (s.tags || '').toLowerCase().includes(qRadio) ||
                          (s.country || '').toLowerCase().includes(qRadio)
                        );
                      });

                      if (filteredRadio.length === 0) {
                        return (
                          <div className="py-16 px-6 rounded-2xl bg-[#202020] border border-white/10 text-center space-y-2">
                            <div className="text-base font-extrabold text-white">
                              {qRadio
                                ? `Niciun post radio găsit pentru «${radioSearchQuery.trim()}»`
                                : radioCountry === 'FAV'
                                  ? 'Nu ai niciun post Radio adăugat la Favorite încă'
                                  : 'Niciun post radio găsit pentru această țară'}
                            </div>
                            <p className="text-xs text-zinc-400">
                              Apasă pe inima ❤ din dreptul oricărui post radio pentru a-l salva la Favorite.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
                          {filteredRadio.map((st) => {
                            const isPlayingThis =
                              currentStation?.stationuuid === st.stationuuid &&
                              playerStatus === 'playing';
                            const isFavRadio = favorites.some(
                              (f) => f.stationuuid === st.stationuuid
                            );
                            const stTrack =
                              isPlayingThis && activeRadioTrack
                                ? activeRadioTrack
                                : stationLiveTracks[st.stationuuid];
                            return (
                              <div
                                key={st.stationuuid}
                                className={`relative rounded-2xl border-2 transition-all flex items-center shadow-md overflow-hidden ${isPlayingThis
                                    ? 'bg-white/15 border-white'
                                    : 'bg-[#222222] border-white/10 hover:border-white/50'
                                  }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsTvRadioPlayerOpen(false);
                                    playStation(st, filteredRadio);
                                  }}
                                  className="flex-1 min-w-0 p-3.5 flex items-center gap-3 text-left focus:outline-none focus:bg-white/15 focus:ring-4 focus:ring-inset focus:ring-white cursor-pointer"
                                >
                                  <StationAvatar
                                    name={st.name}
                                    favicon={st.favicon}
                                    homepage={st.homepage}
                                    size="sm"
                                    isPlaying={false}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                                        {st.name}
                                      </span>
                                      {isPlayingThis && (
                                        <span className="inline-flex items-end gap-0.5 h-3.5 shrink-0">
                                          <span className="w-0.5 h-full bg-amber-400 eq-bar rounded-full" />
                                          <span className="w-0.5 h-2.5 bg-amber-400 eq-bar eq-bar-2 rounded-full" />
                                          <span className="w-0.5 h-3.5 bg-amber-400 eq-bar eq-bar-3 rounded-full" />
                                          <span className="w-0.5 h-2 bg-amber-400 eq-bar rounded-full" />
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-zinc-400 truncate mt-0.5 flex items-center gap-1.5">
                                      {stTrack ? (
                                        <>
                                          {stTrack.coverUrl ? (
                                            <img
                                              src={stTrack.coverUrl}
                                              alt=""
                                              className="w-7 h-7 rounded-md object-cover shrink-0 border border-white/20 shadow-sm"
                                            />
                                          ) : (
                                            <span className="shrink-0">🎵</span>
                                          )}
                                          <span className="text-blue-300 font-semibold truncate">
                                            {stTrack.artist
                                              ? `${stTrack.artist} - ${stTrack.title}`
                                              : stTrack.title}
                                          </span>
                                        </>
                                      ) : isPlayingThis ? (
                                        <span className="text-blue-300 font-semibold truncate">
                                          ▶ {tr('Se redă acum', 'Playing now', 'Сейчас играет')}
                                        </span>
                                      ) : (
                                        <span className="truncate">{st.tags || 'Live Radio'}</span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  title={
                                    isFavRadio
                                      ? 'Elimină de la Favorite'
                                      : 'Adaugă la Favorite'
                                  }
                                  onClick={() => toggleFavorite(st)}
                                  className={`h-full px-3 py-3.5 flex items-center justify-center border-l border-white/10 transition-colors focus:outline-none focus:ring-4 focus:ring-inset focus:ring-white cursor-pointer ${isFavRadio
                                      ? 'text-rose-500 bg-rose-500/10 hover:bg-rose-500/20'
                                      : 'text-zinc-500 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                  <Heart
                                    className={`w-4 h-4 ${isFavRadio ? 'fill-rose-500' : ''
                                      }`}
                                  />
                                </button>
                                {stTrack && (
                                  <div className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500/30">
                                    <div
                                      className={`h-full bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] ${
                                        isPlayingThis ? 'w-full' : 'w-2/3'
                                      }`}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* SECTION 5: SMART TV SEARCH WITH BOTH PC KEYBOARD INPUT & ON-SCREEN REMOTE KEYBOARD */}
                {section === 'search' && (
                  <div className="space-y-5 pb-16">
                    <div className="p-5 rounded-2xl bg-[#202020] border border-white/10 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex-1 min-w-[240px] h-12 px-4 rounded-xl bg-[#141414] border border-white/20 focus-within:border-white flex items-center justify-between gap-3">
                          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={tr(
                              'Scrie de la tastatură sau folosește tastatura TV de mai jos...',
                              'Type from keyboard or use the on-screen TV keyboard below...',
                              'Введите запрос или используйте экранную клавиатуру ниже...'
                            )}
                            autoFocus
                            className="flex-1 min-w-0 bg-transparent text-base sm:text-lg font-bold text-white placeholder:text-zinc-500 placeholder:font-normal focus:outline-none select-text"
                          />
                          {searchQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchQuery('')}
                              className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 focus:bg-white focus:text-zinc-950 focus:outline-none text-xs font-bold text-zinc-300 shrink-0 cursor-pointer"
                            >
                              Șterge tot
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setKeyboardAlphabet((prev) =>
                                prev === 'LAT' ? 'CYR' : 'LAT'
                              )
                            }
                            className="h-11 px-4 rounded-xl bg-[#2a2a2a] hover:bg-[#343434] focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] focus:outline-none text-white text-xs sm:text-sm font-bold border border-white/10 cursor-pointer"
                          >
                            {keyboardAlphabet === 'LAT'
                              ? 'АБВ (Chirilice RU)'
                              : 'ABC (Latine RO/EN)'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSearchQuery((q) => q + ' ')}
                            className="h-11 px-5 rounded-xl bg-[#2a2a2a] hover:bg-[#343434] focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] focus:outline-none text-white text-xs sm:text-sm font-bold border border-white/10 cursor-pointer"
                          >
                            Spațiu
                          </button>
                          <button
                            type="button"
                            onClick={() => setSearchQuery((q) => q.slice(0, -1))}
                            className="h-11 px-4 rounded-xl bg-[#2a2a2a] hover:bg-[#343434] focus:bg-rose-600 focus:text-white focus:outline-none text-rose-400 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 border border-white/10 cursor-pointer"
                          >
                            <Delete className="w-4 h-4" />
                            Șterge
                          </button>
                        </div>
                      </div>

                      {/* On-Screen TV Remote Keys Grid */}
                      <div className="grid grid-cols-9 sm:grid-cols-12 gap-1.5">
                        {(keyboardAlphabet === 'LAT'
                          ? ON_SCREEN_KEYS_LATIN
                          : ON_SCREEN_KEYS_CYRILLIC
                        ).map((ch) => (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => setSearchQuery((q) => q + ch)}
                            className="h-11 rounded-xl bg-[#141414] hover:bg-white hover:text-[#141414] focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] focus:outline-none text-white font-bold text-sm transition-colors border border-white/10 cursor-pointer"
                          >
                            {ch}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
                        <span className="text-xs text-zinc-400">
                          {tr(
                            'Vrei să cauți direct în trackerul FileList.io (4K / 1080p / RO)?',
                            'Want to search directly on FileList.io tracker (4K / 1080p / RO)?',
                            'Искать напрямую в торрентах FileList.io (4K / 1080p / RO)?'
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (searchQuery.trim()) {
                              setFlSearchQuery(searchQuery.trim());
                            }
                            setSection('torrents');
                          }}
                          className="h-9 px-4 rounded-full bg-[#1e3a8a] text-white border border-[#3b82f6]/50 font-extrabold text-xs inline-flex items-center gap-1.5 hover:bg-[#bfdbfe] focus:bg-white focus:outline-none cursor-pointer shadow"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>
                            {searchQuery.trim()
                              ? tr(
                                  `Caută „${searchQuery.trim()}” în Torrente FL →`,
                                  `Search "${searchQuery.trim()}" in FL Torrents →`,
                                  `Искать «${searchQuery.trim()}» в Торрентах FL →`
                                )
                              : tr(
                                  'Deschide Căutare Torrente FL →',
                                  'Open FL Torrents Search →',
                                  'Открыть поиск торрентов FL →'
                                )}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Live TV Channels matching global searchQuery */}
                    {(() => {
                      const qGlobal = searchQuery.trim().toLowerCase();
                      if (qGlobal.length < 2) return null;
                      const combined = [
                        ...tvChannels,
                        ...customTvChannels,
                        ...favoriteTvChannels,
                      ];
                      const seen = new Set<string>();
                      const matchedTv = combined
                        .filter((ch) => {
                          if (!adultContentEnabled && isAdultTvChannel(ch))
                            return false;
                          const key = `${ch.name.toLowerCase().trim()}|${ch.url}`;
                          if (seen.has(ch.id) || seen.has(key)) return false;
                          if (
                            !ch.name.toLowerCase().includes(qGlobal) &&
                            !(ch.group || '').toLowerCase().includes(qGlobal)
                          ) {
                            return false;
                          }
                          seen.add(ch.id);
                          seen.add(key);
                          return true;
                        })
                        .slice(0, 24);

                      if (matchedTv.length === 0) return null;
                      return (
                        <div className="space-y-3">
                          <div className="text-sm font-extrabold text-[#60a5fa] uppercase tracking-wider inline-flex items-center gap-2">
                            <Tv className="w-4 h-4" />
                            <span>Canale TV găsite ({matchedTv.length})</span>
                          </div>
                          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
                            {matchedTv.map((ch) => (
                              <button
                                key={`global_tv_${ch.id}`}
                                type="button"
                                onClick={() => {
                                  requestTvFullscreen();
                                  setActiveTvPlaylistContext(
                                    ch.countryCode || "RO",
                                    "ALL"
                                  );
                                  playTvChannel(ch, matchedTv);
                                }}
                                className="p-3.5 rounded-2xl bg-zinc-900/90 border-2 border-white/10 hover:border-[#60a5fa] focus:border-[#60a5fa] focus:bg-[#60a5fa]/15 focus:ring-4 focus:ring-white focus:outline-none flex items-center gap-3 text-left transition-all cursor-pointer"
                              >
                                <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 relative">
                                  <span className="text-[11px] font-black text-amber-400 uppercase tracking-tighter select-none">
                                    {ch.name
                                      .replace(/[^a-zA-Zа-яА-Я0-9]/g, '')
                                      .slice(0, 3) || 'TV'}
                                  </span>
                                  {ch.logo && (
                                    <img
                                      src={ch.logo}
                                      alt=""
                                      loading="lazy"
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                      className="absolute inset-0 w-full h-full object-contain p-1 bg-zinc-950"
                                    />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                                    {ch.name}
                                  </div>
                                  <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                                    {ch.countryCode} • {ch.group || 'Live HD'}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Search Results Grid (5 per row Lampa style) */}
                    {isSearchLoading ? (
                      <div className="py-12 flex items-center justify-center gap-3 text-zinc-400">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                        <span className="text-sm font-bold">{tr('Se caută...', 'Searching...', 'Поиск...')}</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-x-3 sm:gap-x-4 gap-y-5 sm:gap-y-6">
                        {searchResults.map((item) => {
                          const posterUrl =
                            item.poster ||
                            `https://images.metahub.space/poster/medium/${item.id}/img`;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              data-vod-card="true"
                              onClick={() => handleOpenVod(item)}
                              className="group w-full block text-left focus:outline-none cursor-pointer"
                            >
                              <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all">
                                <img
                                  src={posterUrl}
                                  alt={item.name}
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                                {(() => {
                                  const rInfo = getVodCardRatingInfo(item);
                                  return (
                                    <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 pointer-events-none">
                                      <span className="px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-sm border border-white/15 text-white text-[10px] font-extrabold tracking-tight shadow inline-flex items-center gap-1">
                                        <span className={rInfo.isRussian ? 'text-[#ff5500]' : 'text-amber-400'}>
                                          {rInfo.source}
                                        </span>
                                        <span>{rInfo.value}</span>
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow ${
                                          item.type === 'series'
                                            ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                                            : 'bg-amber-500/90 text-zinc-950'
                                        }`}
                                      >
                                        {item.type === 'series'
                                          ? formatSeriesCardBadgeText(item, seriesEpStatsMap[item.id] || uhdSeriesEpStats[item.id], tr)
                                          : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>
                              <div className="mt-2.5 px-0.5">
                                <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                  {item.name}
                                </div>
                                <div className="text-xs text-zinc-400 mt-0.5">
                                  {formatSeriesCardSubtitleText(item, seriesEpStatsMap[item.id] || uhdSeriesEpStats[item.id], tr)}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* SECTION 5A: YOUTUBE PREMIUM AD-FREE SMART TV MODULE */}
                {section === 'youtube' && (
                  <div className="space-y-4 pb-16">
                    {/* Horizontal Platform Switcher Dock */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {STREAMING_PLATFORMS.map((plat) => (
                        <button
                          key={plat.id}
                          type="button"
                          onClick={() => {
                            setPlatformMediaTab('series');
                            setSection(plat.id);
                          }}
                          className="h-10 pl-2 pr-4 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-2.5 shrink-0 transition-all bg-white/[0.06] hover:bg-white/[0.14] text-zinc-200 border border-white/15 focus:outline-none focus:ring-4 focus:ring-white cursor-pointer"
                        >
                          <StreamingPlatformLogo
                            platformId={plat.id}
                            size="sm"
                          />
                          <span>{plat.label}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSection('youtube')}
                        className="h-10 pl-2 pr-4 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-2.5 shrink-0 transition-all bg-white text-[#141414] shadow-lg scale-[1.02] focus:outline-none focus:ring-4 focus:ring-white cursor-pointer"
                      >
                        <StreamingPlatformLogo
                          platformId="youtube"
                          size="sm"
                        />
                        <span>YouTube Premium</span>
                      </button>
                    </div>

                    {/* YouTube Premium Header Banner */}
                    <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#FF0033]/25 via-[#FF0033]/5 to-transparent border border-white/15 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                      <div className="flex items-center gap-3.5">
                        <span className="h-11 px-4 rounded-2xl text-sm sm:text-base font-black tracking-tight inline-flex items-center justify-center gap-1.5 shadow-lg bg-[#FF0033] text-white">
                          <span>▶</span>
                          <span>YT PREMIUM</span>
                        </span>
                        <div>
                          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                            <span>YouTube Premium TV</span>
                            <span className="px-2.5 py-0.5 rounded-full bg-[#1e3a8a] text-white border border-[#3b82f6]/50 text-[10px] font-black uppercase tracking-wider">
                              FĂRĂ RECLAME • 1080p HD
                            </span>
                          </h2>
                          <p className="text-xs text-zinc-300 mt-0.5">
                            {tr(
                              'Redare directă 1080p Full HD fără nicio reclamă • Caută orice videoclip, podcast, muzică sau film complet.',
                              'Direct 1080p Full HD playback with zero ads • Search any video, podcast, music or full movie.',
                              'Прямое воспроизведение 1080p Full HD без рекламы • Ищите любые видео, подкасты, музыку или фильмы.'
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Category Pills */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {YOUTUBE_CATEGORIES.map((cat) => {
                        const isCatActive =
                          ytCategory === cat.id && !ytSearchQuery.trim();
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setYtSearchQuery('');
                              setYtCategory(cat.id);
                            }}
                            className={`h-10 px-4 rounded-full text-xs sm:text-sm font-extrabold shrink-0 transition-all focus:outline-none focus:ring-4 focus:ring-white cursor-pointer ${isCatActive
                                ? 'bg-[#FF0033] text-white shadow-md'
                                : 'bg-white/[0.07] hover:bg-white/[0.15] focus:bg-white focus:text-[#141414] text-zinc-200 border border-white/10'
                              }`}
                          >
                            {cat.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Search Bar + On-Screen TV Remote Keyboard */}
                    <div className="p-3 sm:p-4 rounded-[28px] tahoe-glass border border-white/10 space-y-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="flex-1 min-w-[220px] h-11 px-4 rounded-full bg-black/40 border border-white/15 focus-within:border-[#FF0033] flex items-center gap-2.5">
                          <Search className="w-4 h-4 text-[#FF0033] shrink-0" />
                          <input
                            type="text"
                            value={ytSearchQuery}
                            onChange={(e) => setYtSearchQuery(e.target.value)}
                            placeholder={tr(
                              'Caută pe YouTube Premium (ex: Micutzu, Buzdugan, Smiley, Podcast, Stand-Up, 4K)...',
                              'Search YouTube Premium (music, podcasts, stand-up, 4K)...',
                              'Поиск в YouTube Premium...'
                            )}
                            className="flex-1 min-w-0 bg-transparent text-sm sm:text-base font-bold text-white placeholder:text-zinc-500 placeholder:font-normal focus:outline-none select-text"
                          />
                          {ytSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setYtSearchQuery('')}
                              className="px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 focus:bg-white focus:text-zinc-950 text-xs font-extrabold text-zinc-200 shrink-0 cursor-pointer"
                            >
                              {tr('Șterge', 'Clear', 'Сброс')}
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsYtKeyboardOpen((prev) => !prev)}
                          className={`h-11 px-4 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 border transition-all focus:outline-none focus:ring-4 focus:ring-white cursor-pointer ${isYtKeyboardOpen
                              ? 'bg-[#FF0033] text-white border-[#FF0033]'
                              : 'bg-white/[0.06] hover:bg-white/[0.12] text-zinc-100 border-white/15'
                            }`}
                        >
                          <Search className="w-4 h-4" />
                          <span>
                            {isYtKeyboardOpen
                              ? tr('Ascunde Tastatura TV', 'Hide TV Keyboard', 'Скрыть клавиатуру')
                              : tr('Tastatură Telecomandă TV', 'TV Remote Keyboard', 'Экранная клавиатура')}
                          </span>
                        </button>
                      </div>

                      {isYtKeyboardOpen && (
                        <div className="pt-2 border-t border-white/10 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#60a5fa]">
                              {tr(
                                'Tastează cu telecomanda TV pentru a căuta pe YouTube Premium:',
                                'Type with the TV remote to search YouTube Premium:',
                                'Введите запрос с пульта ТВ:'
                              )}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setYtSearchQuery((q) => q + ' ')}
                                className="h-9 px-4 rounded-lg bg-[#2a2a2a] hover:bg-[#343434] focus:bg-[#1e3a8a] focus:text-white text-white text-xs font-bold border border-white/10 cursor-pointer"
                              >
                                {tr('Spațiu', 'Space', 'Пробел')}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setYtSearchQuery((q) => q.slice(0, -1))
                                }
                                className="h-9 px-3.5 rounded-lg bg-[#2a2a2a] hover:bg-[#343434] focus:bg-rose-600 focus:text-white text-rose-400 text-xs font-bold inline-flex items-center gap-1 border border-white/10 cursor-pointer"
                              >
                                <Delete className="w-3.5 h-3.5" />
                                <span>{tr('Șterge', 'Backspace', 'Стереть')}</span>
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-9 sm:grid-cols-12 gap-1.5">
                            {ON_SCREEN_KEYS_LATIN.map((ch) => (
                              <button
                                key={`yt_key_${ch}`}
                                type="button"
                                onClick={() => setYtSearchQuery((q) => q + ch)}
                                className="h-10 rounded-lg bg-[#141414] hover:bg-white hover:text-[#141414] focus:bg-[#1e3a8a] focus:text-white text-white font-extrabold text-xs sm:text-sm transition-colors border border-white/10 cursor-pointer"
                              >
                                {ch}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* YouTube Premium 16:9 Widescreen Video Grid */}
                    {isYtLoading ? (
                      <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-300">
                        <Loader2 className="w-10 h-10 text-[#FF0033] animate-spin" />
                        <p className="text-sm font-bold">
                          {tr(
                            'Se încarcă videoclipurile YouTube Premium (1080p • Fără Reclame)...',
                            'Loading YouTube Premium videos (1080p • Ad-Free)...',
                            'Загрузка видео YouTube Premium (1080p • Без рекламы)...'
                          )}
                        </p>
                      </div>
                    ) : ytItems.length === 0 ? (
                      <div className="p-8 rounded-2xl bg-[#202020] border border-white/10 text-center text-sm text-zinc-400">
                        {tr(
                          'Niciun videoclip găsit pe YouTube pentru această căutare.',
                          'No YouTube videos found for this search.',
                          'Видео на YouTube не найдены.'
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {ytItems.map((yt) => (
                          <button
                            key={`yt_card_${yt.videoId}`}
                            type="button"
                            data-vod-card="true"
                            onClick={() => handlePlayYouTubeVideo(yt)}
                            className="group text-left focus:outline-none cursor-pointer flex flex-col"
                          >
                            <div className="aspect-video w-full rounded-2xl bg-[#1e1e1e] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                              <img
                                src={yt.thumb}
                                alt={yt.title}
                                loading="lazy"
                                onError={(e) => {
                                  const fallback = `https://i.ytimg.com/vi/${yt.videoId}/hqdefault.jpg`;
                                  if (e.currentTarget.src !== fallback) {
                                    e.currentTarget.src = fallback;
                                  }
                                }}
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-[#FF0033] text-white text-[10px] font-black uppercase tracking-wider shadow">
                                ▶ PREMIUM
                              </span>
                              {yt.duration && (
                                <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/85 text-white text-xs font-extrabold tabular-nums shadow">
                                  {yt.duration}
                                </span>
                              )}
                            </div>
                            <div className="mt-2.5 px-0.5 space-y-1">
                              <div className="text-sm sm:text-[15px] font-bold text-zinc-100 group-focus:text-[#60a5fa] leading-snug line-clamp-2">
                                {yt.title}
                              </div>
                              <div className="text-xs text-zinc-400 flex items-center justify-between gap-2">
                                <span className="font-semibold text-zinc-300 truncate">
                                  {yt.channel}
                                </span>
                                <span className="shrink-0 text-[11px] text-zinc-400">
                                  {[yt.views, yt.published]
                                    .filter(Boolean)
                                    .join(' • ')}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SECTION 5B: FILELIST.IO LIVE TORRENTS CATALOG ("Торренты FileList") + HIDDEN KLUBNICHKA 18+ FOR JEKA */}
                {section === 'torrents' && (
                  isKlubnichkaOpen && isAdminJekaProfile(activeProfile) ? (
                    <SmartTvKlubnichkaSection
                      tr={tr}
                      uiLang={
                        activeProfile?.uiLang === 'ru'
                          ? 'ru'
                          : activeProfile?.uiLang === 'en'
                            ? 'en'
                            : 'ro'
                      }
                      onExitKlubnichka={() => {
                        setIsKlubnichkaOpen(false);
                        window.setTimeout(() => {
                          const btn = document.querySelector<HTMLElement>(
                            '[data-open-klubnichka-btn="true"]'
                          );
                          btn?.focus({ preventScroll: true });
                        }, 40);
                      }}
                      onFocusVodItem={handleFocusVodItem}
                      onOpenVodItem={handleOpenVod}
                    />
                  ) : (
                  <div className="space-y-4 pb-16">
                    {/* Top Bar: Category Pills + Hidden Klubnichka 18+ for JEKA + Sort Toggle + Account Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {(
                          [
                            {
                              id: 'ro',
                              label: tr(
                                'RO • Filme HD-RO',
                                'RO • Movies HD-RO',
                                'RO • Фильмы HD-RO'
                              ),
                            },
                            {
                              id: 'movies_hd',
                              label: tr(
                                'Filme HD (1080p)',
                                'Movies HD (1080p)',
                                'Фильмы HD (1080p)'
                              ),
                            },
                            {
                              id: 'movies_4k',
                              label: tr(
                                'Filme 4K UHD',
                                'Movies 4K UHD',
                                'Фильмы 4K UHD'
                              ),
                            },
                            {
                              id: 'series_hd',
                              label: tr(
                                'Seriale HD',
                                'TV Series HD',
                                'Сериалы HD'
                              ),
                            },
                            {
                              id: 'series_4k',
                              label: tr(
                                'Seriale 4K',
                                'TV Series 4K',
                                'Сериалы 4K'
                              ),
                            },
                            {
                              id: 'cartoons',
                              label: tr(
                                'Desene / Anime',
                                'Cartoons / Anime',
                                'Мультфильмы / Аниме'
                              ),
                            },
                          ] as const
                        ).map((cat) => {
                          const active = flCategory === cat.id && !flSearchQuery.trim();
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              data-top-pill="true"
                              onClick={() => {
                                setFlSearchQuery('');
                                setFlCategory(cat.id);
                              }}
                              className={`h-10 px-4 rounded-full text-xs sm:text-sm font-bold shrink-0 transition-all focus:outline-none focus:ring-4 focus:ring-white focus:bg-white focus:text-[#141414] cursor-pointer ${active
                                  ? 'bg-gradient-to-r from-[#60a5fa] to-[#bfdbfe] text-[#141414] font-extrabold shadow-lg'
                                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 border border-white/10'
                                }`}
                            >
                              {cat.label}
                            </button>
                          );
                        })}

                        {isAdminJekaProfile(activeProfile) && (
                          <button
                            type="button"
                            data-top-pill="true"
                            data-open-klubnichka-btn="true"
                            onClick={() => setIsKlubnichkaOpen(true)}
                            title="Klubnichka 18+ (Disponibil exclusiv pentru profilul JEKA)"
                            className="h-10 px-4 rounded-full bg-rose-500/15 hover:bg-rose-500/25 focus:outline-none focus:ring-4 focus:ring-white focus:bg-white focus:text-[#141414] text-rose-300 border border-rose-500/35 text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                          >
                            <Lock className="w-3.5 h-3.5 text-rose-400" />
                            <span>
                              {tr(
                                'Klubnichka 18+',
                                'Klubnichka 18+',
                                'Клубничка 18+'
                              )}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          data-top-pill="true"
                          onClick={() =>
                            setFlSort((prev) =>
                              prev === 'seeders' ? 'latest' : 'seeders'
                            )
                          }
                          className="h-10 px-4 rounded-full bg-white/[0.06] hover:bg-white/[0.12] focus:outline-none focus:ring-4 focus:ring-white focus:bg-white focus:text-[#141414] text-zinc-100 text-xs sm:text-sm font-extrabold border border-white/10 shrink-0 cursor-pointer"
                        >
                          {flSort === 'seeders'
                            ? tr(
                              'Sortare: Top Seeders',
                              'Sort: Top Seeders',
                              'По сидам (Популярные)'
                            )
                            : tr(
                              'Sortare: Cele mai noi',
                              'Sort: Latest Releases',
                              'По дате (Новинки)'
                            )}
                        </button>

                        <span className="px-3.5 py-1.5 rounded-full bg-[#60a5fa]/15 border border-[#60a5fa]/35 text-[#60a5fa] text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0">
                          <span className="w-2 h-2 rounded-full bg-[#60a5fa] animate-pulse" />
                          <span>FileList.io • jeka7ro</span>
                        </span>
                      </div>
                    </div>

                    {/* FileList Search Bar + On-Screen TV Remote Keyboard */}
                    <div className="p-3 sm:p-4 rounded-[28px] tahoe-glass border border-white/10 space-y-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="flex-1 min-w-[220px] h-11 px-4 rounded-full bg-black/40 border border-white/15 focus-within:border-[#60a5fa] flex items-center gap-2.5">
                          <Search className="w-4 h-4 text-[#60a5fa] shrink-0" />
                          <input
                            type="text"
                            value={flSearchQuery}
                            onChange={(e) => setFlSearchQuery(e.target.value)}
                            placeholder={tr(
                              'Caută filme sau seriale pe FileList.io (ex: Dune, Avatar, Gladiator)...',
                              'Search movies or TV series on FileList.io (e.g. Dune, Avatar, Gladiator)...',
                              'Поиск торрентов на FileList.io...'
                            )}
                            className="flex-1 min-w-0 bg-transparent text-sm sm:text-base font-bold text-white placeholder:text-zinc-500 placeholder:font-normal focus:outline-none select-text"
                          />
                          {flSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setFlSearchQuery('')}
                              className="px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 focus:bg-white focus:text-zinc-950 text-xs font-extrabold text-zinc-200 shrink-0 cursor-pointer"
                            >
                              {tr('Șterge', 'Clear', 'Сброс')}
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsFlKeyboardOpen((prev) => !prev)}
                          className={`h-11 px-4 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 border transition-all focus:outline-none focus:ring-4 focus:ring-white cursor-pointer ${isFlKeyboardOpen
                              ? 'bg-[#1e3a8a] text-white border border-[#3b82f6]/50 border-[#60a5fa]'
                              : 'bg-white/[0.06] hover:bg-white/[0.12] text-zinc-100 border-white/15'
                            }`}
                        >
                          <Search className="w-4 h-4" />
                          <span>
                            {isFlKeyboardOpen
                              ? tr('Ascunde Tastatura TV', 'Hide TV Keyboard', 'Скрыть клавиатуру')
                              : tr('Tastatură Telecomandă TV', 'TV Remote Keyboard', 'Экранная клавиатура')}
                          </span>
                        </button>
                      </div>

                      {isFlKeyboardOpen && (
                        <div className="pt-2 border-t border-white/10 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#60a5fa]">
                              {tr(
                                'Tastează cu telecomanda TV pentru a căuta pe FileList.io:',
                                'Type with the TV remote to search FileList.io:',
                                'Введите название с пульта ТВ:'
                              )}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setFlSearchQuery((q) => q + ' ')}
                                className="h-9 px-4 rounded-lg bg-[#2a2a2a] hover:bg-[#343434] focus:bg-[#1e3a8a] focus:text-white text-white text-xs font-bold border border-white/10 cursor-pointer"
                              >
                                {tr('Spațiu', 'Space', 'Пробел')}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setFlSearchQuery((q) => q.slice(0, -1))
                                }
                                className="h-9 px-3.5 rounded-lg bg-[#2a2a2a] hover:bg-[#343434] focus:bg-rose-600 focus:text-white text-rose-400 text-xs font-bold inline-flex items-center gap-1 border border-white/10 cursor-pointer"
                              >
                                <Delete className="w-3.5 h-3.5" />
                                <span>{tr('Șterge', 'Backspace', 'Стереть')}</span>
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-9 sm:grid-cols-12 gap-1.5">
                            {ON_SCREEN_KEYS_LATIN.map((ch) => (
                              <button
                                key={`fl_key_${ch}`}
                                type="button"
                                onClick={() => setFlSearchQuery((q) => q + ch)}
                                className="h-10 rounded-lg bg-[#141414] hover:bg-white hover:text-[#141414] focus:bg-[#1e3a8a] focus:text-white text-white font-extrabold text-xs sm:text-sm transition-colors border border-white/10 cursor-pointer"
                              >
                                {ch}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* FileList Torrent Cards Grid */}
                    {isFlLoading ? (
                      <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-300">
                        <Loader2 className="w-10 h-10 text-[#60a5fa] animate-spin" />
                        <p className="text-sm font-bold">
                          {tr(
                            'Se încarcă torrentele de pe FileList.io (jeka7ro)...',
                            'Loading torrents from FileList.io (jeka7ro)...',
                            'Загрузка торрентов с FileList.io (jeka7ro)...'
                          )}
                        </p>
                      </div>
                    ) : flItems.length === 0 ? (
                      <div className="p-8 rounded-2xl bg-[#202020] border border-white/10 text-center text-sm text-zinc-400">
                        {tr(
                          'Niciun torrent găsit pe FileList.io pentru această căutare.',
                          'No torrents found on FileList.io for this search.',
                          'Торренты на FileList.io не найдены.'
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(185px,1fr))] gap-x-3 sm:gap-x-4 gap-y-5 sm:gap-y-6">
                        {flItems.map((tor) => {
                          const mappedVod: CinemetaItem = {
                            id: tor.imdbId || `fl_${tor.id}`,
                            flTorrentId: tor.id,
                            releaseTitle: tor.releaseTitle,
                            sizeFormatted: tor.sizeFormatted,
                            seeders: tor.seeders,
                            freeleech: tor.freeleech,
                            isRo: tor.isRo,
                            qualityBadge: tor.quality,
                            type: tor.type,
                            name: tor.name,
                            releaseInfo: tor.year,
                            poster: tor.poster,
                            genres: tor.genres,
                            description: `FileList.io Release: ${tor.releaseTitle} (${tor.sizeFormatted} • ▲ ${tor.seeders} seeders • ${tor.category})`,
                          };
                          return (
                            <button
                              key={`fl_card_${tor.id}`}
                              type="button"
                              data-vod-card="true"
                              onFocus={() => handleFocusVodItem(mappedVod)}
                              onMouseEnter={() => handleFocusVodItem(mappedVod)}
                              onClick={() => handleOpenVod(mappedVod, false)}
                              className="group text-left focus:outline-none cursor-pointer"
                            >
                              <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-[#60a5fa] group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all">
                                {tor.poster ? (
                                  <img
                                    src={tor.poster}
                                    alt={tor.name}
                                    loading="lazy"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-zinc-800 to-zinc-950">
                                    <Film className="w-10 h-10 text-[#60a5fa] mb-2 opacity-80" />
                                    <span className="text-xs font-extrabold text-zinc-200 line-clamp-3">
                                      {tor.name}
                                    </span>
                                  </div>
                                )}

                                {/* Top Left: Quality + RO Badge */}
                                <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
                                  <span className="px-2.5 py-0.5 rounded-full bg-black/85 border border-[#60a5fa]/50 text-[#60a5fa] text-[10px] font-extrabold uppercase tracking-wider shadow">
                                    {tor.quality}
                                  </span>
                                  {tor.isRo && (
                                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-extrabold uppercase shadow">
                                      RO
                                    </span>
                                  )}
                                </div>

                                {/* Top Right: Freeleech Badge */}
                                {tor.freeleech && (
                                  <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-[#1e3a8a] text-white text-[10px] font-extrabold uppercase tracking-wider shadow">
                                    FREELEECH
                                  </span>
                                )}

                                {/* Bottom Bar: Seeders + Size */}
                                <div className="absolute inset-x-0 bottom-0 pt-6 pb-2 px-2.5 bg-gradient-to-t from-black/95 via-black/80 to-transparent flex items-center justify-between text-[11px] font-extrabold">
                                  <span className="px-2 py-0.5 rounded bg-blue-500/20 border border-blue-400/40 text-blue-300 tabular-nums">
                                    ▲ {tor.seeders}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-black/80 text-zinc-200 tabular-nums">
                                    {tor.sizeFormatted}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-2.5 px-0.5">
                                <div className="text-sm sm:text-[15px] font-semibold text-zinc-100 group-focus:text-[#60a5fa] leading-snug line-clamp-1">
                                  {tor.name}
                                </div>
                                <div className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
                                  {tor.releaseTitle}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )
                )}

                {/* SECTION 6: WATCH HISTORY ("История / Continuă vizionarea / Watch History" — All Watched Items + TV Remote Delete Buttons) */}
                {section === 'history' && (
                  <div className="space-y-4 pb-16">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight flex items-center gap-2.5">
                        <span
                          className={`w-7 h-7 rounded-lg bg-gradient-to-br ${activeProfile.avatarBg} inline-flex items-center justify-center text-sm shadow`}
                        >
                          {activeProfile.avatarEmoji}
                        </span>
                        <span>
                          {tr(
                            `Istoric vizionare — ${activeProfile.name} (${historyList.length})`,
                            `Continue Watching — ${activeProfile.name} (${historyList.length})`,
                            `История просмотров — ${activeProfile.name} (${historyList.length})`
                          )}
                        </span>
                      </h2>

                      {historyList.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAllWatchProgress}
                          className="h-9 px-4 rounded-full bg-rose-500/15 hover:bg-rose-600 focus:bg-rose-600 text-rose-300 hover:text-white focus:text-white border border-rose-500/35 focus:border-white focus:ring-2 focus:ring-white focus:outline-none text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                          <span>
                            {tr(
                              `Șterge tot istoricul (${historyList.length})`,
                              `Clear All History (${historyList.length})`,
                              `Очистить всю историю (${historyList.length})`
                            )}
                          </span>
                        </button>
                      )}
                    </div>
                    {historyList.length === 0 ? (
                      <p className="text-sm text-zinc-400">
                        {tr(
                          `Profilul „${activeProfile.name}” nu are niciun film sau serial început încă.`,
                          `Profile "${activeProfile.name}" has no movies or series in progress yet.`,
                          `В профиле «${activeProfile.name}» пока нет начатых фильмов или сериалов.`
                        )}
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-x-3 sm:gap-x-4 gap-y-5 sm:gap-y-6">
                        {historyList.map((entry) => {
                          const item = entry.item;
                          const isLiveCard = false;
                          const devLabel =
                            sanitizeDeviceName(entry.deviceName) || 'TV';
                          const posterUrl =
                            item.poster ||
                            `https://images.metahub.space/poster/medium/${item.id}/img`;
                          return (
                            <div
                              key={item.id}
                              className="flex flex-col gap-2"
                            >
                              <button
                                type="button"
                                data-watched-poster-btn="true"
                                onFocus={() => handleFocusVodItem(item)}
                                onMouseEnter={() => handleFocusVodItem(item)}
                                onClick={() => handleOpenVod(item)}
                                className="group text-left focus:outline-none cursor-pointer flex-1"
                              >
                                <div
                                  className={`aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all ${
                                    isLiveCard
                                      ? 'ring-2 ring-blue-400 shadow-[0_0_28px_rgba(37, 99, 235,0.42)]'
                                      : 'shadow-lg'
                                  }`}
                                >
                                  <img
                                    src={posterUrl}
                                    alt={item.name}
                                    loading="lazy"
                                    className="w-full h-full object-cover"
                                  />
                                  {isLiveCard && (
                                    <div className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-md bg-zinc-950/90 border border-blue-400/75 backdrop-blur-md shadow-[0_2px_12px_rgba(0,0,0,0.7)] inline-flex items-center gap-1.5 max-w-[66%]">
                                      <span className="relative flex h-2 w-2 shrink-0">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-90" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
                                      </span>
                                      <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wide text-[#60a5fa] truncate">
                                        {tr(
                                          `RULEAZĂ • ${devLabel}`,
                                          `LIVE • ${devLabel}`,
                                          `СМОТРЯТ • ${devLabel}`
                                        )}
                                      </span>
                                    </div>
                                  )}
                                  {(() => {
                                    const rInfo = getVodCardRatingInfo(item);
                                    return (
                                      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 pointer-events-none">
                                        <span className="px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-sm border border-white/15 text-white text-[10px] font-extrabold tracking-tight shadow inline-flex items-center gap-1">
                                          <span className={rInfo.isRussian ? 'text-[#ff5500]' : 'text-amber-400'}>
                                            {rInfo.source}
                                          </span>
                                          <span>{rInfo.value}</span>
                                        </span>
                                        <span
                                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow ${item.type === 'series'
                                              ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                                              : 'bg-amber-500/90 text-zinc-950'
                                            }`}
                                        >
                                          {item.type === 'series'
                                            ? `${tr('SERIAL', 'SERIES', 'СЕРИАЛ')} S${entry.season}:E${entry.episode}`
                                            : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                  {renderPosterProgressOverlay(
                                    entry,
                                    isLiveCard
                                  )}
                                </div>
                                <div className="mt-2 px-0.5">
                                  <div
                                    className={`text-sm sm:text-[15px] leading-snug line-clamp-1 ${
                                      isLiveCard
                                        ? 'font-bold text-[#60a5fa] group-focus:text-white'
                                        : 'font-normal text-zinc-100 group-focus:text-white'
                                    }`}
                                  >
                                    {item.name}
                                  </div>
                                  <div className="text-xs text-zinc-400 mt-0.5 flex items-center justify-between gap-1">
                                    <span>{formatSeriesCardSubtitleText(item, seriesEpStatsMap[item.id] || uhdSeriesEpStats[item.id], tr)}</span>
                                    {isLiveCard && (
                                      <span className="text-[11px] font-bold text-blue-400 truncate">
                                        ● {devLabel}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* SECTION 7: UNIFIED SMART TV FAVORITES HUB ("Избранное / My List / Favorite") */}
                {section === 'saved' && (
                  <div className="space-y-8 pb-16">
                    {/* Group 1: Favorite Movies & Series */}
                    <div className="space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                          {tr(
                            `Favorite (${activeProfile.name}) — Filme & Seriale (${savedVodItems.length})`,
                            `My List (${activeProfile.name}) — Movies & TV Series (${savedVodItems.length})`,
                            `Избранное (${activeProfile.name}) — Фильмы и Сериалы (${savedVodItems.length})`
                          )}
                        </h2>
                        <button
                          type="button"
                          onClick={() => setSection('calendar')}
                          className="h-9 px-4 rounded-full bg-white/10 hover:bg-white hover:text-zinc-950 focus:bg-white focus:text-zinc-950 focus:outline-none text-xs font-bold text-zinc-100 border border-white/15 inline-flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <span>📅</span>
                          <span>
                            {tr(
                              'Calendar Episoade Noi →',
                              'New Episodes Calendar →',
                              'Календарь новых серий →'
                            )}
                          </span>
                        </button>
                      </div>
                      {savedVodItems.length === 0 ? (
                        <p className="text-xs sm:text-sm text-zinc-400">
                          {tr(
                            'Niciun film sau serial salvat la Favorite în acest profil încă.',
                            'No movies or TV series saved to My List in this profile yet.',
                            'В этом профиле пока нет сохранённых фильмов или сериалов.'
                          )}
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-x-3 sm:gap-x-4 gap-y-5 sm:gap-y-6">
                          {savedVodItems.map((item) => {
                            const posterUrl =
                              item.poster ||
                              `https://images.metahub.space/poster/medium/${item.id}/img`;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                data-vod-card="true"
                                onClick={() => handleOpenVod(item)}
                                className="group w-full block text-left focus:outline-none cursor-pointer"
                              >
                                <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all">
                                  <img
                                    src={posterUrl}
                                    alt={item.name}
                                    loading="lazy"
                                    className="w-full h-full object-cover"
                                  />
                                  <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                    ❤
                                  </span>
                                  {(() => {
                                    const rInfo = getVodCardRatingInfo(item);
                                    return (
                                      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 pointer-events-none">
                                        <span className="px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-sm border border-white/15 text-white text-[10px] font-extrabold tracking-tight shadow inline-flex items-center gap-1">
                                          <span className={rInfo.isRussian ? 'text-[#ff5500]' : 'text-amber-400'}>
                                            {rInfo.source}
                                          </span>
                                          <span>{rInfo.value}</span>
                                        </span>
                                        <span
                                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow ${
                                            item.type === 'series'
                                              ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                                              : 'bg-amber-500/90 text-zinc-950'
                                          }`}
                                        >
                                          {item.type === 'series'
                                            ? formatSeriesCardBadgeText(item, seriesEpStatsMap[item.id] || uhdSeriesEpStats[item.id], tr)
                                            : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </div>
                                <div className="mt-2.5 px-0.5">
                                  <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                    {item.name}
                                  </div>
                                  <div className="text-xs text-zinc-400 mt-0.5">
                                    {formatSeriesCardSubtitleText(item, seriesEpStatsMap[item.id] || uhdSeriesEpStats[item.id], tr)}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Group 2: Favorite Live TV Channels */}
                    <div className="space-y-3.5 pt-4 border-t border-white/10">
                      <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                        {tr('Favorite — TV Online', 'Favorites — Live TV', 'Избранное — ТВ Онлайн')} ({favoriteTvChannels.length})
                      </h2>
                      {favoriteTvChannels.length === 0 ? (
                        <p className="text-xs sm:text-sm text-zinc-400">
                          Niciun canal TV salvat la Favorite încă.
                        </p>
                      ) : (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
                          {favoriteTvChannels.map((ch) => {
                            const chEpg = resolveChannelEpg(ch);
                            const nowProg = chEpg?.now;
                            const epgStats = getEpgTimingStats(nowProg);
                            return (
                              <div
                                key={ch.id}
                                className="relative rounded-2xl bg-[#222222] border-2 border-white/10 hover:border-white/50 transition-all flex items-center shadow-md overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    requestTvFullscreen();
                                    setActiveTvPlaylistContext("FAV", "FAV");
                                    playTvChannel(ch, favoriteTvChannels);
                                  }}
                                  className="flex-1 min-w-0 p-3.5 flex items-center gap-3 text-left focus:outline-none focus:bg-white/15 focus:ring-4 focus:ring-inset focus:ring-white cursor-pointer"
                                >
                                  <div className="w-11 h-11 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                    {ch.logo ? (
                                      <img
                                        src={ch.logo}
                                        alt={ch.name}
                                        loading="lazy"
                                        className="w-full h-full object-contain p-1"
                                      />
                                    ) : (
                                      <Tv className="w-5 h-5 text-zinc-300" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                                      {ch.name}
                                    </div>
                                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                                      {nowProg?.title ? (
                                        <span className="text-blue-300 font-semibold">
                                          📺 {nowProg.title}
                                        </span>
                                      ) : (
                                        `${ch.countryCode} • ${ch.group || 'Live HD'}`
                                      )}
                                    </div>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleFavoriteTvChannel(ch)}
                                  className="h-full px-3 py-3.5 flex items-center justify-center border-l border-white/10 text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-white cursor-pointer"
                                >
                                  <Heart className="w-4 h-4 fill-rose-500" />
                                </button>
                                {nowProg && (
                                  <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10">
                                    <div
                                      className="h-full bg-gradient-to-r from-[#1e3a8a] to-[#2563eb]"
                                      style={{ width: `${epgStats.progress}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Group 3: Favorite Radio Stations */}
                    <div className="space-y-3.5 pt-4 border-t border-white/10">
                      <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                        {tr('Favorite — Radio', 'Favorites — Radio', 'Избранное — Радио')} ({favorites.length})
                      </h2>
                      {favorites.length === 0 ? (
                        <p className="text-xs sm:text-sm text-zinc-400">
                          Niciun post radio salvat la Favorite încă.
                        </p>
                      ) : (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
                          {favorites.map((st) => {
                            const isPlayingThis =
                              currentStation?.stationuuid === st.stationuuid &&
                              playerStatus === 'playing';
                            const stTrack =
                              isPlayingThis && activeRadioTrack
                                ? activeRadioTrack
                                : stationLiveTracks[st.stationuuid];
                            return (
                              <div
                                key={st.stationuuid}
                                className={`relative rounded-2xl border-2 transition-all flex items-center shadow-md overflow-hidden ${isPlayingThis
                                    ? 'bg-white/15 border-white'
                                    : 'bg-[#222222] border-white/10 hover:border-white/50'
                                  }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsTvRadioPlayerOpen(false);
                                    playStation(st, favorites);
                                  }}
                                  className="flex-1 min-w-0 p-3.5 flex items-center gap-3 text-left focus:outline-none focus:bg-white/15 focus:ring-4 focus:ring-inset focus:ring-white cursor-pointer"
                                >
                                  <StationAvatar
                                    name={st.name}
                                    favicon={st.favicon}
                                    homepage={st.homepage}
                                    size="sm"
                                    isPlaying={false}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                                        {st.name}
                                      </span>
                                      {isPlayingThis && (
                                        <span className="inline-flex items-end gap-0.5 h-3.5 shrink-0">
                                          <span className="w-0.5 h-full bg-amber-400 eq-bar rounded-full" />
                                          <span className="w-0.5 h-2.5 bg-amber-400 eq-bar eq-bar-2 rounded-full" />
                                          <span className="w-0.5 h-3.5 bg-amber-400 eq-bar eq-bar-3 rounded-full" />
                                          <span className="w-0.5 h-2 bg-amber-400 eq-bar rounded-full" />
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-zinc-400 truncate mt-0.5 flex items-center gap-1.5">
                                      {stTrack ? (
                                        <>
                                          {stTrack.coverUrl ? (
                                            <img
                                              src={stTrack.coverUrl}
                                              alt=""
                                              className="w-7 h-7 rounded-md object-cover shrink-0 border border-white/20 shadow-sm"
                                            />
                                          ) : (
                                            <span className="shrink-0">🎵</span>
                                          )}
                                          <span className="text-blue-300 font-semibold truncate">
                                            {stTrack.artist
                                              ? `${stTrack.artist} - ${stTrack.title}`
                                              : stTrack.title}
                                          </span>
                                        </>
                                      ) : isPlayingThis ? (
                                        <span className="text-blue-300 font-semibold">
                                          ▶ {tr('Se redă acum', 'Playing now', 'Сейчас играет')}
                                        </span>
                                      ) : (
                                        `${st.country} • ${st.tags || 'Live Radio'}`
                                      )}
                                    </div>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleFavorite(st)}
                                  className="h-full px-3 py-3.5 flex items-center justify-center border-l border-white/10 text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-white cursor-pointer"
                                >
                                  <Heart className="w-4 h-4 fill-rose-500" />
                                </button>
                                {stTrack && (
                                  <div className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500/30">
                                    <div
                                      className={`h-full bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] ${
                                        isPlayingThis ? 'w-full' : 'w-2/3'
                                      }`}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Group 4: Favorite Music Tracks (Muzică — TIDAL MAX) */}
                    <div className="space-y-3.5 pt-4 border-t border-white/10">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                          {tr(
                            'Favorite — Muzică',
                            'Favorites — Music',
                            'Избранное — Музыка'
                          )}{' '}
                          ({likedMusicTracks.length})
                        </h2>
                        {likedMusicTracks.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSection('music')}
                            className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 focus:bg-white focus:text-zinc-950 focus:outline-none text-xs font-bold text-zinc-200 transition-colors cursor-pointer"
                          >
                            {tr(
                              'Deschide Muzică →',
                              'Open Music →',
                              'Открыть Музыку →'
                            )}
                          </button>
                        )}
                      </div>
                      {likedMusicTracks.length === 0 ? (
                        <p className="text-xs sm:text-sm text-zinc-400">
                          {tr(
                            'Nicio piesă salvată la Favorite în Muzică încă. Apasă pe inima ❤ din dreptul oricărei piese în secțiunea Muzică.',
                            'No favorite music tracks saved yet.',
                            'В избранном пока нет музыкальных треков.'
                          )}
                        </p>
                      ) : (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5">
                          {likedMusicTracks.map((trk: any) => {
                            const isThisTrack =
                              currentMusicTrack?.id === trk.id;
                            const isPlayingThisTrack =
                              isThisTrack && Boolean(isMusicPlaying);
                            return (
                              <div
                                key={`fav_music_${trk.id}`}
                                className={`relative rounded-2xl border-2 transition-all flex items-center shadow-md overflow-hidden ${
                                  isThisTrack
                                    ? 'bg-white/15 border-white'
                                    : 'bg-[#222222] border-white/10 hover:border-white/50'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isThisTrack && handleToggleMusicPlayPause) {
                                      handleToggleMusicPlayPause();
                                    } else if (handlePlayMusicTrack) {
                                      handlePlayMusicTrack(
                                        trk,
                                        likedMusicTracks
                                      );
                                    }
                                  }}
                                  className="flex-1 min-w-0 p-3.5 flex items-center gap-3 text-left focus:outline-none focus:bg-white/15 focus:ring-4 focus:ring-inset focus:ring-white cursor-pointer"
                                >
                                  <div className="relative w-11 h-11 rounded-xl bg-zinc-950 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                                    {trk.coverUrl ? (
                                      <img
                                        src={trk.coverUrl}
                                        alt={trk.title}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <Music className="w-5 h-5 text-zinc-300" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                                        {trk.title}
                                      </span>
                                      {isPlayingThisTrack && (
                                        <span className="inline-flex items-end gap-0.5 h-3.5 shrink-0">
                                          <span className="w-0.5 h-full bg-amber-400 eq-bar rounded-full" />
                                          <span className="w-0.5 h-2.5 bg-amber-400 eq-bar eq-bar-2 rounded-full" />
                                          <span className="w-0.5 h-3.5 bg-amber-400 eq-bar eq-bar-3 rounded-full" />
                                          <span className="w-0.5 h-2 bg-amber-400 eq-bar rounded-full" />
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-zinc-400 truncate mt-0.5 flex items-center gap-1.5">
                                      <span className="truncate">
                                        {trk.artist}
                                      </span>
                                      <span className="px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-400/30 text-[9px] font-extrabold text-amber-300 uppercase shrink-0">
                                        {trk.audioQuality || 'MAX FLAC'}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleLikeMusicTrack &&
                                    handleToggleLikeMusicTrack(trk)
                                  }
                                  title={tr(
                                    'Elimină de la Favorite',
                                    'Remove from Favorites',
                                    'Удалить из избранного'
                                  )}
                                  className="h-full px-3 py-3.5 flex items-center justify-center border-l border-white/10 text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-white cursor-pointer"
                                >
                                  <Heart className="w-4 h-4 fill-rose-500" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
    </>
  );
});

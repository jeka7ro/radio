import React, { useEffect, useState, useCallback } from 'react';
import {
  Search,
  Play,
  Film,
  Clapperboard,
  Tv,
  Sparkles,
  Trophy,
  Radio,
  X,
  Loader2,
  Clock,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  IEDEM_VOD_CATEGORIES,
  IEDEM_VOD_YEARS,
  IEDEM_VOD_GENRES,
  IEDEM_TVSHOW_NETWORKS,
  IedemTvShowNetworkId,
  IedemCategoryTab,
  IedemVodItem,
  IedemVodDetailResponse,
  fetchIedemCatalogItems,
  searchIedemVod,
  fetchIedemItemDetail,
  getCachedIedemVerifiedMeta,
  resolveIedemKinopoiskMeta,
  matchesIedemYearFilter,
  sortIedemItemsByYearDesc,
} from '../../services/iedemVodService';
import { useRadioStore } from '../../store/useRadioStore';
import { TvChannel } from '../../types/radio';
import { CinemetaItem, getVodCardRatingInfo } from '../../views/smartTvLampaHelpers';

interface IedemMediatekaSectionProps {
  uiLang?: string;
  onOpenVodItem?: (
    item: CinemetaItem,
    autoPlayImmediately?: boolean,
    explicitSeason?: number,
    explicitEpisode?: number
  ) => void;
}

export const IedemMediatekaSection: React.FC<IedemMediatekaSectionProps> = ({
  uiLang = 'ro',
  onOpenVodItem,
}) => {
  const playTvChannel = useRadioStore((state) => state.playTvChannel);

  const [selectedCategoryId, setSelectedCategoryId] =
    useState<string>('series_ru');
  const [selectedTvNetwork, setSelectedTvNetwork] =
    useState<IedemTvShowNetworkId>('all');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [isKeyboardOpen, setIsKeyboardOpen] = useState<boolean>(false);
  const [keyboardAlphabet, setKeyboardAlphabet] = useState<'CYR' | 'LAT'>('CYR');

  const [items, setItems] = useState<IedemVodItem[]>([]);
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [activeItem, setActiveItem] = useState<IedemVodItem | null>(null);
  const [activeDetail, setActiveDetail] =
    useState<IedemVodDetailResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [seriesEpCounts, setSeriesEpCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    const seriesToFetch = items
      .filter((it) => it.type === 'multistream' && it.fid > 0 && seriesEpCounts[it.fid] === undefined)
      .slice(0, 40);
    if (seriesToFetch.length === 0) return;

    let cancelled = false;
    void (async () => {
      const batchSize = 6;
      for (let i = 0; i < seriesToFetch.length; i += batchSize) {
        if (cancelled) break;
        const chunk = seriesToFetch.slice(i, i + batchSize);
        const results = await Promise.all(
          chunk.map(async (it) => {
            try {
              const detail = await fetchIedemItemDetail(it.fid);
              const count = Array.isArray(detail?.items) ? detail.items.length : 0;
              return { fid: it.fid, count };
            } catch {
              return { fid: it.fid, count: 0 };
            }
          })
        );
        if (cancelled) break;
        setSeriesEpCounts((prev) => {
          const next = { ...prev };
          for (const r of results) {
            next[r.fid] = r.count;
          }
          return next;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [items, seriesEpCounts]);

  // Verify real release years & Russian origin via Kinopoisk for visible items
  useEffect(() => {
    const unverified = items
      .filter((it) => !it.kpId && !it.tvShowNetwork && !getCachedIedemVerifiedMeta(it))
      .slice(0, 40);
    if (unverified.length === 0) return;

    let cancelled = false;
    void (async () => {
      const batchSize = 5;
      for (let i = 0; i < unverified.length; i += batchSize) {
        if (cancelled) break;
        const chunk = unverified.slice(i, i + batchSize);
        await Promise.all(chunk.map((it) => resolveIedemKinopoiskMeta(it)));
        if (cancelled) break;

        setItems((prev) => {
          let changed = false;
          const next: IedemVodItem[] = [];
          for (const it of prev) {
            if (it.kpId || it.tvShowNetwork) {
              next.push(it);
              continue;
            }
            const meta = getCachedIedemVerifiedMeta(it);
            if (meta?.isRussian === false) {
              changed = true;
              continue;
            }
            const nextYear =
              meta?.year && meta.year !== it.year ? meta.year : it.year;
            const nextRating =
              meta?.ratingKinopoisk && meta.ratingKinopoisk !== it.ratingKinopoisk
                ? meta.ratingKinopoisk
                : it.ratingKinopoisk;
            if (nextYear !== it.year || nextRating !== it.ratingKinopoisk) {
              changed = true;
            }
            if (selectedYear && !matchesIedemYearFilter(nextYear, selectedYear)) {
              changed = true;
              continue;
            }
            next.push(
              nextYear !== it.year || nextRating !== it.ratingKinopoisk
                ? { ...it, year: nextYear, ratingKinopoisk: nextRating }
                : it
            );
          }
          return changed ? sortIedemItemsByYearDesc(next) : prev;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [items, selectedYear]);

  const activeCategory =
    IEDEM_VOD_CATEGORIES.find((c) => c.id === selectedCategoryId) ||
    IEDEM_VOD_CATEGORIES[0];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 320);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const loadCatalog = useCallback(
    async (nextOffset = 0, append = false) => {
      if (debouncedQuery.length >= 2) {
        setIsLoading(true);
        setError(null);
        try {
          const found = await searchIedemVod(debouncedQuery);
          setItems(found);
          setHasMore(false);
          setOffset(0);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Ошибка загрузки Медиатеки iEdem'
          );
        } finally {
          setIsLoading(false);
        }
        return;
      }

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setError(null);
      }

      try {
        const res = await fetchIedemCatalogItems({
          fid: activeCategory.fid,
          vc: activeCategory.vc,
          offset: nextOffset,
          years: selectedYear,
          genre: selectedGenre,
          only4k: activeCategory.only4k,
          onlyRu: activeCategory.onlyRu,
          excludeRu: activeCategory.excludeRu,
          tvShowNetwork:
            activeCategory.id === 'tvshows_ru' ? selectedTvNetwork : undefined,
        });
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setHasMore(res.hasMore);
        setOffset(nextOffset);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Ошибка загрузки Медиатеки iEdem'
        );
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [
      activeCategory,
      selectedYear,
      selectedGenre,
      selectedTvNetwork,
      debouncedQuery,
    ]
  );

  useEffect(() => {
    void loadCatalog(0, false);
  }, [loadCatalog]);

  const playStreamUrl = (
    title: string,
    streamUrl: string,
    poster?: string,
    is4k?: boolean,
    queueItems?: TvChannel[]
  ) => {
    if (!streamUrl) return;
    const channelObj: TvChannel = {
      id: `iedem_vod_${streamUrl}`,
      name: title,
      logo: poster || activeItem?.img || '',
      url: streamUrl,
      group: 'iEdem Медиатека',
      countryCode: 'RU',
      resolution: is4k ? '4K' : '1080P',
      resolutionHeight: is4k ? 2160 : 1080,
    };
    playTvChannel(
      channelObj,
      queueItems && queueItems.length > 0 ? queueItems : [channelObj]
    );
  };

  const handleOpenItem = async (item: IedemVodItem) => {
    if (onOpenVodItem) {
      const isSeries = item.type === 'multistream';
      const seasonMatch = item.title.match(/Сезон\s*(\d+)/i);
      const parsedSeason =
        item.explicitSeason || (seasonMatch ? Number(seasonMatch[1]) : 1);
      const cachedMeta = getCachedIedemVerifiedMeta(item);
      const verifiedYear = cachedMeta?.year || item.year;
      const verifiedRating = cachedMeta?.ratingKinopoisk || item.ratingKinopoisk;
      const yearStr = verifiedYear ? String(verifiedYear) : '';
      const hasDirectIedemFid = item.fid > 0;
      const resolvedKpId = item.kpId || cachedMeta?.kpId;
      onOpenVodItem(
        {
          id: hasDirectIedemFid
            ? `iedem_${item.fid}`
            : `kp_${resolvedKpId || Math.abs(item.fid)}`,
          iedemFid: hasDirectIedemFid ? item.fid : undefined,
          iedemStreamUrl: item.url,
          kpId: resolvedKpId ? String(resolvedKpId) : undefined,
          type: isSeries ? 'series' : 'movie',
          name: item.title,
          releaseInfo: yearStr || undefined,
          year: yearStr || undefined,
          ratingKinopoisk: verifiedRating || undefined,
          imdbRating: verifiedRating || undefined,
          poster: item.img,
          background: item.img,
          description: item.description,
          runtime: item.duration ? `${item.duration} min` : undefined,
          country: 'Россия',
          ageRating: item.agelimit ? `${item.agelimit}+` : '16+',
          episodesCount:
            item.episodesCount ||
            (isSeries && seriesEpCounts[item.fid]
              ? seriesEpCounts[item.fid]
              : undefined),
          qualityBadge: item['4k']
            ? '4K UHD • iEdem VIP'
            : item.networkBadge
              ? `1080p FHD • ${item.networkBadge}`
              : '1080p FHD • iEdem VIP',
        },
        false,
        isSeries ? parsedSeason : undefined,
        1
      );
      return;
    }

    setActiveItem(item);
    setActiveDetail(null);
    setIsDetailLoading(true);
    try {
      const detail = await fetchIedemItemDetail(item.fid);
      setActiveDetail(detail);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const renderCategoryIcon = (cat: IedemCategoryTab) => {
    switch (cat.iconType) {
      case 'ru_movie':
        return (
          <span className="inline-flex items-center gap-1.5 shrink-0">
            <img
              src="https://flagcdn.com/w40/ru.png"
              alt="RU"
              className="w-4 h-3 rounded-[2px] object-cover shrink-0 shadow-xs"
            />
            <Clapperboard className="w-3.5 h-3.5 shrink-0" />
          </span>
        );
      case 'ru_series':
        return (
          <span className="inline-flex items-center gap-1.5 shrink-0">
            <img
              src="https://flagcdn.com/w40/ru.png"
              alt="RU"
              className="w-4 h-3 rounded-[2px] object-cover shrink-0 shadow-xs"
            />
            <Tv className="w-3.5 h-3.5 shrink-0" />
          </span>
        );
      case 'tr_series':
        return (
          <span className="inline-flex items-center gap-1.5 shrink-0">
            <img
              src="https://flagcdn.com/w40/tr.png"
              alt="TR"
              className="w-4 h-3 rounded-[2px] object-cover shrink-0 shadow-xs"
            />
            <Tv className="w-3.5 h-3.5 shrink-0" />
          </span>
        );
      case '4k_movie':
      case '4k_series':
        return (
          <span className="px-1.5 py-0.5 rounded bg-amber-400 text-zinc-950 text-[10px] font-black leading-none tracking-tighter shrink-0">
            4K
          </span>
        );
      case 'movie':
        return <Clapperboard className="w-4 h-4 shrink-0" />;
      case 'series':
        return <Tv className="w-4 h-4 shrink-0" />;
      case 'cartoon':
        return <Sparkles className="w-4 h-4 shrink-0" />;
      case 'cartoon_series':
      case 'anime':
        return <Layers className="w-4 h-4 shrink-0" />;
      case 'tvshow':
        return <Radio className="w-4 h-4 shrink-0" />;
      case 'sport':
        return <Trophy className="w-4 h-4 shrink-0" />;
      default:
        return <Film className="w-4 h-4 shrink-0" />;
    }
  };

  return (
    <div className="space-y-4 text-white">
      {/* Header & Search */}
      <div
        data-top-hero-card="true"
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#101829]/90 border border-[#2563eb]/35 rounded-2xl p-4 shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] border border-[#60a5fa]/40 flex items-center justify-center shadow-lg shadow-blue-900/40 shrink-0">
            <Film className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
                iEdem Медиатека
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#1e3a8a]/80 text-[#93c5fd] border border-[#3b82f6]/40 inline-flex items-center gap-1.5">
                <img
                  src="https://flagcdn.com/w40/ru.png"
                  alt="RU"
                  className="w-3.5 h-2.5 rounded-[2px] object-cover"
                />
                <span>VIP • FHD & 4K • RU</span>
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Русские сериалы, ТВ-передачи и русские фильмы (1080p / 4K UHD)
            </p>
          </div>
        </div>

        {/* Search Input + TV Remote Keyboard Button */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-72">
            <Search className="w-4 h-4 text-[#60a5fa] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск русских сериалов, ТВ и фильмов..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-black/60 border border-[#3b82f6]/35 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#60a5fa] focus:ring-2 focus:ring-[#2563eb]/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-400 hover:text-white focus:bg-white focus:text-[#141414]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsKeyboardOpen((prev) => !prev)}
            className={`h-10 px-4 rounded-xl text-xs font-extrabold inline-flex items-center gap-2 border transition-all focus:outline-none focus:ring-4 focus:ring-white focus:bg-white focus:text-[#141414] cursor-pointer ${
              isKeyboardOpen
                ? 'bg-[#1e3a8a] text-white border-[#60a5fa]'
                : 'bg-white/[0.06] hover:bg-white/[0.12] text-zinc-100 border-white/15'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>{isKeyboardOpen ? 'Скрыть клавиатуру' : 'Клавиатура ТВ'}</span>
          </button>
        </div>
      </div>

      {isKeyboardOpen && (
        <div className="p-3 sm:p-4 rounded-2xl bg-[#101829]/95 border border-[#2563eb]/35 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#60a5fa]">
              Поиск с пульта ТВ в медиатеке iEdem:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSearchQuery((q) => q + ' ')}
                className="h-8 px-3.5 rounded-lg bg-[#1e293b] hover:bg-[#334155] focus:bg-white focus:text-[#141414] text-white text-xs font-bold border border-white/10 cursor-pointer"
              >
                ПРОБЕЛ (SPACE)
              </button>
              <button
                type="button"
                onClick={() => setSearchQuery((q) => q.slice(0, -1))}
                className="h-8 px-3.5 rounded-lg bg-[#1e293b] hover:bg-[#334155] focus:bg-white focus:text-[#141414] text-amber-300 text-xs font-bold border border-white/10 cursor-pointer"
              >
                ⌫ СТЕРЕТЬ
              </button>
              <button
                type="button"
                onClick={() =>
                  setKeyboardAlphabet((prev) =>
                    prev === 'CYR' ? 'LAT' : 'CYR'
                  )
                }
                className="h-8 px-3.5 rounded-lg bg-[#1e3a8a] text-white focus:bg-white focus:text-[#141414] text-xs font-extrabold border border-[#60a5fa]/40 cursor-pointer"
              >
                {keyboardAlphabet === 'CYR' ? 'RU → EN' : 'EN → RU'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-10 sm:grid-cols-12 md:grid-cols-14 gap-1.5">
            {(keyboardAlphabet === 'CYR'
              ? [
                  'А','Б','В','Г','Д','Е','Ж','З','И','Й','К','Л','М','Н','О','П','Р','С','Т','У','Ф','Х','Ц','Ч','Ш','Щ','Ы','Э','Ю','Я','0','1','2','3','4','5','6','7','8','9',
                ]
              : [
                  'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','0','1','2','3','4','5','6','7','8','9',
                ]
            ).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setSearchQuery((q) => q + ch.toLowerCase())}
                className="h-9 rounded-lg bg-black/50 hover:bg-[#1e3a8a] focus:bg-white focus:text-[#141414] focus:outline-none focus:ring-2 focus:ring-white text-white font-extrabold text-sm flex items-center justify-center border border-white/10 cursor-pointer"
              >
                {ch}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category Pills (Wrapped cleanly, Russian Movies & Russian Series separated first with clean vector & flag icons) */}
      <div className="flex flex-wrap items-center gap-2">
        {IEDEM_VOD_CATEGORIES.map((cat) => {
          const active = selectedCategoryId === cat.id && !debouncedQuery;
          const catTitle =
            uiLang === 'en'
              ? cat.labelEn || cat.label
              : uiLang === 'ru'
                ? cat.label
                : cat.labelRo || cat.label;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSearchQuery('');
                setDebouncedQuery('');
                setSelectedCategoryId(cat.id);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 whitespace-nowrap transition-all border focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${
                active
                  ? 'bg-[#1e3a8a] text-white border-[#60a5fa]/60 shadow-lg shadow-blue-900/40'
                  : 'bg-[#101829]/85 text-zinc-300 border-white/10 hover:bg-[#172554] hover:text-white focus:bg-white focus:text-[#141414]'
              }`}
            >
              {renderCategoryIcon(cat)}
              <span>{catTitle}</span>
            </button>
          );
        })}
      </div>

      {/* TV Show Channel / Platform Filters (ТНТ • VK Видео & Звёзды • Пятница! • СТС / НТВ / КВН) */}
      {selectedCategoryId === 'tvshows_ru' && !debouncedQuery && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-2xl bg-[#0b1324]/90 border border-[#3b82f6]/30 shadow-inner">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#93c5fd] px-2">
            {uiLang === 'ro'
              ? 'Canale & Platforme:'
              : uiLang === 'en'
                ? 'Networks:'
                : 'Телеканалы и платформы:'}
          </span>
          {IEDEM_TVSHOW_NETWORKS.map((net) => {
            const active = selectedTvNetwork === net.id;
            const netLabel =
              uiLang === 'ro'
                ? net.labelRo
                : uiLang === 'en'
                  ? net.labelEn
                  : net.label;
            return (
              <button
                key={net.id}
                type="button"
                onClick={() => setSelectedTvNetwork(net.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all border focus:outline-none focus:ring-2 focus:ring-white cursor-pointer inline-flex items-center gap-1.5 ${
                  active
                    ? 'bg-[#2563eb] text-white border-[#93c5fd] shadow-md shadow-blue-900/50'
                    : 'bg-zinc-900/80 text-zinc-300 border-white/10 hover:bg-[#172554] hover:text-white focus:bg-white focus:text-[#141414]'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: net.badgeColor }}
                />
                <span>{netLabel}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Year & Genre Filters */}
      {!debouncedQuery && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {IEDEM_VOD_YEARS.map((y) => {
              const active = selectedYear === y.value;
              return (
                <button
                  key={y.label}
                  type="button"
                  onClick={() => setSelectedYear(y.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap border transition-colors focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${
                    active
                      ? 'bg-[#1e3a8a] text-white border-[#60a5fa]/60 shadow'
                      : 'bg-zinc-900/70 text-zinc-400 border-white/10 hover:text-white focus:bg-white focus:text-[#141414]'
                  }`}
                >
                  {y.label}
                </button>
              );
            })}
          </div>

          {selectedCategoryId !== 'tvshows_ru' && (
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg bg-[#101829] border border-[#3b82f6]/35 text-xs font-bold text-zinc-200 focus:outline-none focus:border-[#60a5fa]"
            >
              {IEDEM_VOD_GENRES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Content Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#60a5fa]" />
          <span className="text-sm font-medium">
            Загрузка каталога iEdem Медиатека...
          </span>
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-center space-y-3">
          <p className="text-sm text-rose-300 font-semibold">{error}</p>
          <button
            type="button"
            onClick={() => void loadCatalog(0, false)}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white"
          >
            Повторить
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 rounded-2xl bg-zinc-900/60 border border-white/10 text-center text-zinc-400 text-sm">
          Ничего не найдено по вашему запросу.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-x-3 sm:gap-x-4 gap-y-5 sm:gap-y-6">
            {items.map((item) => {
              const isSeries = item.type === 'multistream';
              const epCount = isSeries
                ? item.episodesCount || seriesEpCounts[item.fid] || 0
                : 0;
              const cachedMeta = getCachedIedemVerifiedMeta(item);
              const rInfo = getVodCardRatingInfo({
                id: item.fid > 0 ? `iedem_${item.fid}` : `kp_${item.kpId || Math.abs(item.fid)}`,
                iedemFid: item.fid > 0 ? item.fid : undefined,
                name: item.title,
                country: 'Россия',
                ratingKinopoisk:
                  cachedMeta?.ratingKinopoisk || item.ratingKinopoisk,
              });
              return (
                <button
                  key={`${item.fid}_${item.title}`}
                  type="button"
                  data-vod-card="true"
                  onClick={() => void handleOpenItem(item)}
                  className="group w-full block text-left focus:outline-none cursor-pointer"
                >
                  <div className="relative aspect-[2/3] w-full rounded-2xl bg-[#242424] overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                    {item.img ? (
                      <img
                        src={item.img}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        <Film className="w-10 h-10" />
                      </div>
                    )}

                    {/* Top Quality, KP Rating & Type Badges (Sus lângă scrisul ФИЛЬМ / СЕРИАЛ) */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex items-center justify-between gap-1 pointer-events-none">
                      <div className="flex items-center gap-1">
                        {item.networkBadge ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-[#1e3a8a]/95 text-white border border-[#60a5fa]/60 shadow">
                            {item.networkBadge}
                          </span>
                        ) : item['4k'] ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-400 text-zinc-950 shadow">
                            4K UHD
                          </span>
                        ) : item.fhd ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[#0d1f38]/95 text-[#93c5fd] border border-[#60a5fa]/40 shadow">
                            1080p
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-sm border border-[#ff5500]/50 text-white text-[10px] font-extrabold tracking-tight shadow inline-flex items-center gap-1">
                          <span className="text-[#ff5500]">KP</span>
                          <span>{rInfo.value}</span>
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow ${
                            isSeries
                              ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                              : 'bg-amber-500/90 text-zinc-950'
                          }`}
                        >
                          {item.tvShowNetwork
                            ? epCount > 0
                              ? `ШОУ • ${epCount} ВЫП.`
                              : 'ТВ-ШОУ'
                            : isSeries
                              ? epCount > 0
                                ? `СЕРИАЛ • ${epCount} СЕР.`
                                : 'СЕРИАЛ'
                              : 'ФИЛЬМ'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 px-0.5">
                    <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                      {item.title}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {item.year || '2026'}
                      {item.networkBadge ? ` • ${item.networkBadge}` : ''}
                      {item.tvShowNetwork
                        ? epCount > 0
                          ? item.explicitSeason
                            ? ` • Сезон ${item.explicitSeason} (${epCount} вып.)`
                            : item.seasonsCount && item.seasonsCount > 1
                              ? ` • ${item.seasonsCount} сез. (${epCount} вып.)`
                              : ` • ${epCount} вып.`
                          : ' • ТВ-Шоу'
                        : isSeries
                          ? epCount > 0
                            ? ` • Сериал • ${epCount} сер.`
                            : ' • Сериал'
                          : item.duration
                            ? ` • ${item.duration} мин.`
                            : ' • Фильм'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {hasMore && !debouncedQuery && (
            <div className="flex justify-center pt-4 pb-6">
              <button
                type="button"
                disabled={isLoadingMore}
                onClick={() => void loadCatalog(offset + 300, true)}
                className="px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-xs sm:text-sm font-bold text-white flex items-center gap-2"
              >
                {isLoadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Показать ещё (+300)</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail & Episode / Quality Picker Modal */}
      {activeItem && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
          onClick={() => setActiveItem(null)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-zinc-900 border border-white/15 p-4 sm:p-6 text-white shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveItem(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col sm:flex-row gap-5">
              {activeItem.img && (
                <div className="w-36 sm:w-44 shrink-0 mx-auto sm:mx-0">
                  <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden border border-white/10 bg-zinc-950">
                    <img
                      src={activeItem.img}
                      alt={activeItem.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2 pr-8">
                  {activeItem['4k'] && (
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-amber-400 text-black">
                      4K UHD
                    </span>
                  )}
                  {activeItem.fhd && (
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#1e3a8a] text-white border border-[#60a5fa]/40">
                      Full HD 1080p
                    </span>
                  )}
                  {activeItem.year ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-white/10 text-zinc-200">
                      <Calendar className="w-3.5 h-3.5" />
                      {activeItem.year}
                    </span>
                  ) : null}
                  {activeItem.duration ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-white/10 text-zinc-200">
                      <Clock className="w-3.5 h-3.5" />
                      {activeItem.duration} мин.
                    </span>
                  ) : null}
                </div>

                <h2 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
                  {activeItem.title}
                </h2>

                {activeItem.description && (
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    {activeItem.description}
                  </p>
                )}

                {isDetailLoading ? (
                  <div className="flex items-center gap-2 pt-3 text-[#60a5fa] text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Загрузка потоков...</span>
                  </div>
                ) : activeDetail?.type === 'stream' || activeItem.url ? (
                  <div className="pt-2 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          const targetUrl =
                            activeDetail?.variants?.['1080'] ||
                            activeDetail?.url ||
                            activeItem.url ||
                            '';
                          playStreamUrl(
                            activeItem.title,
                            targetUrl,
                            activeItem.img,
                            activeItem['4k']
                          );
                          setActiveItem(null);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-blue-600/30"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>
                          Смотреть {activeItem['4k'] ? '4K / Full HD' : 'Full HD 1080p'}
                        </span>
                      </button>

                      {activeDetail?.variants &&
                        Object.entries(activeDetail.variants).map(
                          ([qual, vUrl]) => (
                            <button
                              key={qual}
                              type="button"
                              onClick={() => {
                                playStreamUrl(
                                  `${activeItem.title} (${qual.toUpperCase()})`,
                                  vUrl,
                                  activeItem.img,
                                  qual === '4k' || activeItem['4k']
                                );
                                setActiveItem(null);
                              }}
                              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/15"
                            >
                              {qual === 'auto' ? 'Auto HLS' : `${qual}p`}
                            </button>
                          )
                        )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Series Episodes List */}
            {activeDetail?.type === 'multistream' &&
              Array.isArray(activeDetail.items) &&
              activeDetail.items.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#60a5fa]" />
                      <span>
                        Серии ({activeDetail.items.length}) — выберите серию для воспроизведения:
                      </span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
                    {activeDetail.items.map((ep, idx) => {
                      const queue: TvChannel[] = activeDetail.items!
                        .filter((e) => Boolean(e.url))
                        .map((e) => ({
                          id: `iedem_ep_${e.fid}_${e.url}`,
                          name: `${activeItem.title} — ${e.title}`,
                          logo: activeItem.img || '',
                          url: e.url!,
                          group: 'iEdem Сериалы',
                          countryCode: 'RU',
                          resolution: e['4k'] ? '4K' : '1080P',
                          resolutionHeight: e['4k'] ? 2160 : 1080,
                        }));

                      return (
                        <button
                          key={ep.fid || idx}
                          type="button"
                          onClick={() => {
                            if (ep.url) {
                              playStreamUrl(
                                `${activeItem.title} — ${ep.title}`,
                                ep.url,
                                activeItem.img,
                                ep['4k'],
                                queue
                              );
                              setActiveItem(null);
                            }
                          }}
                          className="px-3 py-2.5 rounded-xl bg-zinc-800/90 hover:bg-[#1e3a8a] text-left text-xs font-bold text-white border border-white/10 flex items-center justify-between gap-2 transition-colors"
                        >
                          <span className="truncate">{ep.title}</span>
                          <Play className="w-3.5 h-3.5 shrink-0 fill-current" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import {
  Search,
  Delete,
  Loader2,
  Play,
  Film,
  ArrowLeft,
  Lock,
} from 'lucide-react';
import {
  KLUBNICHKA_CATEGORIES,
  KLUBNICHKA_SOURCES,
  KlubnichkaCategoryId,
  KlubnichkaSourceId,
  KlubnichkaSortMode,
  KlubnichkaVideoCard,
  fetchKlubnichkaCatalog,
} from '../../services/klubnichkaService';
import {
  CinemetaItem,
  ON_SCREEN_KEYS_LATIN,
} from '../../views/smartTvLampaHelpers';

interface SmartTvKlubnichkaSectionProps {
  tr: (ro: string, en: string, ru?: string) => string;
  uiLang: 'ro' | 'en' | 'ru';
  onExitKlubnichka: () => void;
  onFocusVodItem: (item: CinemetaItem) => void;
  onOpenVodItem: (item: CinemetaItem, autoPlay?: boolean) => void;
}

const SORT_MODES: Array<{
  id: KlubnichkaSortMode;
  labelRo: string;
  labelEn: string;
  labelRu: string;
}> = [
  {
    id: 'top-weekly',
    labelRo: 'Sortare: Top Săptămânal',
    labelEn: 'Sort: Top Weekly',
    labelRu: 'Сортировка: Топ недели',
  },
  {
    id: 'latest',
    labelRo: 'Sortare: Cele mai noi',
    labelEn: 'Sort: Latest',
    labelRu: 'Сортировка: Новинки',
  },
  {
    id: 'most-popular',
    labelRo: 'Sortare: Cele mai vizionate',
    labelEn: 'Sort: Most Viewed',
    labelRu: 'Сортировка: По просмотрам',
  },
  {
    id: 'top-rated',
    labelRo: 'Sortare: Top Rating',
    labelEn: 'Sort: Top Rated',
    labelRu: 'Сортировка: По рейтингу',
  },
  {
    id: 'longest',
    labelRo: 'Sortare: Cele mai lungi',
    labelEn: 'Sort: Longest',
    labelRu: 'Сортировка: По длительности',
  },
];

// Persist Klubnichka state across video player open/close so Back returns instantly to the exact card & category
const persistedKlubCache: {
  selectedSource: KlubnichkaSourceId;
  selectedCategory: KlubnichkaCategoryId;
  sortMode: KlubnichkaSortMode;
  searchQuery: string;
  items: KlubnichkaVideoCard[];
  page: number;
  hasMore: boolean;
  loadedKey: string;
  lastClickedCardId: string | null;
} = {
  selectedSource: 'all',
  selectedCategory: 'top_4k',
  sortMode: 'top-weekly',
  searchQuery: '',
  items: [],
  page: 1,
  hasMore: false,
  loadedKey: '',
  lastClickedCardId: null,
};

export const SmartTvKlubnichkaSection: React.FC<
  SmartTvKlubnichkaSectionProps
> = ({
  tr,
  uiLang,
  onExitKlubnichka,
  onFocusVodItem,
  onOpenVodItem,
}) => {
  const [selectedSource, setSelectedSourceState] = useState<KlubnichkaSourceId>(
    () => persistedKlubCache.selectedSource
  );
  const [selectedCategory, setSelectedCategoryState] =
    useState<KlubnichkaCategoryId>(() => persistedKlubCache.selectedCategory);
  const [sortMode, setSortModeState] = useState<KlubnichkaSortMode>(
    () => persistedKlubCache.sortMode
  );
  const [searchQuery, setSearchQueryState] = useState<string>(
    () => persistedKlubCache.searchQuery
  );
  const [debouncedQuery, setDebouncedQuery] = useState<string>(() =>
    persistedKlubCache.searchQuery.trim()
  );
  const [isKeyboardOpen, setIsKeyboardOpen] = useState<boolean>(false);

  const currentQueryKey = `${selectedSource}::${selectedCategory}::${sortMode}::${debouncedQuery}`;
  const hasCachedInitial =
    persistedKlubCache.loadedKey === currentQueryKey &&
    persistedKlubCache.items.length > 0;

  const [items, setItems] = useState<KlubnichkaVideoCard[]>(() =>
    hasCachedInitial ? persistedKlubCache.items : []
  );
  const [page, setPage] = useState<number>(() =>
    hasCachedInitial ? persistedKlubCache.page : 1
  );
  const [hasMore, setHasMore] = useState<boolean>(() =>
    hasCachedInitial ? persistedKlubCache.hasMore : false
  );
  const [isLoading, setIsLoading] = useState<boolean>(() => !hasCachedInitial);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  const setSelectedSource = (next: KlubnichkaSourceId) => {
    persistedKlubCache.selectedSource = next;
    setSelectedSourceState(next);
  };
  const setSelectedCategory = (next: KlubnichkaCategoryId) => {
    persistedKlubCache.selectedCategory = next;
    setSelectedCategoryState(next);
  };
  const setSortMode = (next: KlubnichkaSortMode) => {
    persistedKlubCache.sortMode = next;
    setSortModeState(next);
  };
  const setSearchQuery = (val: string | ((prev: string) => string)) => {
    setSearchQueryState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      persistedKlubCache.searchQuery = next;
      return next;
    });
  };

  // Live preview frame cycling when a card is focused or hovered
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [previewFrameIdx, setPreviewFrameIdx] = useState<number>(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 340);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!activePreviewId) {
      setPreviewFrameIdx(0);
      return;
    }
    const interval = window.setInterval(() => {
      setPreviewFrameIdx((prev) => prev + 1);
    }, 750);
    return () => window.clearInterval(interval);
  }, [activePreviewId]);

  useEffect(() => {
    const targetKey = `${selectedSource}::${selectedCategory}::${sortMode}::${debouncedQuery}`;
    if (
      persistedKlubCache.loadedKey === targetKey &&
      persistedKlubCache.items.length > 0
    ) {
      setItems(persistedKlubCache.items);
      setPage(persistedKlubCache.page);
      setHasMore(persistedKlubCache.hasMore);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setPage(1);

    fetchKlubnichkaCatalog({
      category: selectedCategory,
      source: selectedSource,
      query: debouncedQuery,
      sort: sortMode,
      page: 1,
    })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setHasMore(res.hasMore);
        persistedKlubCache.items = res.items;
        persistedKlubCache.page = 1;
        persistedKlubCache.hasMore = res.hasMore;
        persistedKlubCache.loadedKey = targetKey;
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setHasMore(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSource, selectedCategory, debouncedQuery, sortMode]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    const nextPage = page + 1;
    const targetKey = `${selectedSource}::${selectedCategory}::${sortMode}::${debouncedQuery}`;
    setIsLoadingMore(true);
    try {
      const res = await fetchKlubnichkaCatalog({
        category: selectedCategory,
        source: selectedSource,
        query: debouncedQuery,
        sort: sortMode,
        page: nextPage,
      });
      setItems((prev) => {
        const existingIds = new Set(prev.map((x) => x.id));
        const merged = [
          ...prev,
          ...res.items.filter((x) => !existingIds.has(x.id)),
        ];
        persistedKlubCache.items = merged;
        persistedKlubCache.page = nextPage;
        persistedKlubCache.hasMore = res.hasMore;
        persistedKlubCache.loadedKey = targetKey;
        return merged;
      });
      setPage(nextPage);
      setHasMore(res.hasMore);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const mapCardToCinemetaItem = (card: KlubnichkaVideoCard): CinemetaItem => {
    if (card.sourceKind === 'filelist_xxx' && card.flTorrent) {
      const tor = card.flTorrent;
      return {
        id: tor.imdbId || `fl_${tor.id}`,
        flTorrentId: tor.id,
        releaseTitle: tor.releaseTitle,
        sizeFormatted: tor.sizeFormatted,
        seeders: tor.seeders,
        freeleech: tor.freeleech,
        isRo: tor.isRo,
        qualityBadge: tor.quality,
        type: 'movie',
        name: tor.name,
        releaseInfo: tor.year || '2026',
        poster: tor.poster,
        genres: ['18+ Adult', 'FileList XXX'],
        description: `FileList XXX Release: ${tor.releaseTitle} (${tor.sizeFormatted} • ▲ ${tor.seeders} seeders)`,
        isAdultKlubnichka: true,
      };
    }

    return {
      id: card.id,
      type: 'movie',
      name: card.title,
      releaseInfo: card.addedDate || '2026',
      imdbRating: card.rating,
      poster: card.poster,
      background: card.poster,
      runtime: card.durationText,
      qualityBadge: card.qualityBadge,
      genres: card.subtitle
        ? card.subtitle.split('•').map((s) => s.trim()).filter(Boolean)
        : ['Klubnichka 18+'],
      description: `${card.title} • Durată: ${card.durationText} • ${card.viewsFormatted} • Calitate: ${card.qualityBadge}`,
      klubnichkaRawId: card.rawVideoId,
      klubnichkaEmbedUrl: card.embedUrl,
      isAdultKlubnichka: true,
    };
  };

  const currentSortObj =
    SORT_MODES.find((s) => s.id === sortMode) || SORT_MODES[0];

  // Restore focus to the last-watched video card on return from player, or to the active category pill
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (persistedKlubCache.lastClickedCardId) {
        const lastCard = document.querySelector<HTMLElement>(
          `[data-klub-card-id="${persistedKlubCache.lastClickedCardId}"]`
        );
        if (lastCard) {
          lastCard.focus({ preventScroll: false });
          lastCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return;
        }
      }
      const activePill = document.querySelector<HTMLElement>(
        '[data-klub-active-cat="true"]'
      );
      activePill?.focus({ preventScroll: true });
    }, 65);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div data-klubnichka-root="true" className="space-y-4 pb-16">
      {/* Row 1: Back to Torrents + Source Selector Pills + Sort + JEKA Badge */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-top-pill="true"
          data-klub-exit-btn="true"
          onClick={onExitKlubnichka}
          className="h-10 px-4 rounded-full bg-white/[0.08] hover:bg-white/[0.16] focus:outline-none focus:ring-4 focus:ring-white focus:bg-white focus:text-[#141414] text-zinc-100 text-xs sm:text-sm font-extrabold border border-white/15 inline-flex items-center gap-2 shrink-0 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#60a5fa]" />
          <span>
            {tr('Torrente FL', 'FL Torrents', 'Торренты FL')}
          </span>
        </button>

        {KLUBNICHKA_SOURCES.map((src) => {
          const active = selectedSource === src.id;
          const label =
            uiLang === 'ru'
              ? src.labelRu
              : uiLang === 'en'
                ? src.labelEn
                : src.labelRo;
          return (
            <button
              key={src.id}
              type="button"
              data-top-pill="true"
              onClick={() => {
                persistedKlubCache.lastClickedCardId = null;
                setSelectedSource(src.id);
                if (src.id === 'filelist_xxx') {
                  setSelectedCategory('filelist_xxx');
                } else if (selectedCategory === 'filelist_xxx') {
                  setSelectedCategory('top_4k');
                }
              }}
              className={`h-10 px-4 rounded-full text-xs sm:text-sm font-extrabold shrink-0 transition-all focus:outline-none focus:ring-4 focus:ring-white focus:bg-white focus:text-[#141414] cursor-pointer ${
                active
                  ? 'bg-gradient-to-r from-rose-500 to-amber-400 text-[#141414] shadow-lg'
                  : 'bg-white/[0.08] hover:bg-white/[0.14] text-zinc-100 border border-white/15'
              }`}
            >
              {label}
            </button>
          );
        })}

        <button
          type="button"
          data-top-pill="true"
          onClick={() => {
            persistedKlubCache.lastClickedCardId = null;
            const curIdx = SORT_MODES.findIndex((s) => s.id === sortMode);
            const next = SORT_MODES[(curIdx + 1) % SORT_MODES.length];
            setSortMode(next.id);
          }}
          className="h-10 px-4 rounded-full bg-white/[0.06] hover:bg-white/[0.12] focus:outline-none focus:ring-4 focus:ring-white focus:bg-white focus:text-[#141414] text-zinc-100 text-xs sm:text-sm font-extrabold border border-white/10 shrink-0 cursor-pointer"
        >
          {uiLang === 'ru'
            ? currentSortObj.labelRu
            : uiLang === 'en'
              ? currentSortObj.labelEn
              : currentSortObj.labelRo}
        </button>

        <span className="px-3.5 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/35 text-rose-300 text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0">
          <Lock className="w-3.5 h-3.5 text-rose-400" />
          <span>
            Klubnichka 18+ • JEKA ({items.length})
          </span>
        </span>
      </div>

      {/* Row 2: Expanded Category Pills (20 Categories) */}
      <div className="flex flex-wrap items-center gap-2">
        {KLUBNICHKA_CATEGORIES.map((cat) => {
          const active =
            selectedCategory === cat.id && !debouncedQuery;
          const label =
            uiLang === 'ru'
              ? cat.labelRu
              : uiLang === 'en'
                ? cat.labelEn
                : cat.labelRo;
          return (
            <button
              key={cat.id}
              type="button"
              data-top-pill="true"
              data-klub-active-cat={active ? 'true' : undefined}
              onClick={() => {
                persistedKlubCache.lastClickedCardId = null;
                setSearchQuery('');
                setDebouncedQuery('');
                setSelectedCategory(cat.id);
                if (cat.id === 'filelist_xxx') {
                  setSelectedSource('filelist_xxx');
                } else {
                  if (selectedSource === 'filelist_xxx') {
                    setSelectedSource('all');
                  }
                  setSortMode(cat.defaultOrder);
                }
              }}
              className={`h-9 px-3.5 rounded-full text-xs sm:text-[13px] font-bold shrink-0 transition-all focus:outline-none focus:ring-4 focus:ring-white focus:bg-white focus:text-[#141414] cursor-pointer ${
                active
                  ? 'bg-gradient-to-r from-[#60a5fa] to-[#bfdbfe] text-[#141414] font-extrabold shadow-lg'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 border border-white/10'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Klubnichka Search Bar + On-Screen TV Remote Keyboard (Same Tahoe-Glass Design as App) */}
      <div className="p-3 sm:p-4 rounded-[28px] tahoe-glass border border-white/10 space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex-1 min-w-[220px] h-11 px-4 rounded-full bg-black/40 border border-white/15 focus-within:border-[#60a5fa] flex items-center gap-2.5">
            <Search className="w-4 h-4 text-[#60a5fa] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                persistedKlubCache.lastClickedCardId = null;
                setSearchQuery(e.target.value);
              }}
              placeholder={tr(
                'Caută în Klubnichka 18+ (studio, actriță, 4K, categorie)...',
                'Search in Klubnichka 18+ (studio, actress, 4K, category)...',
                'Поиск в Клубничке 18+ (студия, актриса, 4K, жанр)...'
              )}
              className="flex-1 min-w-0 bg-transparent text-sm sm:text-base font-bold text-white placeholder:text-zinc-500 placeholder:font-normal focus:outline-none select-text"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  persistedKlubCache.lastClickedCardId = null;
                  setSearchQuery('');
                  setDebouncedQuery('');
                }}
                className="px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 focus:bg-white focus:text-zinc-950 text-xs font-extrabold text-zinc-200 shrink-0 cursor-pointer"
              >
                {tr('Șterge', 'Clear', 'Сброс')}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsKeyboardOpen((prev) => !prev)}
            className={`h-11 px-4 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 border transition-all focus:outline-none focus:ring-4 focus:ring-white cursor-pointer ${
              isKeyboardOpen
                ? 'bg-[#1e3a8a] text-white border-[#60a5fa]'
                : 'bg-white/[0.06] hover:bg-white/[0.12] text-zinc-100 border-white/15'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>
              {isKeyboardOpen
                ? tr(
                    'Ascunde Tastatura TV',
                    'Hide TV Keyboard',
                    'Скрыть клавиатуру'
                  )
                : tr(
                    'Tastatură Telecomandă TV',
                    'TV Remote Keyboard',
                    'Экранная клавиатура'
                  )}
            </span>
          </button>
        </div>

        {isKeyboardOpen && (
          <div className="pt-2 border-t border-white/10 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#60a5fa]">
                {tr(
                  'Tastează cu telecomanda TV pentru a căuta în Klubnichka 18+:',
                  'Type with the TV remote to search in Klubnichka 18+:',
                  'Введите запрос с пульта ТВ для поиска в Клубничке 18+:'
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSearchQuery((q) => q + ' ')}
                  className="h-9 px-4 rounded-lg bg-[#2a2a2a] hover:bg-[#343434] focus:bg-[#1e3a8a] focus:text-white text-white text-xs font-bold border border-white/10 cursor-pointer"
                >
                  {tr('Spațiu', 'Space', 'Пробел')}
                </button>
                <button
                  type="button"
                  onClick={() => setSearchQuery((q) => q.slice(0, -1))}
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
                  key={`klub_key_${ch}`}
                  type="button"
                  onClick={() => setSearchQuery((q) => q + ch)}
                  className="h-10 rounded-lg bg-[#141414] hover:bg-white hover:text-[#141414] focus:bg-[#1e3a8a] focus:text-white text-white font-extrabold text-xs sm:text-sm transition-colors border border-white/10 cursor-pointer"
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Klubnichka Video Cards Grid */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-300">
          <Loader2 className="w-10 h-10 text-[#60a5fa] animate-spin" />
          <p className="text-sm font-bold">
            {tr(
              'Se încarcă catalogul Klubnichka 18+ (4K & Full HD)...',
              'Loading Klubnichka 18+ catalog (4K & Full HD)...',
              'Загрузка каталога Клубничка 18+ (4K и Full HD)...'
            )}
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#202020] border border-white/10 text-center text-sm text-zinc-400">
          {tr(
            'Niciun rezultat găsit pentru această căutare.',
            'No results found for this search.',
            'Ничего не найдено по вашему запросу.'
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
            {items.map((card) => {
              const mappedVod = mapCardToCinemetaItem(card);
              const isPreviewing =
                activePreviewId === card.id && card.previewThumbs.length > 1;
              const displayedThumb = isPreviewing
                ? card.previewThumbs[
                    previewFrameIdx % card.previewThumbs.length
                  ]
                : card.poster;

              return (
                <button
                  key={card.id}
                  type="button"
                  data-vod-card="true"
                  data-klub-card-id={card.id}
                  onFocus={() => {
                    setActivePreviewId(card.id);
                    onFocusVodItem(mappedVod);
                  }}
                  onBlur={() => {
                    setActivePreviewId((prev) =>
                      prev === card.id ? null : prev
                    );
                  }}
                  onMouseEnter={() => {
                    setActivePreviewId(card.id);
                    onFocusVodItem(mappedVod);
                  }}
                  onMouseLeave={() => {
                    setActivePreviewId((prev) =>
                      prev === card.id ? null : prev
                    );
                  }}
                  onClick={() => {
                    persistedKlubCache.lastClickedCardId = card.id;
                    onOpenVodItem(mappedVod, true);
                  }}
                  className="group text-left focus:outline-none cursor-pointer"
                >
                  <div className="aspect-video w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg border border-white/10 group-focus:ring-4 group-focus:ring-[#60a5fa] group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all">
                    {displayedThumb ? (
                      <img
                        src={displayedThumb}
                        alt={card.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-zinc-800 to-zinc-950">
                        <Film className="w-10 h-10 text-[#60a5fa] mb-2 opacity-80" />
                        <span className="text-xs font-extrabold text-zinc-200 line-clamp-2">
                          {card.title}
                        </span>
                      </div>
                    )}

                    {/* Top Left: Quality Badge + Provider Badge */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-black/85 border border-[#60a5fa]/50 text-[#60a5fa] text-[10px] font-extrabold uppercase tracking-wider shadow">
                        {card.qualityBadge}
                      </span>
                      {card.providerBadge && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-600/90 text-white text-[10px] font-black uppercase shadow">
                          {card.providerBadge}
                        </span>
                      )}
                    </div>

                    {/* Top Right: Rating / Freeleech */}
                    {card.rating && (
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/85 border border-white/15 text-amber-300 text-[10px] font-extrabold uppercase tracking-wider shadow">
                        ★ {card.rating}
                      </span>
                    )}

                    {/* Center Play Pill on Hover / Focus */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity bg-black/25">
                      <div className="w-11 h-11 rounded-full bg-[#2563eb] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.85)] ring-2 ring-white">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </div>

                    {/* Bottom Bar: Views / Seeders + Duration / Size */}
                    <div className="absolute inset-x-0 bottom-0 pt-6 pb-2 px-2.5 bg-gradient-to-t from-black/95 via-black/75 to-transparent flex items-center justify-between text-[11px] font-extrabold">
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 border border-blue-400/40 text-blue-300 tabular-nums">
                        {card.viewsFormatted}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-black/85 text-zinc-100 font-mono tabular-nums">
                        {card.durationText}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 px-0.5">
                    <div className="text-sm sm:text-[15px] font-semibold text-zinc-100 group-focus:text-[#60a5fa] leading-snug line-clamp-2">
                      {card.title}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
                      {card.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {hasMore && (
            <div className="pt-6 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="h-11 px-7 rounded-full bg-white/[0.08] hover:bg-white/[0.15] focus:bg-white focus:text-[#141414] text-white text-xs sm:text-sm font-extrabold border border-white/15 inline-flex items-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {tr('Se încarcă...', 'Loading...', 'Загрузка...')}
                    </span>
                  </>
                ) : (
                  <span>
                    {tr(
                      'Afișează mai multe videoclipuri 18+',
                      'Load More 18+ Videos',
                      'Показать ещё видео 18+'
                    )}
                  </span>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

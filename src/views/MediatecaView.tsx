import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Film,
  Tv,
  Search,
  X,
  Play,
  Heart,
  Star,
  Calendar,
  Clock,
  Maximize2,
  ExternalLink,
  Copy,
  Check,
  Clapperboard,
  Popcorn,
  Upload,
  Loader2,
  Sparkles,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useRadioStore } from '../store/useRadioStore';
import { EnrichedCountry } from '../hooks/useCountries';
import { TvChannel } from '../types/radio';
import { parseM3uPlaylist } from '../services/tvApi';

interface MediatecaViewProps {
  selectedCountry: EnrichedCountry;
}

type MediatecaTab = 'movies' | 'series' | 'saved' | 'lampa' | 'custom';

interface CinemetaItem {
  id: string; // IMDb ID e.g. tt15239678
  type: 'movie' | 'series';
  name: string;
  releaseInfo?: string;
  year?: string;
  imdbRating?: string;
  poster?: string;
  background?: string;
  genres?: string[];
  description?: string;
  runtime?: string;
  cast?: string[];
  director?: string[];
}

interface SeriesEpisode {
  id: string;
  name: string;
  season: number;
  episode: number;
  number?: number;
  overview?: string;
  description?: string;
  thumbnail?: string;
  released?: string;
  rating?: string;
}

interface DetailedMeta extends CinemetaItem {
  videos?: SeriesEpisode[];
}

type VodServerId =
  | 'vidsrc_me'
  | 'multiembed'
  | 'autoembed'
  | 'vidsrc_to'
  | 'twoembed';

type SubtitleLangId = 'ro' | 'ru' | 'en' | 'es' | 'fr' | 'de';

const SUBTITLE_LANGUAGES: Array<{
  id: SubtitleLangId;
  label: string;
  flag: string;
}> = [
  { id: 'ro', label: 'Română', flag: '🇷🇴' },
  { id: 'ru', label: 'Русский', flag: '🇷🇺' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'es', label: 'Español', flag: '🇪🇸' },
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
  { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

const VOD_SERVERS: Array<{ id: VodServerId; label: string; badge: string }> = [
  {
    id: 'vidsrc_me',
    label: 'Server 1: VidSrc HD',
    badge: 'Subtitrări RO/RU/EN Automate',
  },
  {
    id: 'multiembed',
    label: 'Server 2: MultiEmbed VIP',
    badge: 'Multi-Audio & Sub RO/RU/EN',
  },
  {
    id: 'autoembed',
    label: 'Server 3: AutoEmbed Multi-Audio',
    badge: 'Piste Audio Multiple + Subtitrări',
  },
  {
    id: 'vidsrc_to',
    label: 'Server 4: VidSrc Pro',
    badge: '1080p Rapid + Multi-Sub',
  },
  {
    id: 'twoembed',
    label: 'Server 5: 2Embed Cinema',
    badge: 'Backup Global',
  },
];

const GENRE_FILTERS: Array<{ id: string; label: string; emoji: string }> = [
  { id: 'top', label: 'Populare Acum', emoji: '🔥' },
  { id: 'imdbRating', label: 'Top IMDb', emoji: '⭐' },
  { id: 'Action', label: 'Acțiune', emoji: '💥' },
  { id: 'Sci-Fi', label: 'Sci-Fi', emoji: '🚀' },
  { id: 'Thriller', label: 'Thriller', emoji: '🔪' },
  { id: 'Comedy', label: 'Comedie', emoji: '😂' },
  { id: 'Drama', label: 'Dramă', emoji: '🎭' },
  { id: 'Crime', label: 'Crimă & Mister', emoji: '🕵️' },
  { id: 'Adventure', label: 'Aventură', emoji: '🧭' },
  { id: 'Horror', label: 'Horror', emoji: '👻' },
  { id: 'Animation', label: 'Animație & Familie', emoji: '🧸' },
  { id: 'Romance', label: 'Romantic', emoji: '💑' },
  { id: 'Documentary', label: 'Documentare', emoji: '🌍' },
];

const LAMPA_PLUGINS = [
  {
    name: 'Online Mod (nb557 — Filme & Seriale Multi-Audio)',
    url: 'https://nb557.github.io/plugins/online_mod.js',
    desc: 'Cel mai stabil plugin VOD cu surse multiple (RezKa, Filmix, VideoCDN, Kodik), piste audio în mai multe limbi și subtitrări.',
    badge: 'Recomandat #1',
  },
  {
    name: 'Lampac / Modss (Multi-Balancer 4K & FHD)',
    url: 'http://lampa.stream/modss',
    desc: 'Agregă automat surse online de filme, seriale și anime cu selecție de traducere/dublaj și subtitrări.',
    badge: 'Rapid & 4K',
  },
  {
    name: 'SkazTV Plugin Store (Magazin de extensii Lampa)',
    url: 'https://skaztv.online/store.js',
    desc: 'Adaugă un meniu complet de extensii în Setările Lampa pentru instalare cu 1 click.',
    badge: 'Magazin',
  },
  {
    name: 'Jackett / TorrServer Parser (4K UHD Remux)',
    url: 'https://bylampa.github.io/jackett.js',
    desc: 'Căutare de filme și seriale 4K HDR cu toate pistele audio originale și subtitrări.',
    badge: 'TorrServer',
  },
];

const SAVED_VOD_STORAGE_KEY = 'aether_saved_vod_items_v1';

function loadSavedVodItems(): CinemetaItem[] {
  try {
    const raw = localStorage.getItem(SAVED_VOD_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildVodEmbedUrl(
  server: VodServerId,
  item: CinemetaItem,
  season: number,
  episode: number,
  subLang: SubtitleLangId
): string {
  const imdbId = item.id;
  const isSeries = item.type === 'series';

  switch (server) {
    case 'vidsrc_me':
      return isSeries
        ? `https://vidsrc.me/embed/tv?imdb=${imdbId}&sea=${season}&epi=${episode}&ds_lang=${subLang}`
        : `https://vidsrc.me/embed/movie?imdb=${imdbId}&ds_lang=${subLang}`;
    case 'multiembed':
      return isSeries
        ? `https://multiembed.mov/?video_id=${imdbId}&s=${season}&e=${episode}`
        : `https://multiembed.mov/?video_id=${imdbId}`;
    case 'autoembed':
      return isSeries
        ? `https://player.autoembed.cc/embed/tv/${imdbId}/${season}/${episode}`
        : `https://player.autoembed.cc/embed/movie/${imdbId}`;
    case 'vidsrc_to':
      return isSeries
        ? `https://vidsrc.to/embed/tv/${imdbId}/${season}/${episode}`
        : `https://vidsrc.to/embed/movie/${imdbId}`;
    case 'twoembed':
      return isSeries
        ? `https://www.2embed.cc/embedtv/${imdbId}&s=${season}&e=${episode}`
        : `https://www.2embed.cc/embed/${imdbId}`;
  }
}

async function resolveSearchQueryToEnglishIfCyrillic(
  rawQuery: string
): Promise<string> {
  const q = rawQuery.trim();
  if (!/[а-яА-ЯёЁ]/.test(q)) return q;
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
      q
    )}&language=ru&uselang=en&format=json&origin=*`;
    const res = await fetch(url);
    if (!res.ok) return q;
    const data = (await res.json()) as {
      search?: Array<{ label?: string }>;
    };
    const label = data.search?.[0]?.label;
    return label || q;
  } catch {
    return q;
  }
}

export const MediatecaView: React.FC<MediatecaViewProps> = ({
  selectedCountry,
}) => {
  const playTvChannel = useRadioStore((state) => state.playTvChannel);
  const customTvChannels = useRadioStore((state) => state.customTvChannels);
  const importCustomTvChannels = useRadioStore(
    (state) => state.importCustomTvChannels
  );
  const clearCustomTvChannels = useRadioStore(
    (state) => state.clearCustomTvChannels
  );

  const [activeTab, setActiveTab] = useState<MediatecaTab>('movies');
  const [selectedGenre, setSelectedGenre] = useState<string>('top');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');

  const [catalogItems, setCatalogItems] = useState<CinemetaItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [skipOffset, setSkipOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const [savedItems, setSavedItems] = useState<CinemetaItem[]>(() =>
    loadSavedVodItems()
  );

  // Active Movie / Series Player Modal state
  const [activeVodItem, setActiveVodItem] = useState<CinemetaItem | null>(null);
  const [detailedMeta, setDetailedMeta] = useState<DetailedMeta | null>(null);
  const [isMetaLoading, setIsMetaLoading] = useState<boolean>(false);
  const [activeServer, setActiveServer] = useState<VodServerId>('vidsrc_me');
  const [preferredSubLang, setPreferredSubLang] =
    useState<SubtitleLangId>('ro');
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);

  // Lampa state
  const [lampaServer, setLampaServer] = useState<string>(
    'https://yumata.github.io/lampa/'
  );
  const [copiedPluginUrl, setCopiedPluginUrl] = useState<string | null>(null);
  const lampaContainerRef = useRef<HTMLDivElement | null>(null);

  // Custom VOD / M3U import state
  const [directStreamTitle, setDirectStreamTitle] = useState('');
  const [directStreamUrl, setDirectStreamUrl] = useState('');
  const [m3uPlaylistUrl, setM3uPlaylistUrl] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Movies or Series catalog from Cinemeta
  useEffect(() => {
    if (activeTab !== 'movies' && activeTab !== 'series') return;

    let cancelled = false;
    setIsLoading(true);
    setSkipOffset(0);

    const mediaType = activeTab === 'series' ? 'series' : 'movie';

    const fetchCatalog = async () => {
      try {
        let url = '';
        if (debouncedQuery) {
          const effectiveQuery =
            await resolveSearchQueryToEnglishIfCyrillic(debouncedQuery);
          url = `https://v3-cinemeta.strem.io/catalog/${mediaType}/top/search=${encodeURIComponent(
            effectiveQuery
          )}.json`;
        } else if (selectedGenre === 'top') {
          url = `https://v3-cinemeta.strem.io/catalog/${mediaType}/top.json`;
        } else if (selectedGenre === 'imdbRating') {
          url = `https://v3-cinemeta.strem.io/catalog/${mediaType}/imdbRating.json`;
        } else {
          url = `https://v3-cinemeta.strem.io/catalog/${mediaType}/top/genre=${encodeURIComponent(
            selectedGenre
          )}.json`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error('Catalog fetch error');
        const data = (await res.json()) as { metas?: CinemetaItem[] };
        if (cancelled) return;

        const list = (data.metas || []).map((m) => ({
          ...m,
          type: mediaType as 'movie' | 'series',
        }));

        setCatalogItems(list);
        setHasMore(!debouncedQuery && list.length >= 40);
      } catch {
        if (!cancelled) {
          setCatalogItems([]);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void fetchCatalog();
    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedGenre, debouncedQuery]);

  // Load more pagination
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    const nextSkip = skipOffset + 50;
    const mediaType = activeTab === 'series' ? 'series' : 'movie';

    setIsLoadingMore(true);
    try {
      let url = '';
      if (selectedGenre === 'top') {
        url = `https://v3-cinemeta.strem.io/catalog/${mediaType}/top/skip=${nextSkip}.json`;
      } else if (selectedGenre === 'imdbRating') {
        url = `https://v3-cinemeta.strem.io/catalog/${mediaType}/imdbRating/skip=${nextSkip}.json`;
      } else {
        url = `https://v3-cinemeta.strem.io/catalog/${mediaType}/top/genre=${encodeURIComponent(
          selectedGenre
        )}&skip=${nextSkip}.json`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        setHasMore(false);
        return;
      }
      const data = (await res.json()) as { metas?: CinemetaItem[] };
      const more = (data.metas || []).map((m) => ({
        ...m,
        type: mediaType as 'movie' | 'series',
      }));

      if (more.length === 0) {
        setHasMore(false);
      } else {
        setCatalogItems((prev) => {
          const existingIds = new Set(prev.map((x) => x.id));
          const unique = more.filter((x) => !existingIds.has(x.id));
          return [...prev, ...unique];
        });
        setSkipOffset(nextSkip);
        setHasMore(more.length >= 35);
      }
    } catch {
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Load full details + episodes when a Movie or Series is opened
  useEffect(() => {
    if (!activeVodItem) {
      setDetailedMeta(null);
      return;
    }

    let cancelled = false;
    setIsMetaLoading(true);
    setSelectedSeason(1);
    setSelectedEpisode(1);

    const fetchDetails = async () => {
      try {
        const res = await fetch(
          `https://v3-cinemeta.strem.io/meta/${activeVodItem.type}/${activeVodItem.id}.json`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { meta?: DetailedMeta };
        if (cancelled || !data.meta) return;

        setDetailedMeta({
          ...activeVodItem,
          ...data.meta,
          type: activeVodItem.type,
        });

        if (
          activeVodItem.type === 'series' &&
          Array.isArray(data.meta.videos) &&
          data.meta.videos.length > 0
        ) {
          const validSeasons = Array.from(
            new Set(
              data.meta.videos
                .map((v) => v.season)
                .filter((s) => typeof s === 'number' && s > 0)
            )
          ).sort((a, b) => a - b);

          if (validSeasons.length > 0) {
            setSelectedSeason(validSeasons[0]);
            const firstEp = data.meta.videos
              .filter((v) => v.season === validSeasons[0])
              .sort(
                (a, b) =>
                  (a.episode || a.number || 1) - (b.episode || b.number || 1)
              )[0];
            if (firstEp) {
              setSelectedEpisode(firstEp.episode || firstEp.number || 1);
            }
          }
        }
      } catch {
        // fallback to basic item
      } finally {
        if (!cancelled) setIsMetaLoading(false);
      }
    };

    void fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [activeVodItem]);

  const availableSeasons = useMemo(() => {
    if (!detailedMeta?.videos) return [];
    return Array.from(
      new Set(
        detailedMeta.videos
          .map((v) => v.season)
          .filter((s) => typeof s === 'number' && s > 0)
      )
    ).sort((a, b) => a - b);
  }, [detailedMeta]);

  const episodesForSeason = useMemo(() => {
    if (!detailedMeta?.videos) return [];
    return detailedMeta.videos
      .filter((v) => v.season === selectedSeason)
      .sort(
        (a, b) => (a.episode || a.number || 1) - (b.episode || b.number || 1)
      );
  }, [detailedMeta, selectedSeason]);

  const toggleSaveVodItem = (item: CinemetaItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSavedItems((prev) => {
      const exists = prev.some((x) => x.id === item.id);
      const next = exists
        ? prev.filter((x) => x.id !== item.id)
        : [item, ...prev];
      try {
        localStorage.setItem(SAVED_VOD_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleFullscreenPlayer = () => {
    const el = playerContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (el.requestFullscreen) {
      void el.requestFullscreen();
    }
  };

  const handleFullscreenLampa = () => {
    const el = lampaContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (el.requestFullscreen) {
      void el.requestFullscreen();
    }
  };

  const handleCopyPlugin = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPluginUrl(url);
      setTimeout(() => setCopiedPluginUrl(null), 2500);
    } catch {
      // ignore
    }
  };

  const handlePlayDirectStream = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = directStreamUrl.trim();
    if (!trimmedUrl) return;
    const ch: TvChannel = {
      id: `vod_custom_${Date.now()}`,
      name: directStreamTitle.trim() || 'Film / Video Direct (VOD)',
      logo: '',
      url: trimmedUrl,
      group: 'VOD Direct',
      countryCode:
        selectedCountry.iso_3166_1 === 'ALL'
          ? 'RO'
          : selectedCountry.iso_3166_1,
      resolution: '1080P',
      resolutionHeight: 1080,
    };
    importCustomTvChannels([ch]);
    playTvChannel(ch, [ch, ...customTvChannels]);
  };

  const handleImportM3uUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = m3uPlaylistUrl.trim();
    if (!url) return;
    setImportStatus('Se descarcă arhiva de filme M3U...');
    try {
      const proxied = `/api/tv-proxy?url=${encodeURIComponent(url)}`;
      let res = await fetch(proxied);
      if (!res.ok) {
        res = await fetch(url);
      }
      const text = await res.text();
      const parsed = parseM3uPlaylist(text, 'RU', { isCustomImport: true });
      if (parsed.length === 0) {
        setImportStatus('Nu am găsit filme în acest link.');
        return;
      }
      importCustomTvChannels(parsed);
      setImportStatus(`Am importat ${parsed.length} filme/seriale din listă!`);
    } catch {
      setImportStatus('Eroare la descărcarea listei M3U.');
    }
  };

  const handleUploadM3uFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseM3uPlaylist(text, 'RU', { isCustomImport: true });
      if (parsed.length > 0) {
        importCustomTvChannels(parsed);
        setImportStatus(
          `Am importat ${parsed.length} filme/seriale din ${file.name}!`
        );
      } else {
        setImportStatus('Fișierul selectat nu conține stream-uri valide.');
      }
    } catch {
      setImportStatus('Nu am putut citi fișierul M3U.');
    } finally {
      e.target.value = '';
    }
  };

  const displayedItems = activeTab === 'saved' ? savedItems : catalogItems;

  return (
    <div className="space-y-5">
      {/* Single-Row Top Header Bar */}
      <section className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-xs">
        <div className="flex items-center justify-between gap-2.5 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Clapperboard className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="shrink-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100 tracking-tight whitespace-nowrap">
                Mediatecă — Filme & Seriale On-Demand
              </h1>
              <p className="text-xs text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                Catalog complet de filme și seriale online cu sezoane, episoade și subtitrări
              </p>
            </div>
          </div>

          {/* Mode Switcher Pills on a single row */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('movies');
                setActiveVodItem(null);
              }}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'movies'
                  ? 'bg-brand-700 text-white dark:bg-brand-600 shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Film className="w-3.5 h-3.5" aria-hidden="true" />
              <span>🎬 Filme Online</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('series');
                setActiveVodItem(null);
              }}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'series'
                  ? 'bg-brand-700 text-white dark:bg-brand-600 shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Tv className="w-3.5 h-3.5" aria-hidden="true" />
              <span>📺 Seriale (Sezoane & Episoade)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('saved');
                setActiveVodItem(null);
              }}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'saved'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/70 hover:bg-rose-100'
              }`}
            >
              <Heart className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Salvate ({savedItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('lampa');
                setActiveVodItem(null);
              }}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'lampa'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/70 hover:bg-amber-100'
              }`}
            >
              <Popcorn className="w-3.5 h-3.5" aria-hidden="true" />
              <span>🍿 Lampa Smart TV</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('custom');
                setActiveVodItem(null);
              }}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'custom'
                  ? 'bg-brand-700 text-white dark:bg-brand-600 shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Fișier .M3U / .MP4</span>
            </button>
          </div>
        </div>
      </section>

      {/* ACTIVE ON-DEMAND MOVIE / SERIES PLAYER PANEL */}
      {activeVodItem && (
        <section className="rounded-3xl bg-zinc-950 text-zinc-100 border border-zinc-800 shadow-2xl overflow-hidden">
          {/* Player Top Bar */}
          <div className="px-4 sm:px-6 py-3.5 bg-zinc-900 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="px-2.5 py-1 rounded-full bg-amber-500 text-zinc-950 text-xs font-extrabold uppercase tracking-wider shrink-0">
                {activeVodItem.type === 'series'
                  ? `SERIAL • S${selectedSeason}:E${selectedEpisode}`
                  : 'FILM ON-DEMAND'}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-white truncate">
                {activeVodItem.name}
              </h2>
              {(activeVodItem.releaseInfo || activeVodItem.year) && (
                <span className="text-xs text-zinc-400 shrink-0">
                  ({activeVodItem.releaseInfo || activeVodItem.year})
                </span>
              )}
              {activeVodItem.imdbRating && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold shrink-0">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {activeVodItem.imdbRating}
                </span>
              )}
            </div>

            {/* Server Switcher + Actions */}
            <div className="flex flex-wrap items-center gap-1.5">
              {VOD_SERVERS.map((srv) => {
                const active = activeServer === srv.id;
                return (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => setActiveServer(srv.id)}
                    title={srv.badge}
                    className={`min-h-[34px] px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-brand-400" />
                    <span>{srv.label}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleFullscreenPlayer}
                className="min-h-[34px] px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Fullscreen</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveVodItem(null)}
                className="min-h-[34px] px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                <span>Închide Playerul</span>
              </button>
            </div>
          </div>

          {/* Audio Track & Subtitle Language Bar */}
          <div className="px-4 sm:px-6 py-2.5 bg-zinc-900/80 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
            {/* Subtitle Preferred Language Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-emerald-400 inline-flex items-center gap-1 mr-1">
                💬 Subtitrare:
              </span>
              {SUBTITLE_LANGUAGES.map((sub) => {
                const active = preferredSubLang === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setPreferredSubLang(sub.id)}
                    className={`min-h-[30px] px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                      active
                        ? 'bg-emerald-500 text-zinc-950 font-bold shadow-xs'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    <span>{sub.flag}</span>
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Audio Track Quick Switcher */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-amber-400 inline-flex items-center gap-1 mr-1">
                🎧 Pista Audio:
              </span>
              <button
                type="button"
                onClick={() => setActiveServer('autoembed')}
                className={`min-h-[30px] px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                  activeServer === 'autoembed'
                    ? 'bg-amber-500 text-zinc-950 font-bold'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                }`}
              >
                <span>🔊 Multi-Audio (EN / RU / ES / FR)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveServer('multiembed')}
                className={`min-h-[30px] px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                  activeServer === 'multiembed'
                    ? 'bg-amber-500 text-zinc-950 font-bold'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                }`}
              >
                <span>🎙️ VIP Multi-Server & Sub</span>
              </button>
              <span className="text-[11px] text-zinc-400 hidden xl:inline">
                • În player: apasă pe iconița <b>CC</b> (dreapta-jos) pentru subtitrări sau <b>🎧 / ⚙️</b> pentru limba audio
              </span>
            </div>
          </div>

          {/* 16:9 Embedded VOD Stream Player */}
          <div
            ref={playerContainerRef}
            className="relative w-full aspect-video bg-black"
          >
            <iframe
              key={`${activeServer}_${activeVodItem.id}_${selectedSeason}_${selectedEpisode}_${preferredSubLang}`}
              src={buildVodEmbedUrl(
                activeServer,
                activeVodItem,
                selectedSeason,
                selectedEpisode,
                preferredSubLang
              )}
              title={activeVodItem.name}
              className="w-full h-full border-0"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>

          {/* Series Seasons & Episodes Selector */}
          {activeVodItem.type === 'series' && (
            <div className="p-4 sm:p-5 bg-zinc-900/90 border-t border-zinc-800 space-y-4">
              {isMetaLoading ? (
                <div className="flex items-center gap-2 text-xs text-zinc-400 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
                  <span>Se încarcă sezoanele și episoadele...</span>
                </div>
              ) : (
                <>
                  {/* Season Pills */}
                  {availableSeasons.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 shrink-0">
                        Sezoane:
                      </span>
                      {availableSeasons.map((seasonNum) => {
                        const active = seasonNum === selectedSeason;
                        return (
                          <button
                            key={seasonNum}
                            type="button"
                            onClick={() => {
                              setSelectedSeason(seasonNum);
                              setSelectedEpisode(1);
                            }}
                            className={`min-h-[34px] px-3.5 py-1 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                              active
                                ? 'bg-amber-500 text-zinc-950 shadow-xs'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                            }`}
                          >
                            Sezonul {seasonNum}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Episodes Grid for Selected Season */}
                  {episodesForSeason.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto pr-1">
                      {episodesForSeason.map((ep) => {
                        const epNum = ep.episode || ep.number || 1;
                        const isCurrentEp = epNum === selectedEpisode;
                        return (
                          <button
                            key={ep.id || `${ep.season}_${epNum}`}
                            type="button"
                            onClick={() => setSelectedEpisode(epNum)}
                            className={`p-2.5 rounded-2xl border text-left flex items-start gap-2.5 transition-all ${
                              isCurrentEp
                                ? 'bg-amber-500/20 border-amber-500 text-white'
                                : 'bg-zinc-950/70 hover:bg-zinc-800/80 border-zinc-800 text-zinc-200'
                            }`}
                          >
                            {ep.thumbnail ? (
                              <img
                                src={ep.thumbnail}
                                alt={ep.name}
                                loading="lazy"
                                className="w-20 h-12 rounded-lg object-cover shrink-0 bg-zinc-800"
                              />
                            ) : (
                              <div className="w-20 h-12 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                                <Play className="w-4 h-4 text-amber-400 fill-current" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-extrabold text-amber-400 shrink-0">
                                  Ep. {epNum}
                                </span>
                                <span className="text-xs font-bold truncate">
                                  {ep.name || `Episodul ${epNum}`}
                                </span>
                              </div>
                              {(ep.overview || ep.description) && (
                                <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                                  {ep.overview || ep.description}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Movie / Series Details Footer */}
          <div className="p-4 sm:p-5 bg-zinc-950 border-t border-zinc-800/80 flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="space-y-1.5 max-w-4xl">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                {(detailedMeta?.genres || activeVodItem.genres)?.map((g) => (
                  <span
                    key={g}
                    className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-200 font-medium"
                  >
                    {g}
                  </span>
                ))}
                {(detailedMeta?.runtime || activeVodItem.runtime) && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-brand-400" />
                    {detailedMeta?.runtime || activeVodItem.runtime}
                  </span>
                )}
              </div>
              {(detailedMeta?.description || activeVodItem.description) && (
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  {detailedMeta?.description || activeVodItem.description}
                </p>
              )}
              {detailedMeta?.cast && detailedMeta.cast.length > 0 && (
                <p className="text-xs text-zinc-400">
                  <strong className="text-zinc-200">Distribuție:</strong>{' '}
                  {detailedMeta.cast.slice(0, 6).join(', ')}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => toggleSaveVodItem(activeVodItem)}
              className={`min-h-[38px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors ${
                savedItems.some((x) => x.id === activeVodItem.id)
                  ? 'bg-rose-600 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
              }`}
            >
              <Heart
                className={`w-4 h-4 ${
                  savedItems.some((x) => x.id === activeVodItem.id)
                    ? 'fill-current'
                    : ''
                }`}
              />
              <span>
                {savedItems.some((x) => x.id === activeVodItem.id)
                  ? 'Salvat în Mediatecă'
                  : 'Salvează în Lista Mea'}
              </span>
            </button>
          </div>
        </section>
      )}

      {/* MOVIES / SERIES / SAVED CATALOG */}
      {(activeTab === 'movies' ||
        activeTab === 'series' ||
        activeTab === 'saved') && (
        <>
          {activeTab !== 'saved' && (
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="w-5 h-5 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === 'series'
                      ? 'Caută orice serial (ex: Breaking Bad, Game of Thrones, The Sopranos, Chernobyl, Stranger Things, Бригада)...'
                      : 'Caută orice film (ex: Dune, Gladiator, Oppenheimer, Interstellar, John Wick, Avatar, Мастер и Маргарита)...'
                  }
                  className="w-full min-h-[44px] pl-11 pr-10 py-2 rounded-full bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 transition-shadow"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Single-row Genre Filter Pills */}
              {!debouncedQuery && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {GENRE_FILTERS.map((g) => {
                    const active = selectedGenre === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSelectedGenre(g.id)}
                        className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                          active
                            ? 'bg-brand-700 text-white dark:bg-brand-600 shadow-xs'
                            : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-800 hover:border-brand-400'
                        }`}
                      >
                        <span aria-hidden="true">{g.emoji}</span>
                        <span>{g.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Poster Grid */}
          {isLoading && activeTab !== 'saved' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: 18 }).map((_, idx) => (
                <div
                  key={idx}
                  className="aspect-[2/3] rounded-2xl bg-slate-200/70 dark:bg-zinc-800/60 animate-pulse"
                />
              ))}
            </div>
          ) : displayedItems.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-center space-y-3">
              <p className="text-base font-bold text-slate-800 dark:text-zinc-200">
                {activeTab === 'saved'
                  ? 'Nu ai salvat încă niciun film sau serial în Lista Mea'
                  : 'Niciun film sau serial găsit pentru această căutare'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('movies');
                  setSearchQuery('');
                  setSelectedGenre('top');
                }}
                className="min-h-[38px] px-5 py-2 rounded-full bg-brand-600 text-white text-xs font-semibold"
              >
                Explorează Filmele Populare
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {displayedItems.map((item) => {
                  const isSaved = savedItems.some((x) => x.id === item.id);
                  const isPlayingNow = activeVodItem?.id === item.id;
                  const posterUrl =
                    item.poster ||
                    `https://images.metahub.space/poster/medium/${item.id}/img`;

                  return (
                    <article
                      key={`${item.type}_${item.id}`}
                      onClick={() => {
                        setActiveVodItem(item);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`group cursor-pointer rounded-2xl border overflow-hidden flex flex-col justify-between transition-all duration-200 ${
                        isPlayingNow
                          ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-500 ring-2 ring-brand-500/40 shadow-md'
                          : 'bg-white dark:bg-zinc-900 border-slate-200/80 dark:border-zinc-800/90 hover:border-brand-400 hover:shadow-xl hover:-translate-y-0.5'
                      }`}
                    >
                      {/* 2:3 Movie Poster */}
                      <div className="relative aspect-[2/3] w-full bg-zinc-900 overflow-hidden">
                        <img
                          src={posterUrl}
                          alt={item.name}
                          loading="lazy"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = 'none';
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />

                        {/* Top Badges */}
                        <div className="absolute top-2 inset-x-2 flex items-center justify-between gap-1">
                          {item.imdbRating ? (
                            <span className="px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-xs text-amber-400 text-[11px] font-extrabold inline-flex items-center gap-1 shadow-xs">
                              <Star className="w-3 h-3 fill-current" />
                              {item.imdbRating}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-black/75 text-white text-[10px] font-bold uppercase">
                              {item.type === 'series' ? 'SERIAL' : 'FILM HD'}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => toggleSaveVodItem(item, e)}
                            aria-label="Salvează"
                            className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-xs transition-colors ${
                              isSaved
                                ? 'bg-rose-600 text-white'
                                : 'bg-black/60 hover:bg-black/80 text-white'
                            }`}
                          >
                            <Heart
                              className={`w-4 h-4 ${
                                isSaved ? 'fill-current' : ''
                              }`}
                            />
                          </button>
                        </div>

                        {/* Play Overlay on Hover */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center p-3 transition-opacity">
                          <div className="w-12 h-12 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                            <Play className="w-6 h-6 fill-current ml-0.5" />
                          </div>
                          <span className="mt-2 px-3 py-1 rounded-full bg-black/80 text-white text-xs font-bold">
                            {item.type === 'series'
                              ? 'Vezi Episoadele'
                              : 'Redă Filmul'}
                          </span>
                        </div>
                      </div>

                      {/* Card Info */}
                      <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 line-clamp-1 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                            {item.name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 dark:text-zinc-400 whitespace-nowrap overflow-hidden">
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold">
                              {item.type === 'series' ? 'Serial' : 'Film'}
                            </span>
                            {(item.releaseInfo || item.year) && (
                              <>
                                <span>•</span>
                                <span className="inline-flex items-center gap-0.5">
                                  <Calendar className="w-3 h-3" />
                                  {item.releaseInfo || item.year}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {item.genres && item.genres.length > 0 && (
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                            {item.genres.slice(0, 2).join(' • ')}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Load More Button */}
              {activeTab !== 'saved' && hasMore && (
                <div className="flex justify-center pt-4">
                  <button
                    type="button"
                    disabled={isLoadingMore}
                    onClick={() => void handleLoadMore()}
                    className="min-h-[42px] px-6 py-2 rounded-full bg-brand-700 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 shadow-sm transition-colors"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Se încarcă...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>
                          Încarcă mai multe{' '}
                          {activeTab === 'series' ? 'seriale' : 'filme'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* LAMPA SMART TV WEB PLAYER + PLUGINS */}
      {activeTab === 'lampa' && (
        <div className="space-y-5">
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Server Lampa:
              </span>
              <button
                type="button"
                onClick={() => setLampaServer('https://yumata.github.io/lampa/')}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  lampaServer.includes('yumata')
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                }`}
              >
                Lampa Official (GitHub HTTPS)
              </button>
              <button
                type="button"
                onClick={() => setLampaServer('http://lampa.mx/')}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  lampaServer.includes('lampa.mx')
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                }`}
              >
                Lampa.mx (Mirror Direct)
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFullscreenLampa}
                className="min-h-[38px] px-4 py-1.5 rounded-full bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Ecran Complet (Fullscreen)</span>
              </button>
              <a
                href={lampaServer}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] px-4 py-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Deschide în filă nouă</span>
              </a>
            </div>
          </div>

          <div
            ref={lampaContainerRef}
            className="relative w-full aspect-video min-h-[540px] rounded-2xl overflow-hidden bg-black border-2 border-zinc-800 shadow-xl"
          >
            <iframe
              key={lampaServer}
              src={lampaServer}
              title="Lampa Smart TV VOD Catalog"
              className="w-full h-full border-0"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                Plugin-uri Lampa Verificate (Filme & Seriale în limbi diferite + Subtitrări)
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
                Cum se activează în Lampa de mai sus: mergi în{' '}
                <strong>Настройки (⚙️ dreapta-sus) → Расширения (Extensions) → Добавить плагин (Add Plugin)</strong>{' '}
                și lipește oricare dintre linkurile de mai jos:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {LAMPA_PLUGINS.map((plugin) => {
                const isCopied = copiedPluginUrl === plugin.url;
                return (
                  <div
                    key={plugin.url}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200/80 dark:border-zinc-800 flex flex-col justify-between gap-2.5"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                          {plugin.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold shrink-0">
                          {plugin.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
                        {plugin.desc}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-zinc-800">
                      <code className="text-[11px] font-mono text-brand-700 dark:text-brand-300 truncate">
                        {plugin.url}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopyPlugin(plugin.url)}
                        className={`min-h-[34px] px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors ${
                          isCopied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-brand-600 hover:bg-brand-500 text-white'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copiat!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiază URL</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM VOD FILE / LINK PLAYER */}
      {activeTab === 'custom' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 flex items-center justify-center shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                    Încarcă Arhivă Filme .M3U / iEdem VOD
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-zinc-400">
                    Încarcă un fișier <code>.m3u</code> / <code>.m3u8</code> cu filme și seriale on-demand.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl,text/plain"
                  onChange={handleUploadM3uFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[42px] px-4 py-2 rounded-full bg-brand-700 hover:bg-brand-600 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span>Alege fișier .M3U / .M3U8</span>
                </button>
                {customTvChannels.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCustomTvChannels}
                    className="min-h-[42px] px-4 py-2 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-semibold"
                  >
                    Șterge lista importată ({customTvChannels.length})
                  </button>
                )}
              </div>

              <form
                onSubmit={handleImportM3uUrl}
                className="space-y-2.5 pt-2 border-t border-slate-200/70 dark:border-zinc-800"
              >
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Sau lipește URL-ul către o listă VOD .M3U:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={m3uPlaylistUrl}
                    onChange={(e) => setM3uPlaylistUrl(e.target.value)}
                    placeholder="https://.../vod_movies.m3u8"
                    className="flex-1 min-h-[42px] px-4 py-2 rounded-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-sm"
                  />
                  <button
                    type="submit"
                    className="min-h-[42px] px-5 py-2 rounded-full bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shrink-0"
                  >
                    Importă
                  </button>
                </div>
              </form>

              {importStatus && (
                <div className="p-3 rounded-xl bg-brand-50 dark:bg-brand-950/50 border border-brand-200 dark:border-brand-800 text-xs font-medium text-brand-800 dark:text-brand-200">
                  {importStatus}
                </div>
              )}
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <Play className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                    Redă Link Video Direct (.MP4, .MKV, .M3U8)
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-zinc-400">
                    Redă orice fișier sau link video direct în player cu suport pentru subtitrare <code>.SRT</code> / <code>.VTT</code>.
                  </p>
                </div>
              </div>

              <form onSubmit={handlePlayDirectStream} className="space-y-3">
                <input
                  type="text"
                  value={directStreamTitle}
                  onChange={(e) => setDirectStreamTitle(e.target.value)}
                  placeholder="Titlu Film (opțional)"
                  className="w-full min-h-[42px] px-4 py-2 rounded-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-sm"
                />
                <input
                  type="url"
                  required
                  value={directStreamUrl}
                  onChange={(e) => setDirectStreamUrl(e.target.value)}
                  placeholder="https://.../movie.mp4 sau .m3u8"
                  className="w-full min-h-[42px] px-4 py-2 rounded-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-sm"
                />
                <button
                  type="submit"
                  className="min-h-[42px] px-5 py-2 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Pornește Filmul</span>
                </button>
              </form>
            </div>
          </div>

          {customTvChannels.length > 0 && (
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                Filme & Video Importate ({customTvChannels.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto">
                {customTvChannels.slice(0, 90).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => playTvChannel(item, customTvChannels)}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950/70 hover:bg-brand-50 dark:hover:bg-zinc-800 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between gap-2 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                        {item.group}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-brand-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Film,
  Tv,
  Radio,
  Search,
  Clock,
  Heart,
  Play,
  Star,
  RotateCcw,
  Subtitles,
  ArrowLeft,
  Maximize2,
  Popcorn,
  Monitor,
  Loader2,
  Sparkles,
  Volume2,
  Pause,
  Delete,
  Globe,
  Layers,
} from 'lucide-react';
import { useRadioStore } from '../store/useRadioStore';
import { fetchTvChannelsByCountry } from '../services/tvApi';
import { fetchStationsByCountry } from '../services/radioBrowserApi';
import { TvChannel, Station } from '../types/radio';
import { VodNativeHlsPlayer } from '../components/tv/VodNativeHlsPlayer';
import { OnlineSubtitleFinderModal } from '../components/tv/OnlineSubtitleFinderModal';
import { TvPlayerModal } from '../components/tv/TvPlayerModal';
import { GlobalPlayer } from '../components/player/GlobalPlayer';

interface SmartTvLampaViewProps {
  onExitTvMode: () => void;
}

type TvSectionId =
  | 'movies'
  | 'series'
  | 'tv'
  | 'radio'
  | 'search'
  | 'history'
  | 'saved';

type OriginCountryId = 'ALL' | 'RU' | 'RO' | 'US' | 'TR' | 'KR' | 'GB' | 'FR';

type VodServerId =
  | 'kinogram_hls'
  | 'kinogram_embed'
  | 'vidspark'
  | 'vidzee'
  | 'nontongo'
  | 'vidsrc_pm';

type SubtitleLangId = 'ro' | 'ru' | 'en';

interface CinemetaItem {
  id: string;
  kpId?: string;
  moviedb_id?: number | string;
  type: 'movie' | 'series';
  name: string;
  releaseInfo?: string;
  year?: string;
  imdbRating?: string;
  poster?: string;
  background?: string;
  genres?: string[];
  description?: string;
}

interface SeriesEpisode {
  id: string;
  name: string;
  season: number;
  episode: number;
  number?: number;
  overview?: string;
  description?: string;
}

interface DetailedMeta extends CinemetaItem {
  videos?: SeriesEpisode[];
}

interface ResolvedDirectVodStream {
  ok: boolean;
  type?: 'movie' | 'series';
  sourcePath?: string;
  hlsUrl?: string;
  title?: string;
  duration?: number;
  audioNames?: string[];
  seasons?: Array<{
    season: number;
    episodes: Array<{
      episode: number;
      title: string;
      duration: number;
      audioNames?: string[];
    }>;
  }>;
}

interface EpisodeProgress {
  currentTime: number;
  duration: number;
  updatedAt: number;
}

interface VodWatchProgressEntry {
  item: CinemetaItem;
  season: number;
  episode: number;
  currentTime: number;
  duration: number;
  server: VodServerId;
  subLang: SubtitleLangId;
  updatedAt: number;
  episodeProgressMap?: Record<string, EpisodeProgress>;
}

const SAVED_VOD_STORAGE_KEY = 'aether_saved_vod_items_v1';
const WATCH_PROGRESS_STORAGE_KEY = 'aether_vod_watch_progress_v1';

const TV_ORIGIN_COUNTRIES: Array<{
  id: OriginCountryId;
  label: string;
  kpCountryId?: number;
}> = [
  { id: 'ALL', label: 'Global (Populare)' },
  { id: 'RU', label: 'Rusia (RU)', kpCountryId: 34 },
  { id: 'RO', label: 'România (RO)', kpCountryId: 37 },
  { id: 'US', label: 'SUA (Hollywood)', kpCountryId: 1 },
  { id: 'TR', label: 'Turcia (TR)', kpCountryId: 44 },
  { id: 'KR', label: 'Coreea (K-Drama)', kpCountryId: 49 },
  { id: 'GB', label: 'Marea Britanie (UK)', kpCountryId: 5 },
  { id: 'FR', label: 'Franța', kpCountryId: 3 },
];

const TV_GENRE_PILLS: Array<{ id: string; label: string; kpGenreId?: number }> = [
  { id: 'top', label: 'Populare Acum' },
  { id: 'imdbRating', label: 'Top IMDb' },
  { id: '2025-2026', label: 'Noi 2025–2026' },
  { id: 'Action', label: 'Acțiune', kpGenreId: 11 },
  { id: 'Sci-Fi', label: 'Sci-Fi', kpGenreId: 6 },
  { id: 'Thriller', label: 'Thriller', kpGenreId: 1 },
  { id: 'Comedy', label: 'Comedie', kpGenreId: 13 },
  { id: 'Drama', label: 'Dramă', kpGenreId: 2 },
  { id: 'Crime', label: 'Crimă', kpGenreId: 3 },
  { id: 'Horror', label: 'Horror', kpGenreId: 17 },
  { id: 'Animation', label: 'Animație', kpGenreId: 18 },
];

const TV_LIVE_REGIONS: Array<{ id: string; label: string; country: string; group?: string }> = [
  { id: 'RO', label: 'România HD', country: 'RO' },
  { id: 'MD', label: 'Moldova HD', country: 'MD' },
  { id: 'RU', label: 'Rusia (RU)', country: 'RU' },
  { id: 'NEWS', label: 'Știri Live', country: 'RO', group: 'News' },
  { id: 'MOVIES', label: 'Filme & Seriale TV', country: 'RU', group: 'Кино' },
  { id: 'MUSIC', label: 'Muzică TV', country: 'RO', group: 'Music' },
  { id: 'DOC', label: 'Documentare', country: 'RO', group: 'Documentary' },
  { id: 'KIDS', label: 'Desene & Copii', country: 'RO', group: 'Kids' },
];

const RADIO_COUNTRIES: Array<{ code: string; label: string }> = [
  { code: 'RO', label: 'România' },
  { code: 'MD', label: 'Moldova' },
  { code: 'RU', label: 'Rusia' },
  { code: 'US', label: 'SUA' },
  { code: 'GB', label: 'UK' },
  { code: 'FR', label: 'Franța' },
  { code: 'DE', label: 'Germania' },
  { code: 'IT', label: 'Italia' },
  { code: 'ES', label: 'Spania' },
];

const VOD_SERVERS: Array<{ id: VodServerId; label: string }> = [
  { id: 'kinogram_hls', label: 'S1: Player Nativ HD (Audio RU / Original)' },
  { id: 'kinogram_embed', label: 'S2: Kinogram Multi-Audio' },
  { id: 'vidspark', label: 'S3: VidSpark HD (Sub RO/RU/EN)' },
  { id: 'vidzee', label: 'S4: VidZee Multi-Server' },
  { id: 'nontongo', label: 'S5: NontonGo 4K' },
  { id: 'vidsrc_pm', label: 'S6: VidSrc OpenSubtitles' },
];

const ON_SCREEN_KEYS_LATIN = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3',
  '4', '5', '6', '7', '8', '9',
];

const ON_SCREEN_KEYS_CYRILLIC = [
  'А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'Й',
  'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У',
  'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Ы', 'Э', 'Ю', 'Я',
];

function formatWatchSeconds(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds || 0));
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const rem = sec % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function loadWatchProgressMap(): Record<string, VodWatchProgressEntry> {
  try {
    const raw = localStorage.getItem(WATCH_PROGRESS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveWatchProgressMap(map: Record<string, VodWatchProgressEntry>): void {
  try {
    localStorage.setItem(WATCH_PROGRESS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

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
  subLang: SubtitleLangId,
  startSeconds: number
): string {
  const imdbId = item.id.startsWith('tt') ? item.id : '';
  const kpId =
    item.kpId || (item.id.startsWith('kp_') ? item.id.replace(/^kp_/, '') : '');
  const tmdbOrImdbId = item.moviedb_id
    ? String(item.moviedb_id)
    : imdbId || kpId;
  const isSeries = item.type === 'series';
  const start = Math.max(0, Math.floor(startSeconds || 0));

  switch (server) {
    case 'kinogram_hls':
    case 'kinogram_embed': {
      const path = kpId ? `kp/${kpId}` : `imdb/${imdbId}`;
      const qs = isSeries ? `?season=${season}&episode=${episode}` : '';
      return `https://api.kinogram.best/embed/${path}${qs}`;
    }
    case 'vidspark': {
      const params = new URLSearchParams();
      params.set('autoplay', 'true');
      params.set('lang', subLang);
      if (start > 5) {
        params.set('startAt', String(start));
        params.set('t', String(start));
      }
      return isSeries
        ? `https://vidspark.to/tv/${imdbId}/${season}/${episode}?${params.toString()}`
        : `https://vidspark.to/movie/${imdbId}?${params.toString()}`;
    }
    case 'vidzee': {
      const params = new URLSearchParams();
      if (start > 5) params.set('startAt', String(start));
      const qs = params.toString();
      const suffix = qs ? `?${qs}` : '';
      return isSeries
        ? `https://player.vidzee.wtf/embed/tv/${tmdbOrImdbId}/${season}/${episode}${suffix}`
        : `https://player.vidzee.wtf/embed/movie/${tmdbOrImdbId}${suffix}`;
    }
    case 'nontongo': {
      const params = new URLSearchParams();
      params.set('autoplay', '1');
      if (start > 5) {
        params.set('start', String(start));
        params.set('t', String(start));
      }
      return isSeries
        ? `https://nontongo.win/embed/tv/${imdbId}/${season}/${episode}?${params.toString()}`
        : `https://nontongo.win/embed/movie/${imdbId}?${params.toString()}`;
    }
    case 'vidsrc_pm': {
      const params = new URLSearchParams();
      params.set('autoplay', 'true');
      params.set('ds_lang', subLang);
      if (start > 5) {
        params.set('startAt', String(start));
        params.set('t', String(start));
      }
      return isSeries
        ? `https://vidsrc.pm/embed/tv/${imdbId}/${season}/${episode}?${params.toString()}`
        : `https://vidsrc.pm/embed/movie/${imdbId}?${params.toString()}`;
    }
  }
}

export const SmartTvLampaView: React.FC<SmartTvLampaViewProps> = ({
  onExitTvMode,
}) => {
  const playTvChannel = useRadioStore((state) => state.playTvChannel);
  const currentStation = useRadioStore((state) => state.currentStation);
  const playerStatus = useRadioStore((state) => state.playerStatus);
  const playStation = useRadioStore((state) => state.playStation);
  const stopRadio = useRadioStore((state) => state.stopRadio);

  // Clock in top-right corner like Lampa
  const [clockText, setClockText] = useState<string>(() => {
    const now = new Date();
    return now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      setClockText(
        now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
      );
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  // Main TV Navigation Section
  const [section, setSection] = useState<TvSectionId>('movies');

  // VOD Catalog Filters
  const [originCountry, setOriginCountry] = useState<OriginCountryId>('ALL');
  const [selectedGenre, setSelectedGenre] = useState<string>('top');
  const [vodItems, setVodItems] = useState<CinemetaItem[]>([]);
  const [isVodLoading, setIsVodLoading] = useState<boolean>(true);
  const [vodPage, setVodPage] = useState<number>(1);
  const [hasMoreVod, setHasMoreVod] = useState<boolean>(true);
  const [isLoadingMoreVod, setIsLoadingMoreVod] = useState<boolean>(false);

  // Focused Spotlight Item for Hero Banner
  const [spotlightItem, setSpotlightItem] = useState<{
    title: string;
    subtitle: string;
    rating?: string;
    badge?: string;
    description?: string;
    backdrop?: string;
  } | null>(null);

  // Live TV State
  const [tvRegionId, setTvRegionId] = useState<string>('RO');
  const [tvChannels, setTvChannels] = useState<TvChannel[]>([]);
  const [isTvLoading, setIsTvLoading] = useState<boolean>(false);

  // Radio State
  const [radioCountry, setRadioCountry] = useState<string>('RO');
  const [radioStations, setRadioStations] = useState<Station[]>([]);
  const [isRadioLoading, setIsRadioLoading] = useState<boolean>(false);

  // Search State (with On-Screen TV Remote Keyboard)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [keyboardAlphabet, setKeyboardAlphabet] = useState<'LAT' | 'CYR'>('LAT');
  const [searchResults, setSearchResults] = useState<CinemetaItem[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState<boolean>(false);

  // Watch Progress & Saved Items
  const [watchProgressMap, setWatchProgressMap] = useState<
    Record<string, VodWatchProgressEntry>
  >(() => loadWatchProgressMap());
  const [savedVodItems, setSavedVodItems] = useState<CinemetaItem[]>(() =>
    loadSavedVodItems()
  );

  // Active VOD Movie/Series Fullscreen Detail & Player
  const [activeVodItem, setActiveVodItem] = useState<CinemetaItem | null>(null);
  const [detailedMeta, setDetailedMeta] = useState<DetailedMeta | null>(null);
  const [resolvedDirectStream, setResolvedDirectStream] =
    useState<ResolvedDirectVodStream | null>(null);
  const [isDirectStreamLoading, setIsDirectStreamLoading] =
    useState<boolean>(false);
  const [activeServer, setActiveServer] = useState<VodServerId>('kinogram_hls');
  const [preferredSubLang, setPreferredSubLang] = useState<SubtitleLangId>('ro');
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [resumeStartSeconds, setResumeStartSeconds] = useState<number>(0);
  const [pendingResumePromptSec, setPendingResumePromptSec] = useState<
    number | null
  >(null);
  const [isSubFinderOpen, setIsSubFinderOpen] = useState<boolean>(false);
  const [activeSubVttUrl, setActiveSubVttUrl] = useState<string | null>(null);
  const [activeSubLabel, setActiveSubLabel] = useState<string>('');

  const playerBoxRef = useRef<HTMLDivElement | null>(null);

  // Handle Escape / Back button to exit activeVodItem first before leaving TV mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.keyCode === 461 || e.keyCode === 10009) {
        if (isSubFinderOpen) {
          e.preventDefault();
          setIsSubFinderOpen(false);
          return;
        }
        if (activeVodItem) {
          e.preventDefault();
          setActiveVodItem(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeVodItem, isSubFinderOpen]);

  // Fetch Kinopoisk or Cinemeta catalog for Movies / Series
  const fetchVodCatalog = useCallback(
    async (pageNum: number, append: boolean) => {
      const mediaType: 'movie' | 'series' =
        section === 'series' ? 'series' : 'movie';
      const countryObj = TV_ORIGIN_COUNTRIES.find((c) => c.id === originCountry);
      const genreObj = TV_GENRE_PILLS.find((g) => g.id === selectedGenre);
      const isYearFilter = selectedGenre === '2025-2026';
      const useKinopoisk = originCountry !== 'ALL' || isYearFilter;

      if (append) {
        setIsLoadingMoreVod(true);
      } else {
        setIsVodLoading(true);
      }

      try {
        if (useKinopoisk) {
          const kpType = mediaType === 'series' ? 'TV_SERIES' : 'FILM';
          const order = selectedGenre === 'imdbRating' ? 'RATING' : 'NUM_VOTE';
          const qs = new URLSearchParams();
          qs.set('type', kpType);
          qs.set('order', order);
          qs.set('page', String(pageNum));
          if (countryObj?.kpCountryId) {
            qs.set('countries', String(countryObj.kpCountryId));
          }
          if (genreObj?.kpGenreId) {
            qs.set('genres', String(genreObj.kpGenreId));
          }
          if (isYearFilter) {
            qs.set('yearFrom', '2025');
            qs.set('yearTo', '2026');
          }

          const res = await fetch(
            `https://kinopoiskapiunofficial.tech/api/v2.2/films?${qs.toString()}`,
            {
              headers: {
                'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
              },
            }
          );
          if (!res.ok) throw new Error('KP error');
          const data = (await res.json()) as {
            totalPages?: number;
            items?: Array<{
              kinopoiskId: number;
              imdbId?: string | null;
              nameRu?: string | null;
              nameEn?: string | null;
              nameOriginal?: string | null;
              year?: number | string | null;
              ratingKinopoisk?: number | null;
              ratingImdb?: number | null;
              posterUrlPreview?: string;
              posterUrl?: string;
              genres?: Array<{ genre: string }>;
            }>;
          };

          const preferRu = originCountry === 'RU';
          const mapped: CinemetaItem[] = (data.items || []).map((f) => {
            const title = preferRu
              ? f.nameRu || f.nameOriginal || f.nameEn || `Film #${f.kinopoiskId}`
              : f.nameOriginal || f.nameEn || f.nameRu || `Film #${f.kinopoiskId}`;
            const validImdb =
              f.imdbId && /^tt\d+$/.test(f.imdbId) ? f.imdbId : '';
            const ratingVal = f.ratingKinopoisk || f.ratingImdb;
            return {
              id: validImdb || `kp_${f.kinopoiskId}`,
              kpId: String(f.kinopoiskId),
              type: mediaType,
              name: title,
              releaseInfo:
                f.year && String(f.year) !== 'null' ? String(f.year) : undefined,
              imdbRating: ratingVal ? String(ratingVal) : undefined,
              poster: f.posterUrlPreview || f.posterUrl,
              background: f.posterUrl || f.posterUrlPreview,
              genres: f.genres?.map((g) => g.genre).filter(Boolean),
            };
          });

          setVodItems((prev) => {
            if (!append) return mapped;
            const seen = new Set(prev.map((x) => x.id));
            return [...prev, ...mapped.filter((x) => !seen.has(x.id))];
          });
          setHasMoreVod(pageNum < (data.totalPages || 1));
          if (!append && mapped[0]) {
            setSpotlightItem({
              title: mapped[0].name,
              subtitle: `${mapped[0].releaseInfo || '2025'} • ${(mapped[0].genres || []).slice(0, 3).join(', ')}`,
              rating: mapped[0].imdbRating,
              badge: mediaType === 'series' ? 'SERIAL TV' : 'FILM HD',
              description: mapped[0].description,
              backdrop: mapped[0].background || mapped[0].poster,
            });
          }
        } else {
          const skip = (pageNum - 1) * 50;
          let url = '';
          if (selectedGenre === 'top') {
            url =
              skip > 0
                ? `https://v3-cinemeta.strem.io/catalog/${mediaType}/top/skip=${skip}.json`
                : `https://v3-cinemeta.strem.io/catalog/${mediaType}/top.json`;
          } else if (selectedGenre === 'imdbRating') {
            url =
              skip > 0
                ? `https://v3-cinemeta.strem.io/catalog/${mediaType}/imdbRating/skip=${skip}.json`
                : `https://v3-cinemeta.strem.io/catalog/${mediaType}/imdbRating.json`;
          } else {
            url =
              skip > 0
                ? `https://v3-cinemeta.strem.io/catalog/${mediaType}/top/genre=${encodeURIComponent(selectedGenre)}&skip=${skip}.json`
                : `https://v3-cinemeta.strem.io/catalog/${mediaType}/top/genre=${encodeURIComponent(selectedGenre)}.json`;
          }

          const res = await fetch(url);
          const data = (await res.json()) as { metas?: CinemetaItem[] };
          const list = (data.metas || []).map((m) => ({
            ...m,
            type: mediaType,
          }));

          setVodItems((prev) => {
            if (!append) return list;
            const seen = new Set(prev.map((x) => x.id));
            return [...prev, ...list.filter((x) => !seen.has(x.id))];
          });
          setHasMoreVod(list.length >= 30);
          if (!append && list[0]) {
            setSpotlightItem({
              title: list[0].name,
              subtitle: `${list[0].releaseInfo || ''} • ${(list[0].genres || []).slice(0, 3).join(', ')}`,
              rating: list[0].imdbRating,
              badge: mediaType === 'series' ? 'SERIAL TV' : 'FILM HD',
              description: list[0].description,
              backdrop:
                list[0].background ||
                list[0].poster ||
                `https://images.metahub.space/background/medium/${list[0].id}/img`,
            });
          }
        }
      } catch {
        if (!append) setVodItems([]);
      } finally {
        setIsVodLoading(false);
        setIsLoadingMoreVod(false);
      }
    },
    [section, originCountry, selectedGenre]
  );

  useEffect(() => {
    if (section === 'movies' || section === 'series') {
      setVodPage(1);
      void fetchVodCatalog(1, false);
    }
  }, [section, originCountry, selectedGenre, fetchVodCatalog]);

  // Fetch Live TV channels when in TV section
  useEffect(() => {
    if (section !== 'tv') return;
    let cancelled = false;
    setIsTvLoading(true);
    const region =
      TV_LIVE_REGIONS.find((r) => r.id === tvRegionId) || TV_LIVE_REGIONS[0];

    fetchTvChannelsByCountry(region.country)
      .then((channels) => {
        if (cancelled) return;
        const filtered = region.group
          ? channels.filter((ch) =>
              (ch.group || '')
                .toLowerCase()
                .includes(region.group!.toLowerCase())
            )
          : channels;
        const result = (filtered.length > 0 ? filtered : channels).slice(0, 120);
        setTvChannels(result);
        if (result[0]) {
          setSpotlightItem({
            title: result[0].name,
            subtitle: `${result[0].countryCode} • ${result[0].group || 'TV Live HD'}`,
            badge: 'CANAL TV LIVE',
            description:
              'Apasă OK pe telecomandă pentru redare directă Fullscreen cu program EPG și schimbare rapidă de canal.',
            backdrop: result[0].logo,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setTvChannels([]);
      })
      .finally(() => {
        if (!cancelled) setIsTvLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [section, tvRegionId]);

  // Fetch Radio stations when in Radio section
  useEffect(() => {
    if (section !== 'radio') return;
    let cancelled = false;
    setIsRadioLoading(true);

    fetchStationsByCountry(radioCountry)
      .then((stations) => {
        if (cancelled) return;
        const top = stations.slice(0, 120);
        setRadioStations(top);
        if (top[0]) {
          setSpotlightItem({
            title: top[0].name,
            subtitle: `${top[0].country || radioCountry} • ${top[0].tags || 'Radio Live'}`,
            badge: top[0].bitrate ? `${top[0].bitrate} kbps` : 'RADIO LIVE',
            description:
              'Apasă OK pe telecomandă pentru a asculta postul în direct cu afișarea piesei curente.',
            backdrop: top[0].favicon,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setRadioStations([]);
      })
      .finally(() => {
        if (!cancelled) setIsRadioLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [section, radioCountry]);

  // Search execution (both Kinopoisk & Cinemeta)
  useEffect(() => {
    if (section !== 'search') return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearchLoading(true);
      try {
        const [kpRes, movieRes, seriesRes] = await Promise.allSettled([
          fetch(
            `https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(
              q
            )}&page=1`,
            {
              headers: {
                'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
              },
            }
          ).then((r) => (r.ok ? r.json() : { films: [] })),
          fetch(
            `https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(
              q
            )}.json`
          ).then((r) => (r.ok ? r.json() : { metas: [] })),
          fetch(
            `https://v3-cinemeta.strem.io/catalog/series/top/search=${encodeURIComponent(
              q
            )}.json`
          ).then((r) => (r.ok ? r.json() : { metas: [] })),
        ]);

        if (cancelled) return;

        const combined: CinemetaItem[] = [];
        if (kpRes.status === 'fulfilled' && Array.isArray(kpRes.value.films)) {
          for (const f of kpRes.value.films.slice(0, 16)) {
            const isSeries =
              f.type === 'TV_SERIES' ||
              f.type === 'MINI_SERIES' ||
              f.type === 'TV_SHOW';
            combined.push({
              id: `kp_${f.filmId}`,
              kpId: String(f.filmId),
              type: isSeries ? 'series' : 'movie',
              name: f.nameRu || f.nameEn || `Film #${f.filmId}`,
              releaseInfo: f.year && f.year !== 'null' ? f.year : undefined,
              imdbRating:
                f.rating && f.rating !== 'null' && !f.rating.includes('%')
                  ? f.rating
                  : undefined,
              poster: f.posterUrlPreview || f.posterUrl,
              description: f.description,
            });
          }
        }
        if (
          movieRes.status === 'fulfilled' &&
          Array.isArray(movieRes.value.metas)
        ) {
          for (const m of movieRes.value.metas.slice(0, 16)) {
            combined.push({ ...m, type: 'movie' });
          }
        }
        if (
          seriesRes.status === 'fulfilled' &&
          Array.isArray(seriesRes.value.metas)
        ) {
          for (const s of seriesRes.value.metas.slice(0, 16)) {
            combined.push({ ...s, type: 'series' });
          }
        }

        setSearchResults(combined);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setIsSearchLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [section, searchQuery]);

  // Open Movie/Series in Lampa Fullscreen Player View
  const handleOpenVod = useCallback((item: CinemetaItem) => {
    const saved = watchProgressMap[item.id];
    const targetSeason = saved?.season || 1;
    const targetEpisode = saved?.episode || 1;
    const epKey = `S${targetSeason}E${targetEpisode}`;
    const epSaved = saved?.episodeProgressMap?.[epKey];
    const startSec =
      item.type === 'series'
        ? (epSaved?.currentTime ?? saved?.currentTime ?? 0)
        : (saved?.currentTime ?? 0);

    setActiveVodItem(item);
    setSelectedSeason(targetSeason);
    setSelectedEpisode(targetEpisode);
    setActiveServer('kinogram_hls');
    setActiveSubVttUrl(null);
    setActiveSubLabel('');

    if (startSec > 10) {
      setPendingResumePromptSec(startSec);
      setResumeStartSeconds(startSec);
    } else {
      setPendingResumePromptSec(null);
      setResumeStartSeconds(0);
    }
  }, [watchProgressMap]);

  // Fetch detailed meta & direct HLS stream when activeVodItem changes
  useEffect(() => {
    if (!activeVodItem) {
      setDetailedMeta(null);
      setResolvedDirectStream(null);
      return;
    }

    let cancelled = false;
    setIsDirectStreamLoading(true);

    if (activeVodItem.id.startsWith('tt')) {
      fetch(
        `https://v3-cinemeta.strem.io/meta/${activeVodItem.type}/${activeVodItem.id}.json`
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d?.meta) setDetailedMeta(d.meta);
        })
        .catch(() => {});
    } else {
      setDetailedMeta({ ...activeVodItem });
    }

    const kp =
      activeVodItem.kpId ||
      (activeVodItem.id.startsWith('kp_')
        ? activeVodItem.id.replace(/^kp_/, '')
        : '');
    const imdb = activeVodItem.id.startsWith('tt') ? activeVodItem.id : '';
    const qs = new URLSearchParams({
      imdb,
      kp,
      title: activeVodItem.name,
      year: (activeVodItem.releaseInfo || '').slice(0, 4),
      season: String(selectedSeason),
      episode: String(selectedEpisode),
    });

    fetch(`/api/vod-stream?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : { ok: false }))
      .then((data: ResolvedDirectVodStream) => {
        if (!cancelled) setResolvedDirectStream(data);
      })
      .catch(() => {
        if (!cancelled) setResolvedDirectStream({ ok: false });
      })
      .finally(() => {
        if (!cancelled) setIsDirectStreamLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeVodItem, selectedSeason, selectedEpisode]);

  const updateWatchProgress = useCallback(
    (
      item: CinemetaItem,
      season: number,
      episode: number,
      currentTime: number,
      duration: number
    ) => {
      const cleanTime = Math.max(0, Math.floor(currentTime || 0));
      const cleanDur =
        duration && Number.isFinite(duration) && duration > 60
          ? Math.floor(duration)
          : 5400;

      setWatchProgressMap((prev) => {
        const existing = prev[item.id];
        const epKey = `S${season}E${episode}`;
        const nextEntry: VodWatchProgressEntry = {
          item: { ...existing?.item, ...item },
          season,
          episode,
          currentTime: cleanTime,
          duration: cleanDur,
          server: activeServer,
          subLang: preferredSubLang,
          updatedAt: Date.now(),
          episodeProgressMap: {
            ...(existing?.episodeProgressMap || {}),
            [epKey]: {
              currentTime: cleanTime,
              duration: cleanDur,
              updatedAt: Date.now(),
            },
          },
        };
        const next = { ...prev, [item.id]: nextEntry };
        saveWatchProgressMap(next);
        return next;
      });
    },
    [activeServer, preferredSubLang]
  );

  const toggleSaveVodItem = (item: CinemetaItem) => {
    setSavedVodItems((prev) => {
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

  // Seasons & Episodes list for Series
  const seasonsMap = useMemo(() => {
    const map = new Map<number, SeriesEpisode[]>();
    if (
      resolvedDirectStream?.seasons &&
      resolvedDirectStream.seasons.length > 0
    ) {
      for (const s of resolvedDirectStream.seasons) {
        map.set(
          s.season,
          s.episodes.map((ep) => ({
            id: `kp_${s.season}_${ep.episode}`,
            name: ep.title || `Episodul ${ep.episode}`,
            season: s.season,
            episode: ep.episode,
          }))
        );
      }
      return map;
    }

    const videos = detailedMeta?.videos || [];
    for (const v of videos) {
      const sNum = Number(v.season);
      const epNum = Number(v.episode ?? v.number);
      if (!sNum || sNum <= 0 || !epNum) continue;
      const list = map.get(sNum) || [];
      list.push({ ...v, season: sNum, episode: epNum });
      map.set(sNum, list);
    }
    return map;
  }, [detailedMeta, resolvedDirectStream]);

  const availableSeasons = useMemo(
    () => Array.from(seasonsMap.keys()).sort((a, b) => a - b),
    [seasonsMap]
  );

  const episodesForSeason = useMemo(
    () => seasonsMap.get(selectedSeason) || [],
    [seasonsMap, selectedSeason]
  );

  const historyList = useMemo(() => {
    return Object.values(watchProgressMap)
      .filter((e) => e && e.item && e.currentTime >= 5)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [watchProgressMap]);

  return (
    <div className="fixed inset-0 z-40 bg-[#090a0f] text-zinc-100 flex overflow-hidden select-none">
      {/* Dynamic Blurred Cinema Backdrop */}
      {spotlightItem?.backdrop && !activeVodItem && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-35 transition-opacity duration-500"
        >
          <img
            src={spotlightItem.backdrop}
            alt=""
            className="w-full h-full object-cover scale-110 blur-2xl"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#090a0f] via-[#090a0f]/90 to-[#090a0f]/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090a0f] via-[#090a0f]/75 to-transparent" />
        </div>
      )}

      {/* LEFT LAMPA-STYLE TV NAVIGATION RAIL */}
      <aside
        aria-label="Meniu Principal Smart TV"
        className="relative z-20 w-20 sm:w-60 bg-zinc-950/90 backdrop-blur-xl border-r border-white/10 flex flex-col justify-between py-5 px-2.5 sm:px-4 shrink-0"
      >
        {/* Top Brand */}
        <div className="space-y-5">
          <div className="flex items-center gap-3 px-2">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/25 shrink-0">
              <Tv className="w-6 h-6" />
            </div>
            <div className="hidden sm:block min-w-0">
              <div className="text-base font-extrabold tracking-tight text-white truncate">
                AetherTV
              </div>
              <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                Smart TV • Lampa UI
              </div>
            </div>
          </div>

          {/* Main Navigation Buttons */}
          <nav className="space-y-1.5">
            {(
              [
                { id: 'movies', label: 'Filme', Icon: Film },
                { id: 'series', label: 'Seriale', Icon: Tv },
                { id: 'tv', label: 'TV Live HD', Icon: Monitor },
                { id: 'radio', label: 'Radio Live', Icon: Radio },
                { id: 'search', label: 'Căutare TV', Icon: Search },
                {
                  id: 'history',
                  label: `Continuă (${historyList.length})`,
                  Icon: Clock,
                },
                {
                  id: 'saved',
                  label: `Salvate (${savedVodItems.length})`,
                  Icon: Heart,
                },
              ] as const
            ).map(({ id, label, Icon }) => {
              const isActive = section === id && !activeVodItem;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setActiveVodItem(null);
                    setSection(id);
                  }}
                  className={`w-full min-h-[48px] px-3 sm:px-4 py-2.5 rounded-full flex items-center justify-center sm:justify-start gap-3.5 text-sm font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/30 scale-[1.02]'
                      : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="hidden sm:inline truncate">{label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions: Lampa.mx + Exit to Desktop Mode */}
        <div className="space-y-2 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              if (
                !document.fullscreenElement &&
                document.documentElement.requestFullscreen
              ) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
              }
            }}
            className="w-full min-h-[44px] px-3 sm:px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 flex items-center justify-center sm:justify-start gap-3 text-xs font-bold border border-white/10 transition-all cursor-pointer"
          >
            <Maximize2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline truncate">Ecran Complet TV</span>
          </button>

          <button
            type="button"
            onClick={onExitTvMode}
            className="w-full min-h-[44px] px-3 sm:px-4 py-2 rounded-full bg-zinc-900/80 hover:bg-rose-600/20 text-zinc-400 hover:text-rose-300 flex items-center justify-center sm:justify-start gap-3 text-xs font-bold border border-white/10 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline truncate">Mod Web Normal</span>
          </button>
        </div>
      </aside>

      {/* MAIN RIGHT SMART TV CANVAS */}
      <div className="relative z-10 flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Top Smart TV Status Bar */}
        <header className="px-5 sm:px-8 py-3.5 flex items-center justify-between gap-4 border-b border-white/10 bg-zinc-950/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {activeVodItem ? (
              <button
                type="button"
                onClick={() => setActiveVodItem(null)}
                className="h-10 px-4 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shadow-md cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Înapoi la Catalog (Back)
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-zinc-300">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Navigare din telecomandă: Săgeți ◄ ► ▲ ▼ • OK pentru redare •
                  Back pentru înapoi
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {currentStation && playerStatus === 'playing' && (
              <button
                type="button"
                onClick={stopRadio}
                className="h-9 px-3.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <Volume2 className="w-4 h-4 animate-pulse" />
                <span className="max-w-[160px] truncate">
                  {currentStation.name}
                </span>
                <Pause className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="text-lg sm:text-2xl font-extrabold tracking-tight text-white tabular-nums">
              {clockText}
            </div>
          </div>
        </header>

        {/* MAIN SCROLLABLE CONTENT AREA */}
        <main className="flex-1 overflow-y-auto px-5 sm:px-8 py-5 space-y-6">
          {/* 1. ACTIVE MOVIE / SERIES FULLSCREEN PLAYER & EPISODE SELECTOR */}
          {activeVodItem ? (
            <div className="space-y-5 pb-16">
              {/* Movie/Series Title & Controls Bar */}
              <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/90 border border-white/15 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                  <span className="px-3 py-1 rounded-full bg-amber-500 text-zinc-950 text-xs font-extrabold uppercase">
                    {activeVodItem.type === 'series'
                      ? `S${selectedSeason}:E${selectedEpisode}`
                      : 'FILM HD'}
                  </span>
                  <h1 className="text-lg sm:text-2xl font-extrabold text-white truncate">
                    {activeVodItem.name}
                  </h1>
                  {activeVodItem.imdbRating && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold inline-flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {activeVodItem.imdbRating}
                    </span>
                  )}
                </div>

                {/* Action Pills: Subtitrări Online + Favorite + Fullscreen */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSubFinderOpen(true)}
                    className="h-10 px-4 rounded-full bg-brand-600 hover:bg-brand-500 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Subtitles className="w-4 h-4" />
                    <span>
                      {activeSubLabel
                        ? `Sub: ${activeSubLabel}`
                        : 'Caută Subtitrări (.SRT)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleSaveVodItem(activeVodItem)}
                    className={`h-10 px-4 rounded-full text-xs sm:text-sm font-bold inline-flex items-center gap-2 border transition-colors cursor-pointer ${
                      savedVodItems.some((x) => x.id === activeVodItem.id)
                        ? 'bg-rose-600 text-white border-rose-500'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-white/10'
                    }`}
                  >
                    <Heart className="w-4 h-4" />
                    <span>
                      {savedVodItems.some((x) => x.id === activeVodItem.id)
                        ? 'Salvat'
                        : 'Salvează'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (playerBoxRef.current?.requestFullscreen) {
                        playerBoxRef.current.requestFullscreen().catch(() => {});
                      }
                    }}
                    className="h-10 px-4 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 border border-white/10 cursor-pointer"
                  >
                    <Maximize2 className="w-4 h-4" />
                    <span>Fullscreen Player</span>
                  </button>
                </div>
              </div>

              {/* Remote-Friendly Server Selection Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider shrink-0 mr-1 inline-flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-amber-400" /> Server:
                </span>
                {VOD_SERVERS.map((srv) => {
                  const active = activeServer === srv.id;
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => setActiveServer(srv.id)}
                      className={`h-10 px-4 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                        active
                          ? 'bg-amber-500 text-zinc-950 shadow-md scale-[1.02]'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10'
                      }`}
                    >
                      {srv.label}
                    </button>
                  );
                })}
              </div>

              {/* Video Player Container */}
              <div
                ref={playerBoxRef}
                className="relative w-full aspect-video max-h-[68vh] bg-black rounded-3xl overflow-hidden border border-white/15 shadow-2xl"
              >
                {pendingResumePromptSec !== null &&
                  pendingResumePromptSec > 10 && (
                    <div className="absolute inset-0 z-30 bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
                      <div className="max-w-md w-full p-6 rounded-[28px] bg-zinc-900 border border-white/15 shadow-2xl space-y-5">
                        <h3 className="text-lg sm:text-xl font-extrabold text-white">
                          De unde vrei să pornească redarea?
                        </h3>
                        <p className="text-sm text-zinc-300">
                          Ai rămas la minutul{' '}
                          <span className="font-mono font-bold text-amber-400">
                            {formatWatchSeconds(pendingResumePromptSec)}
                          </span>
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setResumeStartSeconds(pendingResumePromptSec);
                              setPendingResumePromptSec(null);
                            }}
                            className="w-full sm:flex-1 h-12 px-6 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Play className="w-4 h-4 fill-current" />
                            Continuă de la{' '}
                            {formatWatchSeconds(pendingResumePromptSec)}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setResumeStartSeconds(0);
                              setPendingResumePromptSec(null);
                            }}
                            className="w-full sm:flex-1 h-12 px-6 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm inline-flex items-center justify-center gap-2 border border-white/10 cursor-pointer"
                          >
                            <RotateCcw className="w-4 h-4" />
                            De la început (00:00)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                {activeServer === 'kinogram_hls' ? (
                  isDirectStreamLoading ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-zinc-300">
                      <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
                      <p className="text-sm font-bold">
                        Se încarcă streamul HD pentru Smart TV...
                      </p>
                    </div>
                  ) : resolvedDirectStream?.ok &&
                    resolvedDirectStream.hlsUrl ? (
                    <VodNativeHlsPlayer
                      hlsUrl={resolvedDirectStream.hlsUrl}
                      audioTrackLabels={resolvedDirectStream.audioNames}
                      startAtSeconds={resumeStartSeconds}
                      poster={activeVodItem.poster}
                      subtitleVttUrl={activeSubVttUrl}
                      subtitleLabel={activeSubLabel}
                      onOpenSubtitleFinder={() => setIsSubFinderOpen(true)}
                      onClearSubtitle={() => {
                        setActiveSubVttUrl(null);
                        setActiveSubLabel('');
                      }}
                      onTimeUpdate={(cur, dur) => {
                        if (cur > 5 && Math.floor(cur) % 5 === 0) {
                          updateWatchProgress(
                            activeVodItem,
                            selectedSeason,
                            selectedEpisode,
                            cur,
                            dur
                          );
                        }
                      }}
                    />
                  ) : (
                    <iframe
                      src={buildVodEmbedUrl(
                        'vidspark',
                        activeVodItem,
                        selectedSeason,
                        selectedEpisode,
                        preferredSubLang,
                        resumeStartSeconds
                      )}
                      title={activeVodItem.name}
                      className="w-full h-full border-0"
                      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  )
                ) : (
                  <iframe
                    src={buildVodEmbedUrl(
                      activeServer,
                      activeVodItem,
                      selectedSeason,
                      selectedEpisode,
                      preferredSubLang,
                      resumeStartSeconds
                    )}
                    title={activeVodItem.name}
                    className="w-full h-full border-0"
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </div>

              {/* Remote-Friendly Seasons & Episodes Selector for Series */}
              {activeVodItem.type === 'series' &&
                availableSeasons.length > 0 && (
                  <div className="p-5 rounded-3xl bg-zinc-900/90 border border-white/15 space-y-4">
                    {/* Seasons Row */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 mr-2">
                        Sezoane:
                      </span>
                      {availableSeasons.map((sNum) => (
                        <button
                          key={sNum}
                          type="button"
                          onClick={() => {
                            setSelectedSeason(sNum);
                            setSelectedEpisode(1);
                            setResumeStartSeconds(0);
                          }}
                          className={`h-10 px-5 rounded-full text-xs sm:text-sm font-extrabold shrink-0 transition-all cursor-pointer ${
                            selectedSeason === sNum
                              ? 'bg-amber-500 text-zinc-950 shadow-md'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                          }`}
                        >
                          Sezonul {sNum}
                        </button>
                      ))}
                    </div>

                    {/* Episodes Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                      {episodesForSeason.map((ep) => {
                        const isCurrent = selectedEpisode === ep.episode;
                        return (
                          <button
                            key={ep.id || ep.episode}
                            type="button"
                            onClick={() => {
                              setSelectedEpisode(ep.episode);
                              setResumeStartSeconds(0);
                            }}
                            className={`p-3 rounded-2xl text-left transition-all border cursor-pointer ${
                              isCurrent
                                ? 'bg-amber-500 text-zinc-950 border-amber-400 font-extrabold shadow-lg'
                                : 'bg-zinc-950/80 hover:bg-zinc-800 text-zinc-200 border-white/10'
                            }`}
                          >
                            <div className="text-xs font-extrabold">
                              Episodul {ep.episode}
                            </div>
                            <div
                              className={`text-[11px] truncate mt-0.5 ${
                                isCurrent ? 'text-zinc-900' : 'text-zinc-400'
                              }`}
                            >
                              {ep.name || `Episodul ${ep.episode}`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>
          ) : (
            <>
              {/* HERO SPOTLIGHT BANNER (Exact Lampa Top Banner) */}
              {spotlightItem && (
                <section className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-zinc-900/95 via-zinc-900/80 to-zinc-900/40 border border-white/10 shadow-xl flex flex-col justify-end min-h-[140px] sm:min-h-[168px]">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {spotlightItem.badge && (
                      <span className="px-3 py-0.5 rounded-full bg-amber-500 text-zinc-950 text-[11px] font-extrabold uppercase tracking-wider">
                        {spotlightItem.badge}
                      </span>
                    )}
                    {spotlightItem.rating && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-extrabold inline-flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {spotlightItem.rating}
                      </span>
                    )}
                    {spotlightItem.subtitle && (
                      <span className="text-xs sm:text-sm font-semibold text-zinc-300">
                        {spotlightItem.subtitle}
                      </span>
                    )}
                  </div>

                  <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight truncate">
                    {spotlightItem.title}
                  </h1>

                  {spotlightItem.description && (
                    <p className="text-xs sm:text-sm text-zinc-300 mt-1.5 line-clamp-2 max-w-3xl">
                      {spotlightItem.description}
                    </p>
                  )}
                </section>
              )}

              {/* SECTION 1 & 2: MOVIES & SERIES */}
              {(section === 'movies' || section === 'series') && (
                <div className="space-y-4 pb-16">
                  {/* Row 1: Country Origin Pills (Remote-Friendly) */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {TV_ORIGIN_COUNTRIES.map((c) => {
                      const active = originCountry === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setOriginCountry(c.id)}
                          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                            active
                              ? 'bg-amber-500 text-zinc-950 shadow-md scale-[1.03]'
                              : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-white/10'
                          }`}
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>{c.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Row 2: Genre & Year Pills */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {TV_GENRE_PILLS.map((g) => {
                      const active = selectedGenre === g.id;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setSelectedGenre(g.id)}
                          className={`min-h-[38px] px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                            active
                              ? 'bg-white text-zinc-950 shadow-md'
                              : 'bg-zinc-900/70 hover:bg-zinc-800 text-zinc-300 border border-white/10'
                          }`}
                        >
                          {g.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Movies / Series Poster Grid */}
                  {isVodLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
                      <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
                      <span className="text-sm font-bold">
                        Se încarcă catalogul Smart TV...
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                        {vodItems.map((item) => {
                          const savedProg = watchProgressMap[item.id];
                          const posterUrl =
                            item.poster ||
                            `https://images.metahub.space/poster/medium/${item.id}/img`;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onFocus={() =>
                                setSpotlightItem({
                                  title: item.name,
                                  subtitle: `${item.releaseInfo || ''} • ${(item.genres || []).slice(0, 3).join(', ')}`,
                                  rating: item.imdbRating,
                                  badge:
                                    item.type === 'series'
                                      ? 'SERIAL TV'
                                      : 'FILM HD',
                                  description: item.description,
                                  backdrop: item.background || posterUrl,
                                })
                              }
                              onMouseEnter={() =>
                                setSpotlightItem({
                                  title: item.name,
                                  subtitle: `${item.releaseInfo || ''} • ${(item.genres || []).slice(0, 3).join(', ')}`,
                                  rating: item.imdbRating,
                                  badge:
                                    item.type === 'series'
                                      ? 'SERIAL TV'
                                      : 'FILM HD',
                                  description: item.description,
                                  backdrop: item.background || posterUrl,
                                })
                              }
                              onClick={() => handleOpenVod(item)}
                              className="group relative rounded-2xl bg-zinc-900 border-2 border-white/10 focus:border-amber-400 hover:border-amber-400 focus:scale-105 hover:scale-[1.03] transition-all duration-200 overflow-hidden text-left shadow-lg cursor-pointer"
                            >
                              <div className="aspect-[2/3] w-full bg-zinc-950 relative overflow-hidden">
                                <img
                                  src={posterUrl}
                                  alt={item.name}
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                                {item.imdbRating && (
                                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/80 text-amber-400 text-xs font-extrabold inline-flex items-center gap-1">
                                    <Star className="w-3 h-3 fill-amber-400" />
                                    {item.imdbRating}
                                  </span>
                                )}
                                {savedProg && savedProg.currentTime > 10 && (
                                  <span className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-extrabold text-center truncate">
                                    ▶ {formatWatchSeconds(savedProg.currentTime)}
                                  </span>
                                )}
                              </div>
                              <div className="p-3">
                                <div className="text-xs sm:text-sm font-bold text-white truncate">
                                  {item.name}
                                </div>
                                <div className="text-[11px] text-zinc-400 mt-0.5 truncate">
                                  {item.releaseInfo ||
                                    (item.type === 'series' ? 'Serial' : 'Film')}
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
                            className="h-12 px-8 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-sm inline-flex items-center gap-2 shadow-lg cursor-pointer"
                          >
                            {isLoadingMoreVod ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Se încarcă...
                              </>
                            ) : (
                              <>Încarcă mai multe titluri</>
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* SECTION 3: LIVE TV CHANNELS */}
              {section === 'tv' && (
                <div className="space-y-4 pb-16">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {TV_LIVE_REGIONS.map((reg) => {
                      const active = tvRegionId === reg.id;
                      return (
                        <button
                          key={reg.id}
                          type="button"
                          onClick={() => setTvRegionId(reg.id)}
                          className={`min-h-[42px] px-5 py-2 rounded-full text-xs sm:text-sm font-extrabold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                            active
                              ? 'bg-amber-500 text-zinc-950 shadow-md scale-[1.03]'
                              : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10'
                          }`}
                        >
                          {reg.label}
                        </button>
                      );
                    })}
                  </div>

                  {isTvLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
                      <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
                      <span className="text-sm font-bold">
                        Se încarcă grila TV Live HD...
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                      {tvChannels.map((ch) => (
                        <button
                          key={ch.id}
                          type="button"
                          onFocus={() =>
                            setSpotlightItem({
                              title: ch.name,
                              subtitle: `${ch.countryCode} • ${ch.group || 'TV Live HD'}`,
                              badge: 'LIVE TV HD',
                              backdrop: ch.logo,
                            })
                          }
                          onMouseEnter={() =>
                            setSpotlightItem({
                              title: ch.name,
                              subtitle: `${ch.countryCode} • ${ch.group || 'TV Live HD'}`,
                              badge: 'LIVE TV HD',
                              backdrop: ch.logo,
                            })
                          }
                          onClick={() => playTvChannel(ch, tvChannels)}
                          className="p-4 rounded-2xl bg-zinc-900/90 border-2 border-white/10 focus:border-amber-400 hover:border-amber-400 focus:scale-105 transition-all flex items-center gap-3.5 text-left shadow-md cursor-pointer"
                        >
                          <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                            {ch.logo ? (
                              <img
                                src={ch.logo}
                                alt={ch.name}
                                loading="lazy"
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <Tv className="w-6 h-6 text-amber-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                              {ch.name}
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                              {ch.group || 'Live HD'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 4: RADIO ONLINE */}
              {section === 'radio' && (
                <div className="space-y-4 pb-16">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {RADIO_COUNTRIES.map((rc) => {
                      const active = radioCountry === rc.code;
                      return (
                        <button
                          key={rc.code}
                          type="button"
                          onClick={() => setRadioCountry(rc.code)}
                          className={`min-h-[42px] px-5 py-2 rounded-full text-xs sm:text-sm font-extrabold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                            active
                              ? 'bg-amber-500 text-zinc-950 shadow-md scale-[1.03]'
                              : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10'
                          }`}
                        >
                          {rc.label}
                        </button>
                      );
                    })}
                  </div>

                  {isRadioLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
                      <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
                      <span className="text-sm font-bold">
                        Se încarcă posturile radio...
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                      {radioStations.map((st) => {
                        const isPlayingThis =
                          currentStation?.stationuuid === st.stationuuid &&
                          playerStatus === 'playing';
                        return (
                          <button
                            key={st.stationuuid}
                            type="button"
                            onFocus={() =>
                              setSpotlightItem({
                                title: st.name,
                                subtitle: `${st.country || radioCountry} • ${st.tags || 'Radio Live'}`,
                                badge: st.bitrate
                                  ? `${st.bitrate} kbps`
                                  : 'RADIO LIVE',
                                backdrop: st.favicon,
                              })
                            }
                            onClick={() => playStation(st, radioStations)}
                            className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-3.5 text-left shadow-md cursor-pointer ${
                              isPlayingThis
                                ? 'bg-amber-500/20 border-amber-400'
                                : 'bg-zinc-900/90 border-white/10 focus:border-amber-400 hover:border-amber-400 focus:scale-105'
                            }`}
                          >
                            <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                              {st.favicon ? (
                                <img
                                  src={st.favicon}
                                  alt={st.name}
                                  loading="lazy"
                                  className="w-full h-full object-contain p-1"
                                />
                              ) : (
                                <Radio className="w-6 h-6 text-amber-400" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                                {st.name}
                              </div>
                              <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                                {isPlayingThis
                                  ? '▶ Se redă acum'
                                  : st.tags || 'Live Radio'}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 5: SMART TV SEARCH WITH ON-SCREEN REMOTE KEYBOARD */}
              {section === 'search' && (
                <div className="space-y-5 pb-16">
                  <div className="p-5 rounded-3xl bg-zinc-900/90 border border-white/15 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex-1 min-w-[240px] h-12 px-5 rounded-full bg-zinc-950 border border-amber-500/50 flex items-center justify-between gap-3">
                        <span className="text-base sm:text-lg font-bold text-white truncate">
                          {searchQuery || (
                            <span className="text-zinc-500">
                              Folosește tastatura TV de mai jos pentru căutare...
                            </span>
                          )}
                        </span>
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 cursor-pointer"
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
                          className="h-11 px-4 rounded-full bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs sm:text-sm font-extrabold border border-white/10 cursor-pointer"
                        >
                          {keyboardAlphabet === 'LAT'
                            ? 'АБВ (Chirilice RU)'
                            : 'ABC (Latine RO/EN)'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSearchQuery((q) => q + ' ')}
                          className="h-11 px-5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs sm:text-sm font-bold border border-white/10 cursor-pointer"
                        >
                          Spațiu
                        </button>
                        <button
                          type="button"
                          onClick={() => setSearchQuery((q) => q.slice(0, -1))}
                          className="h-11 px-4 rounded-full bg-zinc-800 hover:bg-zinc-700 text-rose-400 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 border border-white/10 cursor-pointer"
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
                          className="h-11 rounded-xl bg-zinc-950 hover:bg-amber-500 hover:text-zinc-950 focus:bg-amber-500 focus:text-zinc-950 text-white font-extrabold text-sm transition-colors border border-white/10 cursor-pointer"
                        >
                          {ch}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search Results Grid */}
                  {isSearchLoading ? (
                    <div className="py-12 flex items-center justify-center gap-3 text-zinc-400">
                      <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                      <span className="text-sm font-bold">Se caută...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                      {searchResults.map((item) => {
                        const posterUrl =
                          item.poster ||
                          `https://images.metahub.space/poster/medium/${item.id}/img`;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleOpenVod(item)}
                            className="group relative rounded-2xl bg-zinc-900 border-2 border-white/10 focus:border-amber-400 hover:border-amber-400 focus:scale-105 transition-all overflow-hidden text-left shadow-lg cursor-pointer"
                          >
                            <div className="aspect-[2/3] w-full bg-zinc-950 relative overflow-hidden">
                              <img
                                src={posterUrl}
                                alt={item.name}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="p-3">
                              <div className="text-xs sm:text-sm font-bold text-white truncate">
                                {item.name}
                              </div>
                              <div className="text-[11px] text-zinc-400 mt-0.5">
                                {item.releaseInfo ||
                                  (item.type === 'series' ? 'Serial' : 'Film')}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 6: WATCH HISTORY ("Continuă vizionarea") */}
              {section === 'history' && (
                <div className="space-y-4 pb-16">
                  <h2 className="text-lg font-extrabold text-white">
                    Continuă vizionarea — De unde ai rămas
                  </h2>
                  {historyList.length === 0 ? (
                    <p className="text-sm text-zinc-400">
                      Nu ai niciun film sau serial început încă.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                      {historyList.map((entry) => {
                        const item = entry.item;
                        const posterUrl =
                          item.poster ||
                          `https://images.metahub.space/poster/medium/${item.id}/img`;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleOpenVod(item)}
                            className="group relative rounded-2xl bg-zinc-900 border-2 border-white/10 focus:border-amber-400 hover:border-amber-400 focus:scale-105 transition-all overflow-hidden text-left shadow-lg cursor-pointer"
                          >
                            <div className="aspect-[2/3] w-full bg-zinc-950 relative overflow-hidden">
                              <img
                                src={posterUrl}
                                alt={item.name}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute bottom-2 left-2 right-2 px-2.5 py-1 rounded-full bg-amber-500 text-zinc-950 text-xs font-extrabold text-center">
                                ▶ {formatWatchSeconds(entry.currentTime)}
                              </span>
                            </div>
                            <div className="p-3">
                              <div className="text-xs sm:text-sm font-bold text-white truncate">
                                {item.name}
                              </div>
                              <div className="text-[11px] text-amber-400 font-semibold mt-0.5">
                                {item.type === 'series'
                                  ? `Sezonul ${entry.season} • Ep ${entry.episode}`
                                  : 'Film'}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 7: SAVED / FAVORITES */}
              {section === 'saved' && (
                <div className="space-y-4 pb-16">
                  <h2 className="text-lg font-extrabold text-white">
                    Filme & Seriale Salvate ({savedVodItems.length})
                  </h2>
                  {savedVodItems.length === 0 ? (
                    <p className="text-sm text-zinc-400">
                      Nu ai salvat încă niciun film sau serial la Favorite.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                      {savedVodItems.map((item) => {
                        const posterUrl =
                          item.poster ||
                          `https://images.metahub.space/poster/medium/${item.id}/img`;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleOpenVod(item)}
                            className="group relative rounded-2xl bg-zinc-900 border-2 border-white/10 focus:border-amber-400 hover:border-amber-400 focus:scale-105 transition-all overflow-hidden text-left shadow-lg cursor-pointer"
                          >
                            <div className="aspect-[2/3] w-full bg-zinc-950 relative overflow-hidden">
                              <img
                                src={posterUrl}
                                alt={item.name}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="p-3">
                              <div className="text-xs sm:text-sm font-bold text-white truncate">
                                {item.name}
                              </div>
                              <div className="text-[11px] text-zinc-400 mt-0.5">
                                {item.releaseInfo ||
                                  (item.type === 'series' ? 'Serial' : 'Film')}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Live HLS TV Video Player Modal (when a TV channel is clicked) */}
      <TvPlayerModal />

      {/* Hidden Audio Engine for Radio playback */}
      <div className="hidden">
        <GlobalPlayer />
      </div>

      {/* Online Subtitle Finder Modal */}
      <OnlineSubtitleFinderModal
        isOpen={isSubFinderOpen}
        onClose={() => setIsSubFinderOpen(false)}
        initialImdbId={
          activeVodItem?.id.startsWith('tt') ? activeVodItem.id : ''
        }
        initialTitle={activeVodItem?.name || ''}
        initialType={activeVodItem?.type || 'movie'}
        initialSeason={selectedSeason}
        initialEpisode={selectedEpisode}
        initialLangFilter={preferredSubLang}
        onApplySubtitle={({ vttBlobUrl, label }) => {
          setActiveSubVttUrl(vttBlobUrl);
          setActiveSubLabel(label);
        }}
      />
    </div>
  );
};

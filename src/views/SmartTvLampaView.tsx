import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Home,
  Clapperboard,
  Smile,
  SlidersHorizontal,
  Bookmark,
  Folder,
  ChevronLeft,
  Menu,
  Bell,
  Settings,
  User,
  RefreshCw,
  Film,
  Tv,
  Radio,
  Search,
  Clock,
  Heart,
  Play,
  RotateCcw,
  ArrowLeft,
  Maximize2,
  Monitor,
  Loader2,
  Sparkles,
  Volume2,
  VolumeX,
  Pause,
  SkipBack,
  SkipForward,
  Music,
  Disc,
  Delete,
  Layers,
  Users,
  X,
} from 'lucide-react';
import { useRadioStore } from '../store/useRadioStore';
import {
  fetchTvChannelsByCountry,
  fetchAdultTvChannels,
  isAdultTvChannel,
} from '../services/tvApi';
import { fetchStationsByCountry } from '../services/radioBrowserApi';
import { TvChannel, Station } from '../types/radio';
import { StationAvatar } from '../components/common/StationAvatar';
import { resolveDisplayTrack } from '../utils/cleanTrackMetadata';
import { getCountryFlagEmoji } from '../services/geoLanguageService';
import {
  SubtitleCue,
  AudioTrackPreference,
  fetchOnlineSubtitlesByImdb,
  downloadSubtitleAsVttBlobUrl,
  findPreferredOriginalAudioTrackIndex,
  resolveAudioTrackIndexByPreference,
  autoResolveAndFetchBestRoRuSubtitle,
} from '../services/subtitleSearchService';
import { resolveDirectVodStreamClient } from '../services/vodStreamClient';
import {
  VodNativeHlsPlayer,
  TvPreferredQuality,
  TvSubFontSize,
} from '../components/tv/VodNativeHlsPlayer';
import { OnlineSubtitleFinderModal } from '../components/tv/OnlineSubtitleFinderModal';
import { TvPlayerModal } from '../components/tv/TvPlayerModal';
import { GlobalPlayer } from '../components/player/GlobalPlayer';

interface SmartTvLampaViewProps {
  onExitTvMode: () => void;
}

type TvSectionId =
  | 'home'
  | 'movies'
  | 'cartoons'
  | 'series'
  | 'tv'
  | 'radio'
  | 'catalog'
  | 'filter'
  | 'saved'
  | 'history'
  | 'search';

type OriginCountryId =
  | 'FAV'
  | 'ALL'
  | 'RO'
  | 'RU'
  | 'UA'
  | 'BY'
  | 'CN'
  | 'US'
  | 'GB'
  | 'FR'
  | 'DE'
  | 'IT'
  | 'ES'
  | 'TR'
  | 'KR'
  | 'JP'
  | 'IN'
  | 'ZA'
  | 'AL'
  | 'AE'
  | 'AZ';

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
  nameOriginal?: string;
  releaseInfo?: string;
  year?: string;
  imdbRating?: string;
  ratingKinopoisk?: string;
  poster?: string;
  background?: string;
  genres?: string[];
  description?: string;
  runtime?: string;
  country?: string;
  ageRating?: string;
  slogan?: string;
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

interface TrailerItem {
  id: string;
  title: string;
  embedUrl: string;
}

interface DetailedMeta extends CinemetaItem {
  imdbId?: string;
  videos?: SeriesEpisode[];
  cast?: string[];
  director?: string[];
  writer?: string[];
  awards?: string;
  trailers?: Array<{ source?: string; type?: string }>;
  trailerStreams?: Array<{ ytId?: string; title?: string }>;
}

interface ResolvedDirectVodStream {
  ok: boolean;
  type?: 'movie' | 'series';
  sourcePath?: string;
  dashUrl?: string;
  dashaUrl?: string;
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
  totalEpisodesInSeason?: number;
  totalSeasons?: number;
  episodeProgressMap?: Record<string, EpisodeProgress>;
}

const SAVED_VOD_STORAGE_KEY = 'aether_saved_vod_items_v1';
const WATCH_PROGRESS_STORAGE_KEY = 'aether_vod_watch_progress_v1';

const TV_ORIGIN_COUNTRIES: Array<{
  id: OriginCountryId;
  label: string;
  kpCountryId?: number;
}> = [
  { id: 'ALL', label: 'Не выбрано' },
  { id: 'RU', label: 'Русский', kpCountryId: 34 },
  { id: 'UA', label: 'Украинский', kpCountryId: 40 },
  { id: 'US', label: 'Английский', kpCountryId: 1 },
  { id: 'RO', label: 'Румынский (Română)', kpCountryId: 37 },
  { id: 'BY', label: 'Белорусский', kpCountryId: 41 },
  { id: 'CN', label: 'Китайский', kpCountryId: 21 },
  { id: 'JP', label: 'Японский', kpCountryId: 16 },
  { id: 'KR', label: 'Корейский', kpCountryId: 49 },
  { id: 'TR', label: 'Турецкий', kpCountryId: 44 },
  { id: 'FR', label: 'Французский', kpCountryId: 3 },
  { id: 'DE', label: 'Немецкий', kpCountryId: 9 },
  { id: 'IT', label: 'Итальянский', kpCountryId: 10 },
  { id: 'ES', label: 'Испанский', kpCountryId: 8 },
  { id: 'GB', label: 'Английский (UK)', kpCountryId: 5 },
  { id: 'IN', label: 'Хинди (Индия)', kpCountryId: 7 },
  { id: 'ZA', label: 'Африкаанс', kpCountryId: 60 },
  { id: 'AL', label: 'Албанский', kpCountryId: 61 },
  { id: 'AE', label: 'Арабский', kpCountryId: 62 },
  { id: 'AZ', label: 'Азербайджанский', kpCountryId: 42 },
];

const TV_GENRE_PILLS: Array<{ id: string; label: string; kpGenreId?: number }> = [
  { id: 'top', label: 'Не выбрано' },
  { id: 'Action', label: 'Боевик / Acțiune', kpGenreId: 11 },
  { id: 'Adventure', label: 'Приключения / Aventură', kpGenreId: 7 },
  { id: 'Animation', label: 'Мультфильм / Animație', kpGenreId: 18 },
  { id: 'Comedy', label: 'Комедия / Comedie', kpGenreId: 13 },
  { id: 'Crime', label: 'Криминал / Crimă', kpGenreId: 3 },
  { id: 'Documentary', label: 'Документальный', kpGenreId: 22 },
  { id: 'Drama', label: 'Драма / Dramă', kpGenreId: 2 },
  { id: 'Family', label: 'Семейный / Familie', kpGenreId: 19 },
  { id: 'Fantasy', label: 'Фэнтези / Fantasy', kpGenreId: 12 },
  { id: 'History', label: 'История / Istoric', kpGenreId: 15 },
  { id: 'Horror', label: 'Ужасы / Horror', kpGenreId: 17 },
  { id: 'Romance', label: 'Мелодрама / Romantic', kpGenreId: 4 },
  { id: 'Mystery', label: 'Детектив / Mister', kpGenreId: 5 },
  { id: 'Sci-Fi', label: 'Фантастика / Sci-Fi', kpGenreId: 6 },
  { id: 'Thriller', label: 'Триллер / Thriller', kpGenreId: 1 },
  { id: 'Adult', label: '🔞 18+ Для взрослых / Adulți (Erotic)', kpGenreId: 28 },
];

const LAMPA_FILTER_RATINGS: Array<{ id: string; label: string; minRating?: number }> = [
  { id: 'any', label: 'Не выбрано' },
  { id: '8', label: 'От 8.0 и выше', minRating: 8 },
  { id: '7', label: 'От 7.0 и выше', minRating: 7 },
  { id: '6', label: 'От 6.0 и выше', minRating: 6 },
  { id: '5', label: 'От 5.0 и выше', minRating: 5 },
];

const LAMPA_FILTER_YEARS: Array<{ id: string; label: string; yearFrom?: number; yearTo?: number }> = [
  { id: 'any', label: 'Не выбрано' },
  { id: '2026', label: '2026', yearFrom: 2026, yearTo: 2026 },
  { id: '2025', label: '2025', yearFrom: 2025, yearTo: 2025 },
  { id: '2024', label: '2024', yearFrom: 2024, yearTo: 2024 },
  { id: '2020-2026', label: '2020 - 2026', yearFrom: 2020, yearTo: 2026 },
  { id: '2010-2019', label: '2010 - 2019', yearFrom: 2010, yearTo: 2019 },
  { id: '2000-2009', label: '2000 - 2009', yearFrom: 2000, yearTo: 2009 },
  { id: '1990-1999', label: '1990 - 1999', yearFrom: 1990, yearTo: 1999 },
];

const TV_LIVE_REGIONS: Array<{
  id: string;
  label: string;
  country: string;
  group?: string;
}> = [
  { id: 'FAV', label: '❤ Favorite TV', country: 'FAV' },
  { id: 'IEDEM', label: '📺 iEdem / Playlist M3U', country: 'IEDEM' },
  { id: 'ADULT', label: '🔞 18+ Для взрослых / Adulți', country: 'ADULT' },
  { id: 'RO', label: '🇷🇴 România HD', country: 'RO' },
  { id: 'MD', label: '🇲🇩 Moldova HD', country: 'MD' },
  { id: 'RU', label: '🇷🇺 Rusia (RU)', country: 'RU' },
  { id: 'US', label: '🇺🇸 SUA (US)', country: 'US' },
  { id: 'GB', label: '🇬🇧 Marea Britanie', country: 'GB' },
  { id: 'DE', label: '🇩🇪 Germania', country: 'DE' },
  { id: 'FR', label: '🇫🇷 Franța', country: 'FR' },
  { id: 'IT', label: '🇮🇹 Italia', country: 'IT' },
  { id: 'ES', label: '🇪🇸 Spania', country: 'ES' },
  { id: 'TR', label: '🇹🇷 Turcia', country: 'TR' },
  { id: 'UA', label: '🇺🇦 Ucraina', country: 'UA' },
  { id: 'HU', label: '🇭🇺 Ungaria', country: 'HU' },
  { id: 'BG', label: '🇧🇬 Bulgaria', country: 'BG' },
];

const TV_LIVE_CATEGORIES: Array<{ id: string; label: string; match: string }> = [
  { id: 'ALL', label: 'Toate Canalele', match: '' },
  { id: 'GENERAL', label: 'Generale / Общие', match: 'general|national|общ|федерал' },
  { id: 'NEWS', label: 'Știri / Новости', match: 'news|știr|stiri|инфо|новост' },
  { id: 'MOVIES', label: 'Filme & Seriale / Кино', match: 'movie|film|cinema|series|кино|сериал' },
  { id: 'SPORT', label: 'Sport / Спорт', match: 'sport|спорт' },
  { id: 'MUSIC', label: 'Muzică / Музыка', match: 'music|muzic|музык' },
  { id: 'DOC', label: 'Documentare / Познавательные', match: 'doc|science|history|познав' },
  { id: 'KIDS', label: 'Copii / Детские', match: 'kids|children|детск|anim' },
  { id: 'ADULT', label: '🔞 18+ Для взрослых / Adulți', match: 'adult|xxx|18+|взросл|эротик' },
];

const RADIO_COUNTRIES: Array<{ code: string; label: string }> = [
  { code: 'FAV', label: '❤ Favorite Radio' },
  { code: 'RO', label: '🇷🇴 România' },
  { code: 'MD', label: '🇲🇩 Moldova' },
  { code: 'RU', label: '🇷🇺 Rusia' },
  { code: 'US', label: '🇺🇸 SUA' },
  { code: 'GB', label: '🇬🇧 Marea Britanie' },
  { code: 'DE', label: '🇩🇪 Germania' },
  { code: 'FR', label: '🇫🇷 Franța' },
  { code: 'IT', label: '🇮🇹 Italia' },
  { code: 'ES', label: '🇪🇸 Spania' },
  { code: 'TR', label: '🇹🇷 Turcia' },
  { code: 'UA', label: '🇺🇦 Ucraina' },
  { code: 'HU', label: '🇭🇺 Ungaria' },
  { code: 'NL', label: '🇳🇱 Olanda' },
  { code: 'CH', label: '🇨🇭 Elveția' },
];

const VOD_SERVERS: Array<{ id: VodServerId; label: string }> = [
  {
    id: 'kinogram_hls',
    label: 'S1: Player Nativ 1080p Full HD (Original / Multi-Audio)',
  },
  { id: 'vidspark', label: 'S2: VidSpark 1080p / 4K (Sub RO/RU/EN)' },
  { id: 'kinogram_embed', label: 'S3: Kinogram 1080p Multi-Audio' },
  { id: 'vidzee', label: 'S4: VidZee 1080p Multi-Server' },
  { id: 'vidsrc_pm', label: 'S5: VidSrc 1080p OpenSubtitles' },
  { id: 'nontongo', label: 'S6: MultiEmbed 4K / 1080p VIP' },
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
  startSeconds: number,
  fallbackImdbId?: string
): string {
  const imdbId = item.id.startsWith('tt')
    ? item.id
    : fallbackImdbId && fallbackImdbId.startsWith('tt')
      ? fallbackImdbId
      : '';
  const kpId =
    item.kpId || (item.id.startsWith('kp_') ? item.id.replace(/^kp_/, '') : '');
  const tmdbOrImdbId = item.moviedb_id
    ? String(item.moviedb_id)
    : imdbId || kpId;
  const isSeries = item.type === 'series';
  const start = Math.max(0, Math.floor(startSeconds || 0));

  // If no IMDb ID is available and only kpId exists, use Kinogram embed which natively supports kp/ID
  if (!imdbId && kpId && server !== 'vidzee') {
    const qs = isSeries ? `?season=${season}&episode=${episode}` : '';
    return `https://api.kinogram.best/embed/kp/${kpId}${qs}`;
  }

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
      return isSeries
        ? `https://multiembed.mov/?video_id=${imdbId}&s=${season}&e=${episode}`
        : `https://multiembed.mov/?video_id=${imdbId}`;
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

const SMART_TV_SETTINGS_STORAGE_KEY = 'aether_smart_tv_settings_v1';

export interface SmartTvSettings {
  defaultAudioPref: AudioTrackPreference;
  defaultSubLang: 'ro' | 'ru' | 'en' | 'off';
  defaultSubFontSize: TvSubFontSize;
  defaultVideoQuality: TvPreferredQuality;
  defaultVodServer: 'auto_best' | VodServerId;
  osdAutoHideSec: 0 | 3 | 4 | 6 | 10;
  autoFullscreenOnPlay: boolean;
}

const DEFAULT_SMART_TV_SETTINGS: SmartTvSettings = {
  defaultAudioPref: 'original',
  defaultSubLang: 'ro',
  defaultSubFontSize: 'large',
  defaultVideoQuality: 'max',
  defaultVodServer: 'auto_best',
  osdAutoHideSec: 4,
  autoFullscreenOnPlay: true,
};

const SMART_TV_AUDIO_OPTIONS: Array<{
  id: AudioTrackPreference;
  label: string;
  desc: string;
}> = [
  {
    id: 'original',
    label: '🎙 Limba Originală (Eng.Original / Original)',
    desc: 'Selectează automat pista audio originală a filmului',
  },
  {
    id: 'ru',
    label: '🇷🇺 Dublaj Rusă (HDRezka / LostFilm / Дубляж)',
    desc: 'Selectează automat dublajul în limba rusă',
  },
  {
    id: 'uk',
    label: '🇺🇦 Dublaj Ucraineană (Українська)',
    desc: 'Selectează automat pista audio în limba ucraineană',
  },
  {
    id: 'first',
    label: '1️⃣ Prima pistă din listă (Default Server)',
    desc: 'Folosește prima pistă audio furnizată de server',
  },
];

const SMART_TV_SUB_LANG_OPTIONS: Array<{
  id: SmartTvSettings['defaultSubLang'];
  label: string;
  desc: string;
}> = [
  {
    id: 'ro',
    label: '🇷🇴 Română (prioritar RO, fallback RU/EN)',
    desc: 'Caută și încarcă automat subtitrarea în limba română',
  },
  {
    id: 'ru',
    label: '🇷🇺 Русский (prioritar RU, fallback RO/EN)',
    desc: 'Caută și încarcă automat subtitrarea în limba rusă',
  },
  {
    id: 'en',
    label: '🇬🇧 English (prioritar EN, fallback RO/RU)',
    desc: 'Caută și încarcă automat subtitrarea în limba engleză',
  },
  {
    id: 'off',
    label: '🚫 Выкл / Oprit (Fără subtitrare automată)',
    desc: 'Nu activa automat subtitrările la pornirea filmului',
  },
];

const SMART_TV_SUB_SIZE_OPTIONS: Array<{
  id: TvSubFontSize;
  label: string;
}> = [
  { id: 'normal', label: 'Normal (100%)' },
  { id: 'large', label: 'Mare — Smart TV (125%)' },
  { id: 'xlarge', label: 'Foarte Mare — Cinema TV (150%)' },
];

const SMART_TV_QUALITY_OPTIONS: Array<{
  id: TvPreferredQuality;
  label: string;
  desc: string;
}> = [
  {
    id: 'max',
    label: '★ Maximă Disponibilă (4K UHD / 1080p Full HD)',
    desc: 'Forțează automat cea mai înaltă rezoluție (1080p DASH / 4K)',
  },
  {
    id: '1080',
    label: '1080p Full HD',
    desc: 'Preferă 1080p Full HD când este disponibil',
  },
  {
    id: '720',
    label: '720p HD',
    desc: 'Ideal pentru conexiuni medii sau economisire trafic',
  },
  {
    id: '480',
    label: '480p SD',
    desc: 'Pentru conexiuni lente',
  },
  {
    id: 'auto',
    label: '⚡ Auto ABR (Adaptiv după viteza internetului)',
    desc: 'Ajustează dinamic calitatea video fără întreruperi',
  },
];

const SMART_TV_SERVER_OPTIONS: Array<{
  id: SmartTvSettings['defaultVodServer'];
  label: string;
  desc: string;
}> = [
  {
    id: 'auto_best',
    label: '★ Automat — Cea mai bună calitate (1080p DASH / 4K)',
    desc: 'Alege automat Playerul Nativ 1080p Full HD (DASH/HLS) sau VidSpark 4K',
  },
  {
    id: 'kinogram_hls',
    label: 'S1: Player Nativ HD (Audio Original / RU + Sub RO)',
    desc: 'Playerul nativ Lampa cu selecție piste audio și subtitrări .SRT',
  },
  {
    id: 'vidspark',
    label: 'S2: VidSpark 1080p / 4K (Sub RO/RU/EN)',
    desc: 'Server rapid Full HD / 4K cu subtitrări integrate',
  },
  {
    id: 'kinogram_embed',
    label: 'S3: Kinogram Multi-Audio Embed',
    desc: 'Player web Kinogram cu selector dublaj integrat',
  },
  {
    id: 'vidzee',
    label: 'S4: VidZee Multi-Server',
    desc: 'Server alternativ cu comutare rapidă',
  },
  {
    id: 'vidsrc_pm',
    label: 'S5: VidSrc OpenSubtitles',
    desc: 'Server cu suport OpenSubtitles',
  },
  {
    id: 'nontongo',
    label: 'S6: MultiEmbed 4K / 1080p VIP',
    desc: 'Server extern cu surse multiple internaționale',
  },
];

const SMART_TV_OSD_OPTIONS: Array<{
  id: SmartTvSettings['osdAutoHideSec'];
  label: string;
}> = [
  { id: 3, label: 'După 3 secunde (Rapid)' },
  { id: 4, label: 'După 4 secunde (Standard TV)' },
  { id: 6, label: 'După 6 secunde' },
  { id: 10, label: 'După 10 secunde' },
  { id: 0, label: 'Nu ascunde automat (Mereu vizibil)' },
];

function loadSmartTvSettings(): SmartTvSettings {
  try {
    const raw = localStorage.getItem(SMART_TV_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SMART_TV_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SmartTvSettings>;
    return {
      ...DEFAULT_SMART_TV_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_SMART_TV_SETTINGS;
  }
}

function saveSmartTvSettings(next: SmartTvSettings) {
  try {
    localStorage.setItem(SMART_TV_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export const SmartTvLampaView: React.FC<SmartTvLampaViewProps> = ({
  onExitTvMode,
}) => {
  const playTvChannel = useRadioStore((state) => state.playTvChannel);
  const favoriteTvChannels = useRadioStore((state) => state.favoriteTvChannels);
  const toggleFavoriteTvChannel = useRadioStore(
    (state) => state.toggleFavoriteTvChannel
  );
  const customTvChannels = useRadioStore((state) => state.customTvChannels);
  const adultContentEnabled = useRadioStore(
    (state) => state.adultContentEnabled
  );
  const setAdultContentEnabled = useRadioStore(
    (state) => state.setAdultContentEnabled
  );
  const currentStation = useRadioStore((state) => state.currentStation);
  const playerStatus = useRadioStore((state) => state.playerStatus);
  const nowPlayingTitle = useRadioStore((state) => state.nowPlayingTitle);
  const nowPlayingMeta = useRadioStore((state) => state.nowPlayingMeta);
  const volume = useRadioStore((state) => state.volume);
  const isMuted = useRadioStore((state) => state.isMuted);
  const playStation = useRadioStore((state) => state.playStation);
  const stopRadio = useRadioStore((state) => state.stopRadio);
  const setVolume = useRadioStore((state) => state.setVolume);
  const toggleMute = useRadioStore((state) => state.toggleMute);
  const playNextAvailableStation = useRadioStore(
    (state) => state.playNextAvailableStation
  );
  const playPreviousStation = useRadioStore(
    (state) => state.playPreviousStation
  );
  const triggerStreamReload = useRadioStore(
    (state) => state.triggerStreamReload
  );
  const favorites = useRadioStore((state) => state.favorites);
  const toggleFavorite = useRadioStore((state) => state.toggleFavorite);

  const [isTvRadioPlayerOpen, setIsTvRadioPlayerOpen] =
    useState<boolean>(false);

  const activeRadioTrack = useMemo(
    () =>
      currentStation
        ? resolveDisplayTrack(
            nowPlayingMeta,
            nowPlayingTitle,
            currentStation.name
          )
        : null,
    [currentStation, nowPlayingMeta, nowPlayingTitle]
  );

  // Clock & 2-line Date in top-right corner identical to Lampa
  const [clockText, setClockText] = useState<string>(() => {
    const now = new Date();
    return now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  });
  const [dateLine1, setDateLine1] = useState<string>(() => {
    const now = new Date();
    return now.toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  });
  const [dateLine2, setDateLine2] = useState<string>(() => {
    const now = new Date();
    const wd = now.toLocaleDateString('ro-RO', { weekday: 'long' });
    return wd.charAt(0).toUpperCase() + wd.slice(1);
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      setClockText(
        now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
      );
      setDateLine1(
        now.toLocaleDateString('ro-RO', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      );
      const wd = now.toLocaleDateString('ro-RO', { weekday: 'long' });
      setDateLine2(wd.charAt(0).toUpperCase() + wd.slice(1));
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  // Main TV Navigation Section (Defaults to Lampa 'home' / Главная)
  const [section, setSection] = useState<TvSectionId>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Smart TV Configurable Settings (Audio, Subtitles, Video Quality, Server, OSD Timeout)
  const [tvSettings, setTvSettings] = useState<SmartTvSettings>(() =>
    loadSmartTvSettings()
  );
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] =
    useState<boolean>(false);
  const [settingsSubMenu, setSettingsSubMenu] = useState<
    null | 'audio' | 'subtitles' | 'subSize' | 'quality' | 'server' | 'osd'
  >(null);

  const updateTvSetting = useCallback(
    <K extends keyof SmartTvSettings>(key: K, value: SmartTvSettings[K]) => {
      setTvSettings((prev) => {
        const next = { ...prev, [key]: value };
        saveSmartTvSettings(next);
        return next;
      });
    },
    []
  );

  // VOD Catalog & Lampa Right-Hand Filter Drawer State
  const [originCountry, setOriginCountry] = useState<OriginCountryId>('ALL');
  const [selectedGenre, setSelectedGenre] = useState<string>('top');
  const [filterMediaType, setFilterMediaType] = useState<'movie' | 'series'>('movie');
  const [filterRating, setFilterRating] = useState<string>('any');
  const [filterYear, setFilterYear] = useState<string>('any');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);
  const [filterSubMenu, setFilterSubMenu] = useState<
    null | 'type' | 'rating' | 'genre' | 'lang' | 'year'
  >(null);
  const [isCatalogDrawerOpen, setIsCatalogDrawerOpen] = useState<boolean>(false);
  const [vodItems, setVodItems] = useState<CinemetaItem[]>([]);
  const [homeShelves, setHomeShelves] = useState<{
    watchingNowMix: CinemetaItem[];
    newlyAddedMix: CinemetaItem[];
    popularSeries: CinemetaItem[];
    popularMovies: CinemetaItem[];
    cartoons: CinemetaItem[];
  }>({
    watchingNowMix: [],
    newlyAddedMix: [],
    popularSeries: [],
    popularMovies: [],
    cartoons: [],
  });
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
  const [tvCategoryId, setTvCategoryId] = useState<string>('ALL');
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
  const [activeServer, setActiveServer] = useState<VodServerId>(() =>
    tvSettings.defaultVodServer === 'auto_best'
      ? 'kinogram_hls'
      : tvSettings.defaultVodServer
  );
  const [preferredSubLang, setPreferredSubLang] = useState<SubtitleLangId>(() =>
    tvSettings.defaultSubLang === 'off' ? 'ro' : tvSettings.defaultSubLang
  );
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [resumeStartSeconds, setResumeStartSeconds] = useState<number>(0);
  const [pendingResumePromptSec, setPendingResumePromptSec] = useState<
    number | null
  >(null);
  const [isSubFinderOpen, setIsSubFinderOpen] = useState<boolean>(false);
  const [activeSubVttUrl, setActiveSubVttUrl] = useState<string | null>(null);
  const [activeSubLabel, setActiveSubLabel] = useState<string>('');
  const [activeSubCues, setActiveSubCues] = useState<SubtitleCue[]>([]);
  const [isVodOsdVisible, setIsVodOsdVisible] = useState<boolean>(true);
  const [isEpisodesDrawerOpen, setIsEpisodesDrawerOpen] =
    useState<boolean>(false);
  const [isInfoSheetOpen, setIsInfoSheetOpen] = useState<boolean>(false);
  const [isPlayingVod, setIsPlayingVod] = useState<boolean>(false);
  const [selectedAudioTrackIdx, setSelectedAudioTrackIdx] =
    useState<number>(-1);

  const effectiveAudioTrackIdx = useMemo(() => {
    const names = resolvedDirectStream?.audioNames || [];
    if (selectedAudioTrackIdx >= 0 && selectedAudioTrackIdx < names.length) {
      return selectedAudioTrackIdx;
    }
    return resolveAudioTrackIndexByPreference(
      names,
      tvSettings.defaultAudioPref
    );
  }, [
    resolvedDirectStream?.audioNames,
    selectedAudioTrackIdx,
    tvSettings.defaultAudioPref,
  ]);
  const [isLoadingQuickSub, setIsLoadingQuickSub] = useState<string | null>(
    null
  );
  const [isTrailerModalOpen, setIsTrailerModalOpen] = useState<boolean>(false);
  const [isLoadingTrailer, setIsLoadingTrailer] = useState<boolean>(false);
  const [trailerList, setTrailerList] = useState<TrailerItem[]>([]);
  const [activeTrailerIdx, setActiveTrailerIdx] = useState<number>(0);
  const spotlightMetaCacheRef = useRef<
    Record<
      string,
      {
        description?: string;
        subtitleExtra?: string;
      }
    >
  >({});

  const rootContainerRef = useRef<HTMLDivElement | null>(null);
  const playerBoxRef = useRef<HTMLDivElement | null>(null);
  const playVodBtnRef = useRef<HTMLButtonElement | null>(null);
  const osdTimerRef = useRef<number | null>(null);

  const wakeVodOsd = useCallback(() => {
    setIsVodOsdVisible(true);
    if (osdTimerRef.current) {
      window.clearTimeout(osdTimerRef.current);
    }
    if (tvSettings.osdAutoHideSec <= 0) {
      return;
    }
    osdTimerRef.current = window.setTimeout(() => {
      setIsVodOsdVisible(false);
      setIsInfoSheetOpen(false);
    }, tvSettings.osdAutoHideSec * 1000);
  }, [tvSettings.osdAutoHideSec]);

  const requestTvFullscreen = useCallback(() => {
    try {
      if (
        typeof document !== 'undefined' &&
        !document.fullscreenElement &&
        document.documentElement.requestFullscreen
      ) {
        void document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {
      // ignore
    }
  }, []);

  const handleFocusVodItem = useCallback((item: CinemetaItem) => {
    const posterUrl =
      item.poster || `https://images.metahub.space/poster/medium/${item.id}/img`;
    const baseSub = [
      item.releaseInfo || '',
      (item.genres || []).slice(0, 3).join(', '),
    ]
      .filter(Boolean)
      .join(' • ');
    const cached = spotlightMetaCacheRef.current[item.id];

    setSpotlightItem({
      title: item.name,
      subtitle: cached?.subtitleExtra
        ? [baseSub, cached.subtitleExtra].filter(Boolean).join(' • ')
        : baseSub,
      rating: item.imdbRating,
      badge: item.type === 'series' ? 'SERIAL TV' : 'FILM HD',
      description: cached?.description || item.description,
      backdrop: item.background || posterUrl,
    });

    if (cached) return;

    const imdbId = item.id.startsWith('tt') ? item.id : '';
    const kpId =
      item.kpId ||
      (item.id.startsWith('kp_') ? item.id.replace(/^kp_/, '') : '');
    const mType = item.type === 'series' ? 'series' : 'movie';

    void (async () => {
      let desc = item.description || '';
      let runtime = '';
      let country = '';

      try {
        if (imdbId) {
          const res = await fetch(
            `https://v3-cinemeta.strem.io/meta/${mType}/${imdbId}.json`
          );
          if (res.ok) {
            const data = (await res.json()) as { meta?: DetailedMeta };
            if (data.meta) {
              desc = data.meta.description || desc;
              runtime = data.meta.runtime || '';
              country = data.meta.country || '';
            }
          }
        }
        if (kpId && (!desc || !runtime)) {
          const kpRes = await fetch(
            `https://kinopoiskapiunofficial.tech/api/v2.2/films/${kpId}`,
            {
              headers: {
                'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
              },
            }
          );
          if (kpRes.ok) {
            const kpData = (await kpRes.json()) as {
              description?: string | null;
              shortDescription?: string | null;
              filmLength?: number | null;
              countries?: Array<{ country: string }>;
            };
            desc = desc || kpData.description || kpData.shortDescription || '';
            if (!runtime && kpData.filmLength) {
              runtime = `${kpData.filmLength} min`;
            }
            if (!country && kpData.countries?.length) {
              country = kpData.countries
                .map((c) => c.country)
                .slice(0, 2)
                .join(', ');
            }
          }
        }
      } catch {
        // ignore
      }

      const subtitleExtra = [country, runtime].filter(Boolean).join(' • ');
      spotlightMetaCacheRef.current[item.id] = {
        description: desc || undefined,
        subtitleExtra: subtitleExtra || undefined,
      };

      setSpotlightItem((prev) =>
        prev && prev.title === item.name
          ? {
              ...prev,
              description: desc || prev.description,
              subtitle: subtitleExtra
                ? [baseSub, subtitleExtra].filter(Boolean).join(' • ')
                : prev.subtitle,
            }
          : prev
      );
    })();
  }, []);

  // Support Browser Back / Mouse Back button to exit Movie Card or Player
  useEffect(() => {
    const onPopState = () => {
      if (isTrailerModalOpen) {
        setIsTrailerModalOpen(false);
        return;
      }
      if (isPlayingVod) {
        setIsPlayingVod(false);
        setIsInfoSheetOpen(false);
        return;
      }
      if (activeVodItem) {
        setActiveVodItem(null);
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [activeVodItem, isPlayingVod, isTrailerModalOpen]);

  // Handle Escape / Backspace / Back button AND 2D Spatial D-Pad Remote Navigation (ArrowUp/Down/Left/Right)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = (
        document.activeElement as HTMLElement | null
      )?.tagName?.toLowerCase();
      const isInputFocused =
        activeTag === 'input' || activeTag === 'textarea';
      const isBackKey =
        e.key === 'Escape' ||
        e.keyCode === 461 ||
        e.keyCode === 10009 ||
        (e.key === 'Backspace' &&
          !isInputFocused &&
          !(section === 'search' && !activeVodItem));

      if (isBackKey) {
        if (isTrailerModalOpen) {
          e.preventDefault();
          setIsTrailerModalOpen(false);
          return;
        }
        if (isSettingsDrawerOpen) {
          e.preventDefault();
          if (settingsSubMenu) {
            setSettingsSubMenu(null);
          } else {
            setIsSettingsDrawerOpen(false);
          }
          return;
        }
        if (isFilterDrawerOpen) {
          e.preventDefault();
          if (filterSubMenu) {
            setFilterSubMenu(null);
          } else {
            setIsFilterDrawerOpen(false);
          }
          return;
        }
        if (isCatalogDrawerOpen) {
          e.preventDefault();
          setIsCatalogDrawerOpen(false);
          return;
        }
        if (isSubFinderOpen) {
          e.preventDefault();
          setIsSubFinderOpen(false);
          return;
        }
        if (isPlayingVod) {
          e.preventDefault();
          setIsPlayingVod(false);
          setIsInfoSheetOpen(false);
          return;
        }
        if (activeVodItem) {
          e.preventDefault();
          setActiveVodItem(null);
          setIsPlayingVod(false);
          setIsSidebarOpen(true);
          return;
        }
        if (section !== 'home') {
          e.preventDefault();
          setSection('home');
          setIsSidebarOpen(true);
          return;
        }
      }

      // Allow physical PC keyboard typing anywhere in Search section even when <input> is not focused

      if (
        section === 'search' &&
        !activeVodItem &&
        !isPlayingVod &&
        !isSubFinderOpen &&
        !isSettingsDrawerOpen &&
        !isInputFocused
      ) {
        if (e.key === 'Backspace') {
          e.preventDefault();
          setSearchQuery((q) => q.slice(0, -1));
          return;
        }
        if (
          e.key.length === 1 &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey
        ) {
          e.preventDefault();
          setSearchQuery((q) => q + e.key);
          return;
        }
      }

      // If user is typing inside <input> and presses Left/Right arrow, let the cursor move naturally inside the input
      if (
        isInputFocused &&
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      ) {
        return;
      }

      // Lampa 2D Spatial D-Pad Navigation for TV Remote Arrows when in Catalog, Movie Card, or Settings Drawer
      if (
        (!isPlayingVod || isSettingsDrawerOpen) &&
        !isSubFinderOpen &&
        (e.key === 'ArrowRight' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowDown' ||
          e.key === 'ArrowUp')
      ) {
        const root = rootContainerRef.current;
        if (!root) return;
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(
            'input:not([disabled]), button:not([disabled]), select:not([disabled])'
          )
        ).filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (focusables.length === 0) return;

        const current = document.activeElement as HTMLElement | null;
        if (!current || !root.contains(current)) {
          e.preventDefault();
          focusables[0].focus();
          return;
        }

        const curRect = current.getBoundingClientRect();
        const curCx = curRect.left + curRect.width / 2;
        const curCy = curRect.top + curRect.height / 2;

        let bestCandidate: HTMLElement | null = null;
        let bestScore = Infinity;

        for (const el of focusables) {
          if (el === current) continue;
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const dx = cx - curCx;
          const dy = cy - curCy;

          if (e.key === 'ArrowRight' && dx <= 6) continue;
          if (e.key === 'ArrowLeft' && dx >= -6) continue;
          if (e.key === 'ArrowDown' && dy <= 6) continue;
          if (e.key === 'ArrowUp' && dy >= -6) continue;

          const primaryDist =
            e.key === 'ArrowRight' || e.key === 'ArrowLeft'
              ? Math.abs(dx)
              : Math.abs(dy);
          const orthoDist =
            e.key === 'ArrowRight' || e.key === 'ArrowLeft'
              ? Math.abs(dy)
              : Math.abs(dx);

          // Strongly prefer elements in the same row/column
          const score = primaryDist + orthoDist * 3.2;
          if (score < bestScore) {
            bestScore = score;
            bestCandidate = el;
          }
        }

        if (bestCandidate) {
          e.preventDefault();
          bestCandidate.focus();
          bestCandidate.scrollIntoView({
            block: 'nearest',
            inline: 'nearest',
            behavior: 'smooth',
          });
        } else if (
          e.key === 'ArrowLeft' &&
          activeVodItem &&
          !isSidebarOpen &&
          !isSettingsDrawerOpen
        ) {
          e.preventDefault();
          setIsSidebarOpen(true);
          window.setTimeout(() => {
            const firstNav =
              rootContainerRef.current?.querySelector<HTMLElement>(
                'aside button'
              );
            firstNav?.focus();
          }, 50);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    section,
    activeVodItem,
    isSidebarOpen,
    isPlayingVod,
    isSubFinderOpen,
    isSettingsDrawerOpen,
    settingsSubMenu,
    isFilterDrawerOpen,
    filterSubMenu,
    isCatalogDrawerOpen,
    isTrailerModalOpen,
  ]);

  // Fetch Kinopoisk or Cinemeta catalog for Movies / Series / Cartoons / Home / Filter / Catalog
  const fetchVodCatalog = useCallback(
    async (pageNum: number, append: boolean) => {
      const isCatalogOrFilter = section === 'catalog' || section === 'filter';
      const mediaType: 'movie' | 'series' =
        section === 'series'
          ? 'series'
          : section === 'filter'
            ? filterMediaType
            : 'movie';
      const effectiveCountry = isCatalogOrFilter ? originCountry : 'ALL';
      const effectiveGenre =
        section === 'cartoons'
          ? 'Animation'
          : isCatalogOrFilter
            ? selectedGenre
            : 'top';

      if (effectiveCountry === 'FAV') {
        const favFiltered = savedVodItems.filter((x) => x.type === mediaType);
        setVodItems(favFiltered);
        setHasMoreVod(false);
        setIsVodLoading(false);
        setIsLoadingMoreVod(false);
        return;
      }

      const countryObj = TV_ORIGIN_COUNTRIES.find(
        (c) => c.id === effectiveCountry
      );
      const genreObj = TV_GENRE_PILLS.find((g) => g.id === effectiveGenre);
      const ratingObj = LAMPA_FILTER_RATINGS.find((r) => r.id === filterRating);
      const yearObj = LAMPA_FILTER_YEARS.find((y) => y.id === filterYear);

      const useKinopoisk =
        effectiveCountry !== 'ALL' ||
        effectiveGenre === 'Adult' ||
        (section === 'filter' &&
          (filterRating !== 'any' || filterYear !== 'any'));

      if (append) {
        setIsLoadingMoreVod(true);
      } else {
        setIsVodLoading(true);
      }

      try {
        if (section === 'home') {
          const skip = (pageNum - 1) * 50;
          const movieTopUrl =
            skip > 0
              ? `https://v3-cinemeta.strem.io/catalog/movie/top/skip=${skip}.json`
              : `https://v3-cinemeta.strem.io/catalog/movie/top.json`;
          const seriesTopUrl =
            skip > 0
              ? `https://v3-cinemeta.strem.io/catalog/series/top/skip=${skip}.json`
              : `https://v3-cinemeta.strem.io/catalog/series/top.json`;

          if (append) {
            const [mRes, sRes] = await Promise.allSettled([
              fetch(movieTopUrl).then((r) => (r.ok ? r.json() : { metas: [] })),
              fetch(seriesTopUrl).then((r) =>
                r.ok ? r.json() : { metas: [] }
              ),
            ]);
            const mList: CinemetaItem[] =
              mRes.status === 'fulfilled' && Array.isArray(mRes.value.metas)
                ? mRes.value.metas.map((m: CinemetaItem) => ({
                    ...m,
                    type: 'movie',
                  }))
                : [];
            const sList: CinemetaItem[] =
              sRes.status === 'fulfilled' && Array.isArray(sRes.value.metas)
                ? sRes.value.metas.map((s: CinemetaItem) => ({
                    ...s,
                    type: 'series',
                  }))
                : [];
            const interleaved: CinemetaItem[] = [];
            const maxLen = Math.max(mList.length, sList.length);
            for (let i = 0; i < maxLen; i++) {
              if (sList[i]) interleaved.push(sList[i]);
              if (mList[i]) interleaved.push(mList[i]);
            }
            setVodItems((prev) => {
              const seen = new Set(prev.map((x) => x.id));
              return [...prev, ...interleaved.filter((x) => !seen.has(x.id))];
            });
            setHasMoreVod(interleaved.length >= 20);
            return;
          }

          const [
            mTopRes,
            sTopRes,
            kpNewRes,
            cartoonsRes,
            mImdbRes,
            sImdbRes,
          ] = await Promise.allSettled([
            fetch(movieTopUrl).then((r) => (r.ok ? r.json() : { metas: [] })),
            fetch(seriesTopUrl).then((r) => (r.ok ? r.json() : { metas: [] })),
            fetch(
              `https://kinopoiskapiunofficial.tech/api/v2.2/films?type=ALL&order=NUM_VOTE&yearFrom=2025&yearTo=2026&page=1`,
              {
                headers: {
                  'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
                },
              }
            ).then((r) => (r.ok ? r.json() : { items: [] })),
            fetch(
              `https://v3-cinemeta.strem.io/catalog/movie/top/genre=Animation.json`
            ).then((r) => (r.ok ? r.json() : { metas: [] })),
            fetch(
              `https://v3-cinemeta.strem.io/catalog/movie/imdbRating.json`
            ).then((r) => (r.ok ? r.json() : { metas: [] })),
            fetch(
              `https://v3-cinemeta.strem.io/catalog/series/imdbRating.json`
            ).then((r) => (r.ok ? r.json() : { metas: [] })),
          ]);

          const movieTop: CinemetaItem[] =
            mTopRes.status === 'fulfilled' && Array.isArray(mTopRes.value.metas)
              ? mTopRes.value.metas.map((m: CinemetaItem) => ({
                  ...m,
                  type: 'movie',
                }))
              : [];
          const seriesTop: CinemetaItem[] =
            sTopRes.status === 'fulfilled' && Array.isArray(sTopRes.value.metas)
              ? sTopRes.value.metas.map((s: CinemetaItem) => ({
                  ...s,
                  type: 'series',
                }))
              : [];
          const cartoonsList: CinemetaItem[] =
            cartoonsRes.status === 'fulfilled' &&
            Array.isArray(cartoonsRes.value.metas)
              ? cartoonsRes.value.metas.map((c: CinemetaItem) => ({
                  ...c,
                  type: 'movie',
                }))
              : [];
          const movieImdb: CinemetaItem[] =
            mImdbRes.status === 'fulfilled' &&
            Array.isArray(mImdbRes.value.metas)
              ? mImdbRes.value.metas.map((m: CinemetaItem) => ({
                  ...m,
                  type: 'movie',
                }))
              : [];
          const seriesImdb: CinemetaItem[] =
            sImdbRes.status === 'fulfilled' &&
            Array.isArray(sImdbRes.value.metas)
              ? sImdbRes.value.metas.map((s: CinemetaItem) => ({
                  ...s,
                  type: 'series',
                }))
              : [];

          const kpNewMapped: CinemetaItem[] =
            kpNewRes.status === 'fulfilled' &&
            Array.isArray(kpNewRes.value.items)
              ? kpNewRes.value.items.map(
                  (f: {
                    kinopoiskId: number;
                    imdbId?: string | null;
                    type?: string;
                    nameRu?: string | null;
                    nameEn?: string | null;
                    nameOriginal?: string | null;
                    year?: number | string | null;
                    ratingKinopoisk?: number | null;
                    ratingImdb?: number | null;
                    posterUrlPreview?: string;
                    posterUrl?: string;
                    genres?: Array<{ genre: string }>;
                  }) => {
                    const isSeries =
                      f.type === 'TV_SERIES' ||
                      f.type === 'MINI_SERIES' ||
                      f.type === 'TV_SHOW';
                    const validImdb =
                      f.imdbId && /^tt\d+$/.test(f.imdbId) ? f.imdbId : '';
                    const ratingVal = f.ratingKinopoisk || f.ratingImdb;
                    return {
                      id: validImdb || `kp_${f.kinopoiskId}`,
                      kpId: String(f.kinopoiskId),
                      type: isSeries ? 'series' : 'movie',
                      name:
                        f.nameOriginal ||
                        f.nameEn ||
                        f.nameRu ||
                        `Film #${f.kinopoiskId}`,
                      releaseInfo:
                        f.year && String(f.year) !== 'null'
                          ? String(f.year)
                          : '2026',
                      imdbRating: ratingVal ? String(ratingVal) : undefined,
                      poster: f.posterUrlPreview || f.posterUrl,
                      background: f.posterUrl || f.posterUrlPreview,
                      genres: f.genres?.map((g) => g.genre).filter(Boolean),
                    };
                  }
                )
              : [];

          // 1. Сейчас смотрят (Mixed Top Movies + Top Series: 12 items)
          const watchingNowMix: CinemetaItem[] = [];
          const usedIds = new Set<string>();
          for (let i = 0; i < 16 && watchingNowMix.length < 12; i++) {
            const m = movieTop[i];
            if (m && !usedIds.has(m.id)) {
              usedIds.add(m.id);
              watchingNowMix.push(m);
            }
            const s = seriesTop[i];
            if (s && !usedIds.has(s.id) && watchingNowMix.length < 12) {
              usedIds.add(s.id);
              watchingNowMix.push(s);
            }
          }

          // 2. Новинки / Adăugate Noi 2025-2026 (Mixed New Series + New Movies: 12 items)
          const newPool: CinemetaItem[] = [];
          const cmRecentMovies = movieTop.filter((m) =>
            /^(2026|2025)/.test(String(m.releaseInfo || ''))
          );
          const cmRecentSeries = seriesTop.filter((s) =>
            /^(2026|2025)|–\s*$/.test(String(s.releaseInfo || ''))
          );
          const maxNewLen = Math.max(
            kpNewMapped.length,
            cmRecentSeries.length,
            cmRecentMovies.length
          );
          for (let i = 0; i < maxNewLen; i++) {
            if (cmRecentSeries[i]) newPool.push(cmRecentSeries[i]);
            if (cmRecentMovies[i]) newPool.push(cmRecentMovies[i]);
            if (kpNewMapped[i]) newPool.push(kpNewMapped[i]);
          }
          const newlyAddedMix: CinemetaItem[] = [];
          for (const item of newPool) {
            if (!usedIds.has(item.id)) {
              usedIds.add(item.id);
              newlyAddedMix.push(item);
              if (newlyAddedMix.length >= 12) break;
            }
          }

          // 3. Популярные сериалы / Seriale Populare (12 items)
          const popularSeries: CinemetaItem[] = [];
          for (const s of seriesTop) {
            if (!usedIds.has(s.id)) {
              usedIds.add(s.id);
              popularSeries.push(s);
              if (popularSeries.length >= 12) break;
            }
          }

          // 4. Популярные фильмы / Filme Populare (12 items)
          const popularMovies: CinemetaItem[] = [];
          for (const m of movieTop) {
            if (!usedIds.has(m.id)) {
              usedIds.add(m.id);
              popularMovies.push(m);
              if (popularMovies.length >= 12) break;
            }
          }

          // 5. Мультфильмы / Desene & Animație (12 items)
          const cartoons: CinemetaItem[] = [];
          for (const c of cartoonsList) {
            if (!usedIds.has(c.id)) {
              usedIds.add(c.id);
              cartoons.push(c);
              if (cartoons.length >= 12) break;
            }
          }

          // 6. Рекомендуем посмотреть — Топ IMDb (Mixed Top IMDb Series + Movies)
          const recommendedMix: CinemetaItem[] = [];
          const maxRec = Math.max(
            seriesImdb.length,
            movieImdb.length,
            seriesTop.length,
            movieTop.length
          );
          for (let i = 0; i < maxRec && recommendedMix.length < 20; i++) {
            for (const candidate of [
              seriesImdb[i],
              movieImdb[i],
              seriesTop[i + 10],
              movieTop[i + 10],
            ]) {
              if (
                candidate &&
                !usedIds.has(candidate.id) &&
                recommendedMix.length < 20
              ) {
                usedIds.add(candidate.id);
                recommendedMix.push(candidate);
              }
            }
          }

          setHomeShelves({
            watchingNowMix,
            newlyAddedMix,
            popularSeries,
            popularMovies,
            cartoons,
          });
          setVodItems(recommendedMix);
          setHasMoreVod(true);
          if (watchingNowMix[0]) {
            handleFocusVodItem(watchingNowMix[0]);
          }
        } else if (useKinopoisk) {
          const kpType = mediaType === 'series' ? 'TV_SERIES' : 'FILM';
          const order =
            effectiveGenre === 'imdbRating' || filterRating !== 'any'
              ? 'RATING'
              : 'NUM_VOTE';
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
          if (section === 'filter' && ratingObj?.minRating) {
            qs.set('ratingFrom', String(ratingObj.minRating));
          }
          if (section === 'filter' && yearObj?.yearFrom) {
            qs.set('yearFrom', String(yearObj.yearFrom));
            qs.set('yearTo', String(yearObj.yearTo || yearObj.yearFrom));
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
            handleFocusVodItem(mapped[0]);
          }
        } else {
          const skip = (pageNum - 1) * 50;
          let url = '';
          if (effectiveGenre === 'top') {
            url =
              skip > 0
                ? `https://v3-cinemeta.strem.io/catalog/${mediaType}/top/skip=${skip}.json`
                : `https://v3-cinemeta.strem.io/catalog/${mediaType}/top.json`;
          } else if (effectiveGenre === 'imdbRating') {
            url =
              skip > 0
                ? `https://v3-cinemeta.strem.io/catalog/${mediaType}/imdbRating/skip=${skip}.json`
                : `https://v3-cinemeta.strem.io/catalog/${mediaType}/imdbRating.json`;
          } else {
            url =
              skip > 0
                ? `https://v3-cinemeta.strem.io/catalog/${mediaType}/top/genre=${encodeURIComponent(effectiveGenre)}&skip=${skip}.json`
                : `https://v3-cinemeta.strem.io/catalog/${mediaType}/top/genre=${encodeURIComponent(effectiveGenre)}.json`;
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
            handleFocusVodItem(list[0]);
          }
        }
      } catch {
        if (!append) setVodItems([]);
      } finally {
        setIsVodLoading(false);
        setIsLoadingMoreVod(false);
      }
    },
    [
      section,
      originCountry,
      selectedGenre,
      filterMediaType,
      filterRating,
      filterYear,
      handleFocusVodItem,
      savedVodItems,
    ]
  );

  useEffect(() => {
    if (
      section === 'home' ||
      section === 'movies' ||
      section === 'cartoons' ||
      section === 'series' ||
      section === 'catalog' ||
      section === 'filter'
    ) {
      setVodPage(1);
      void fetchVodCatalog(1, false);
    }
  }, [
    section,
    originCountry,
    selectedGenre,
    filterMediaType,
    filterRating,
    filterYear,
    fetchVodCatalog,
  ]);

  // Fetch Live TV channels when in TV section (supports 'FAV', 'IEDEM' M3U playlist, 'ADULT' 18+, + 13 Countries)
  useEffect(() => {
    if (section !== 'tv') return;
    if (tvRegionId === 'FAV') {
      const favList = adultContentEnabled
        ? favoriteTvChannels
        : favoriteTvChannels.filter((c) => !isAdultTvChannel(c));
      setTvChannels(favList);
      setIsTvLoading(false);
      return;
    }

    if (tvRegionId === 'IEDEM') {
      const iedemList = adultContentEnabled
        ? customTvChannels
        : customTvChannels.filter((c) => !isAdultTvChannel(c));
      if (iedemList.length > 0) {
        setTvChannels(iedemList);
        setIsTvLoading(false);
        return;
      }
    }

    let cancelled = false;
    setIsTvLoading(true);

    if (tvRegionId === 'ADULT' || tvCategoryId === 'ADULT') {
      const customAdult = customTvChannels.filter((c) => isAdultTvChannel(c));
      fetchAdultTvChannels()
        .then((fetchedAdult) => {
          if (cancelled) return;
          const seen = new Set(customAdult.map((c) => c.url));
          const merged = [
            ...customAdult,
            ...fetchedAdult.filter((c) => !seen.has(c.url)),
          ];
          setTvChannels(merged);
        })
        .catch(() => {
          if (!cancelled) setTvChannels(customAdult);
        })
        .finally(() => {
          if (!cancelled) setIsTvLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    const region =
      TV_LIVE_REGIONS.find(
        (r) => r.id === tvRegionId && r.id !== 'IEDEM' && r.id !== 'ADULT'
      ) || TV_LIVE_REGIONS.find((r) => r.id === 'RO')!;

    fetchTvChannelsByCountry(region.country)
      .then((channels) => {
        if (cancelled) return;
        const base = channels.slice(0, 220);
        const filtered = adultContentEnabled
          ? base
          : base.filter((c) => !isAdultTvChannel(c));
        setTvChannels(filtered);
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
  }, [
    section,
    tvRegionId,
    tvCategoryId,
    favoriteTvChannels,
    customTvChannels,
    adultContentEnabled,
  ]);

  // Fetch Radio stations when in Radio section (supports 'FAV' Favorite Radio + 14 Countries)
  useEffect(() => {
    if (section !== 'radio') return;
    if (radioCountry === 'FAV') {
      setRadioStations(favorites);
      setIsRadioLoading(false);
      return;
    }

    let cancelled = false;
    setIsRadioLoading(true);

    fetchStationsByCountry(radioCountry)
      .then((stations) => {
        if (cancelled) return;
        const top = stations.slice(0, 150);
        setRadioStations(top);
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
  }, [section, radioCountry, favorites]);

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

  // Open Movie/Series in Lampa Full Detail Card (Карточка фильма)
  const handleOpenVod = useCallback(
    (item: CinemetaItem, autoPlayImmediately = false) => {
      if (autoPlayImmediately && tvSettings.autoFullscreenOnPlay) {
        requestTvFullscreen();
      }
      const saved = watchProgressMap[item.id];
      const targetSeason = saved?.season || 1;
      const targetEpisode = saved?.episode || 1;
      const epKey = `S${targetSeason}E${targetEpisode}`;
      const epSaved = saved?.episodeProgressMap?.[epKey];
      const startSec =
        item.type === 'series'
          ? (epSaved?.currentTime ?? saved?.currentTime ?? 0)
          : (saved?.currentTime ?? 0);

      setIsDirectStreamLoading(true);
      setResolvedDirectStream(null);
      setActiveVodItem(item);
      setIsSidebarOpen(false);
      setIsPlayingVod(autoPlayImmediately);
      try {
        window.history.pushState({ lampaCard: item.id }, '');
      } catch {
        // ignore
      }
      setSelectedAudioTrackIdx(-1);
      setSelectedSeason(targetSeason);
      setSelectedEpisode(targetEpisode);
      setActiveServer(
        tvSettings.defaultVodServer === 'auto_best'
          ? 'kinogram_hls'
          : tvSettings.defaultVodServer
      );
      if (tvSettings.defaultSubLang !== 'off') {
        setPreferredSubLang(tvSettings.defaultSubLang);
      }
      setActiveSubVttUrl(null);
      setActiveSubLabel('');
      setActiveSubCues([]);
      setIsEpisodesDrawerOpen(false);
      setIsInfoSheetOpen(false);
      wakeVodOsd();

      if (startSec > 10) {
        setPendingResumePromptSec(startSec);
        setResumeStartSeconds(startSec);
      } else {
        setPendingResumePromptSec(null);
        setResumeStartSeconds(0);
      }

      if (!autoPlayImmediately) {
        window.setTimeout(() => {
          playVodBtnRef.current?.focus();
        }, 80);
      }
    },
    [
      watchProgressMap,
      requestTvFullscreen,
      wakeVodOsd,
      tvSettings.autoFullscreenOnPlay,
      tvSettings.defaultVodServer,
      tvSettings.defaultSubLang,
    ]
  );

  const handleStartVodPlayback = useCallback(
    (customStartSec?: number) => {
      if (tvSettings.autoFullscreenOnPlay) {
        requestTvFullscreen();
      }
      if (typeof customStartSec === 'number') {
        setResumeStartSeconds(customStartSec);
        if (customStartSec === 0) {
          setPendingResumePromptSec(null);
        }
      }
      setIsPlayingVod(true);
      setIsInfoSheetOpen(true);
      wakeVodOsd();
    },
    [requestTvFullscreen, wakeVodOsd, tvSettings.autoFullscreenOnPlay]
  );

  // Open Official Movie / Series Trailer in Lampa Fullscreen Modal
  const handleOpenTrailer = useCallback(async () => {
    if (!activeVodItem) return;
    setIsTrailerModalOpen(true);
    setIsLoadingTrailer(true);
    setActiveTrailerIdx(0);

    const found: TrailerItem[] = [];
    const seenUrls = new Set<string>();
    const addTrailer = (id: string, title: string, embedUrl: string) => {
      if (!embedUrl || seenUrls.has(embedUrl)) return;
      seenUrls.add(embedUrl);
      found.push({ id, title, embedUrl });
    };

    try {
      // 1. Check already loaded Cinemeta trailers on detailedMeta
      if (Array.isArray(detailedMeta?.trailerStreams)) {
        for (const ts of detailedMeta.trailerStreams) {
          if (ts.ytId) {
            addTrailer(
              ts.ytId,
              ts.title || `${activeVodItem.name} — Trailer`,
              `https://www.youtube.com/embed/${ts.ytId}?autoplay=1&rel=0`
            );
          }
        }
      }
      if (Array.isArray(detailedMeta?.trailers)) {
        for (const tr of detailedMeta.trailers) {
          if (tr.source) {
            addTrailer(
              tr.source,
              `${activeVodItem.name} — Official Trailer`,
              `https://www.youtube.com/embed/${tr.source}?autoplay=1&rel=0`
            );
          }
        }
      }

      // 2. If no Cinemeta trailer yet, resolve IMDb ID (by ID or title search) and fetch Cinemeta meta
      let imdbId = activeVodItem.id.startsWith('tt')
        ? activeVodItem.id
        : detailedMeta?.imdbId || '';

      if (!imdbId && found.length === 0) {
        const qTitle = detailedMeta?.nameOriginal || activeVodItem.name;
        const searchRes = await fetch(
          `https://v3-cinemeta.strem.io/catalog/${activeVodItem.type}/top/search=${encodeURIComponent(
            qTitle
          )}.json`
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        const firstMatch = searchRes?.metas?.[0];
        if (firstMatch?.id && String(firstMatch.id).startsWith('tt')) {
          imdbId = String(firstMatch.id);
        }
      }

      if (imdbId && found.length === 0) {
        const cmData = await fetch(
          `https://v3-cinemeta.strem.io/meta/${activeVodItem.type}/${imdbId}.json`
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        const meta = cmData?.meta;
        if (Array.isArray(meta?.trailerStreams)) {
          for (const ts of meta.trailerStreams) {
            if (ts?.ytId) {
              addTrailer(
                ts.ytId,
                ts.title || `${activeVodItem.name} — Trailer`,
                `https://www.youtube.com/embed/${ts.ytId}?autoplay=1&rel=0`
              );
            }
          }
        }
        if (Array.isArray(meta?.trailers)) {
          for (const tr of meta.trailers) {
            if (tr?.source) {
              addTrailer(
                tr.source,
                `${activeVodItem.name} — Official Trailer`,
                `https://www.youtube.com/embed/${tr.source}?autoplay=1&rel=0`
              );
            }
          }
        }
      }

      // 3. Also check Kinopoisk /videos for Russian/Original trailers
      const kp =
        activeVodItem.kpId ||
        detailedMeta?.kpId ||
        (activeVodItem.id.startsWith('kp_')
          ? activeVodItem.id.replace(/^kp_/, '')
          : '');
      if (kp) {
        const kpVideos = await fetch(
          `https://kinopoiskapiunofficial.tech/api/v2.2/films/${kp}/videos`,
          {
            headers: {
              'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
            },
          }
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);

        if (Array.isArray(kpVideos?.items)) {
          for (const item of kpVideos.items) {
            const url = String(item?.url || '');
            const name = String(item?.name || 'Трейлер');
            const ytMatch = url.match(
              /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
            );
            if (ytMatch?.[1]) {
              addTrailer(
                ytMatch[1],
                name,
                `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`
              );
            } else if (url.includes('widgets.kinopoisk.ru/discovery/trailer/')) {
              addTrailer(url, `${name} (КП)`, url);
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // 4. Fallback if no explicit trailer ID was found
    if (found.length === 0) {
      const q = `${
        detailedMeta?.nameOriginal || activeVodItem.name
      } ${activeVodItem.releaseInfo || ''} official trailer`.trim();
      addTrailer(
        'yt_search',
        `${activeVodItem.name} — Official Trailer`,
        `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(
          q
        )}&autoplay=1`
      );
    }

    setTrailerList(found);
    setIsLoadingTrailer(false);
  }, [activeVodItem, detailedMeta]);

  // Lampa 1-Click Quick Subtitle Language Switcher (RO / RU / EN / Off)
  const handleQuickSubLangSwitch = useCallback(
    async (lang: 'off' | SubtitleLangId) => {
      if (lang === 'off') {
        setActiveSubVttUrl(null);
        setActiveSubLabel('');
        setActiveSubCues([]);
        return;
      }

      setPreferredSubLang(lang);
      if (!activeVodItem) return;

      const imdbId = activeVodItem.id.startsWith('tt')
        ? activeVodItem.id
        : detailedMeta?.imdbId || '';
      if (!imdbId) {
        setIsSubFinderOpen(true);
        return;
      }

      setIsLoadingQuickSub(lang);
      try {
        const tracks = await fetchOnlineSubtitlesByImdb({
          imdbId,
          type: activeVodItem.type,
          season: selectedSeason,
          episode: selectedEpisode,
        });
        const match = tracks.find((t) => t.langCode2 === lang);
        if (match) {
          const { vttBlobUrl, cues } = await downloadSubtitleAsVttBlobUrl(
            match.url
          );
          setActiveSubVttUrl(vttBlobUrl);
          setActiveSubLabel(match.langLabel);
          setActiveSubCues(cues);
        } else {
          setIsSubFinderOpen(true);
        }
      } catch {
        setIsSubFinderOpen(true);
      } finally {
        setIsLoadingQuickSub(null);
      }
    },
    [activeVodItem, selectedSeason, selectedEpisode]
  );

  // Fetch detailed Lampa meta (Cinemeta + Kinopoisk) & direct HLS stream when activeVodItem changes
  useEffect(() => {
    if (!activeVodItem) {
      setDetailedMeta(null);
      setResolvedDirectStream(null);
      return;
    }

    let cancelled = false;
    setIsDirectStreamLoading(true);
    setDetailedMeta({ ...activeVodItem });

    const kp =
      activeVodItem.kpId ||
      (activeVodItem.id.startsWith('kp_')
        ? activeVodItem.id.replace(/^kp_/, '')
        : '');
    const imdb = activeVodItem.id.startsWith('tt') ? activeVodItem.id : '';

    if (imdb) {
      fetch(
        `https://v3-cinemeta.strem.io/meta/${activeVodItem.type}/${imdb}.json`
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d?.meta) {
            setDetailedMeta((prev) => ({
              ...prev,
              ...d.meta,
              kpId: kp || prev?.kpId,
            }));
          }
        })
        .catch(() => {});
    }

    if (kp) {
      fetch(`https://kinopoiskapiunofficial.tech/api/v2.2/films/${kp}`, {
        headers: {
          'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
        },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((kpData) => {
          if (!cancelled && kpData) {
            setDetailedMeta((prev) => {
              const base = prev || { ...activeVodItem };
              const countriesStr = Array.isArray(kpData.countries)
                ? kpData.countries
                    .map((c: { country: string }) => c.country)
                    .filter(Boolean)
                    .join(', ')
                : base.country;
              const genresArr = Array.isArray(kpData.genres)
                ? kpData.genres
                    .map((g: { genre: string }) => g.genre)
                    .filter(Boolean)
                : base.genres;
              const ageStr = kpData.ratingAgeLimits
                ? `${String(kpData.ratingAgeLimits).replace(/^age/i, '')}+`
                : base.ageRating;
              const runtimeStr = kpData.filmLength
                ? `${kpData.filmLength} min`
                : base.runtime;
              return {
                ...base,
                imdbId:
                  typeof kpData.imdbId === 'string' &&
                  kpData.imdbId.startsWith('tt')
                    ? kpData.imdbId
                    : base.imdbId,
                nameOriginal:
                  kpData.nameOriginal || kpData.nameEn || base.nameOriginal,
                description:
                  kpData.description ||
                  kpData.shortDescription ||
                  base.description,
                slogan: kpData.slogan || base.slogan,
                ratingKinopoisk: kpData.ratingKinopoisk
                  ? String(kpData.ratingKinopoisk)
                  : base.ratingKinopoisk,
                imdbRating: kpData.ratingImdb
                  ? String(kpData.ratingImdb)
                  : base.imdbRating,
                country: countriesStr || base.country,
                genres: genresArr?.length ? genresArr : base.genres,
                ageRating: ageStr,
                runtime: runtimeStr,
                poster:
                  kpData.posterUrl || kpData.posterUrlPreview || base.poster,
                background:
                  kpData.coverUrl || kpData.posterUrl || base.background,
              };
            });

            // If item was opened by Kinopoisk ID (no initial 'tt') and kpData has imdbId, auto-load subtitle per Smart TV Settings
            if (
              !imdb &&
              tvSettings.defaultSubLang !== 'off' &&
              typeof kpData.imdbId === 'string' &&
              kpData.imdbId.startsWith('tt')
            ) {
              autoResolveAndFetchBestRoRuSubtitle({
                imdbId: kpData.imdbId,
                title: activeVodItem.name,
                nameOriginal: kpData.nameOriginal || kpData.nameEn,
                type: activeVodItem.type,
                season: selectedSeason,
                episode: selectedEpisode,
                preferredLang: tvSettings.defaultSubLang,
              })
                .then((subRes) => {
                  if (cancelled || !subRes) return;
                  setActiveSubVttUrl(subRes.vttBlobUrl);
                  setActiveSubLabel(subRes.track.langLabel);
                  setActiveSubCues(subRes.cues);
                  if (
                    subRes.track.langCode2 === 'ro' ||
                    subRes.track.langCode2 === 'ru' ||
                    subRes.track.langCode2 === 'en'
                  ) {
                    setPreferredSubLang(subRes.track.langCode2);
                  }
                })
                .catch(() => {});
            }
          }
        })
        .catch(() => {});
    }

    // Automatically fetch & activate subtitle according to Smart TV Settings (unless 'off')
    if (tvSettings.defaultSubLang === 'off') {
      setActiveSubVttUrl(null);
      setActiveSubLabel('');
      setActiveSubCues([]);
    } else {
      autoResolveAndFetchBestRoRuSubtitle({
        imdbId: imdb,
        title: activeVodItem.name,
        nameOriginal: activeVodItem.nameOriginal,
        type: activeVodItem.type,
        season: selectedSeason,
        episode: selectedEpisode,
        preferredLang: tvSettings.defaultSubLang,
      })
        .then((subRes) => {
          if (cancelled || !subRes) return;
          setActiveSubVttUrl(subRes.vttBlobUrl);
          setActiveSubLabel(subRes.track.langLabel);
          setActiveSubCues(subRes.cues);
          if (
            subRes.track.langCode2 === 'ro' ||
            subRes.track.langCode2 === 'ru' ||
            subRes.track.langCode2 === 'en'
          ) {
            setPreferredSubLang(subRes.track.langCode2);
          }
          if (subRes.resolvedImdbId) {
            setDetailedMeta((prev) =>
              prev
                ? { ...prev, imdbId: prev.imdbId || subRes.resolvedImdbId }
                : prev
            );
          }
        })
        .catch(() => {});
    }

    resolveDirectVodStreamClient({
      imdb,
      kp,
      title: activeVodItem.name,
      type: activeVodItem.type,
      year: (activeVodItem.releaseInfo || '').slice(0, 4),
      season: selectedSeason,
      episode: selectedEpisode,
    })
      .then((data) => {
        if (cancelled) return;
        setResolvedDirectStream(data);
        if (data?.ok && (data.dashUrl || data.hlsUrl)) {
          const prefTrackIdx = resolveAudioTrackIndexByPreference(
            data.audioNames || [],
            tvSettings.defaultAudioPref
          );
          setSelectedAudioTrackIdx(prefTrackIdx);
          if (
            tvSettings.defaultVodServer !== 'auto_best' &&
            tvSettings.defaultVodServer !== 'nontongo'
          ) {
            setActiveServer(tvSettings.defaultVodServer);
          } else {
            // Always use Native 1080p DASH/HLS Player when direct stream is resolved!
            setActiveServer('kinogram_hls');
          }
        } else if (
          tvSettings.defaultVodServer !== 'auto_best' &&
          tvSettings.defaultVodServer !== 'kinogram_hls' &&
          tvSettings.defaultVodServer !== 'nontongo'
        ) {
          setActiveServer(tvSettings.defaultVodServer);
        } else {
          // Fallback to VidSpark 1080p/4K or Kinogram Embed (never nontongo.win)
          setActiveServer(imdb ? 'vidspark' : 'kinogram_embed');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedDirectStream({ ok: false });
          setActiveServer(
            tvSettings.defaultVodServer !== 'auto_best' &&
              tvSettings.defaultVodServer !== 'kinogram_hls' &&
              tvSettings.defaultVodServer !== 'nontongo'
              ? tvSettings.defaultVodServer
              : imdb
                ? 'vidspark'
                : 'kinogram_embed'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsDirectStreamLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeVodItem,
    selectedSeason,
    selectedEpisode,
    tvSettings.defaultSubLang,
    tvSettings.defaultAudioPref,
    tvSettings.defaultVodServer,
  ]);

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
          : item.type === 'series'
            ? 2700
            : 5400;

      const seasonEpsCount = seasonsMap.get(season)?.length || 0;
      const totalSeasonsCount = availableSeasons.length || 0;

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
          totalEpisodesInSeason:
            seasonEpsCount > 0
              ? seasonEpsCount
              : existing?.totalEpisodesInSeason,
          totalSeasons:
            totalSeasonsCount > 0 ? totalSeasonsCount : existing?.totalSeasons,
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
    [activeServer, preferredSubLang, seasonsMap, availableSeasons.length]
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

  const historyList = useMemo(() => {
    return Object.values(watchProgressMap)
      .filter((e) => e && e.item && e.currentTime >= 5)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [watchProgressMap]);

  // Automatically enrich watch history entries with exact episode count (Ep. X din Y) & runtime duration
  const enrichedHistoryIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const entry of historyList) {
      const id = entry.item.id;
      const needsSeriesEps =
        entry.item.type === 'series' && !entry.totalEpisodesInSeason;
      const needsMovieDur =
        entry.item.type === 'movie' &&
        (!entry.duration || entry.duration === 5400);
      if (
        (!needsSeriesEps && !needsMovieDur) ||
        enrichedHistoryIdsRef.current.has(id)
      ) {
        continue;
      }
      enrichedHistoryIdsRef.current.add(id);

      if (id.startsWith('tt')) {
        fetch(
          `https://v3-cinemeta.strem.io/meta/${entry.item.type}/${id}.json`
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            const meta = d?.meta as DetailedMeta | undefined;
            if (!meta) return;
            let epCount = 0;
            let sCount = 0;
            if (entry.item.type === 'series' && Array.isArray(meta.videos)) {
              const sSet = new Set<number>();
              for (const v of meta.videos) {
                const sNum = Number(v.season);
                const eNum = Number(v.episode ?? v.number);
                if (sNum > 0 && eNum > 0) {
                  sSet.add(sNum);
                  if (sNum === entry.season) epCount++;
                }
              }
              sCount = sSet.size;
            }
            const rtMatch = String(meta.runtime || '').match(/(\d+)/);
            const parsedRuntimeSec = rtMatch
              ? Number(rtMatch[1]) * 60
              : entry.item.type === 'series'
                ? 2700
                : 5400;

            setWatchProgressMap((prev) => {
              const cur = prev[id];
              if (!cur) return prev;
              const next: Record<string, VodWatchProgressEntry> = {
                ...prev,
                [id]: {
                  ...cur,
                  totalEpisodesInSeason:
                    epCount > 0 ? epCount : cur.totalEpisodesInSeason,
                  totalSeasons: sCount > 0 ? sCount : cur.totalSeasons,
                  duration:
                    cur.duration && cur.duration !== 5400
                      ? cur.duration
                      : parsedRuntimeSec > 600
                        ? parsedRuntimeSec
                        : cur.duration,
                },
              };
              saveWatchProgressMap(next);
              return next;
            });
          })
          .catch(() => {});
      }
    }
  }, [historyList]);

  const renderPosterProgressOverlay = (entry?: VodWatchProgressEntry) => {
    if (!entry || entry.currentTime <= 5) return null;
    const totalDur =
      entry.duration && entry.duration > 60
        ? entry.duration
        : entry.item.type === 'series'
          ? 2700
          : 5400;
    const pct = Math.min(
      100,
      Math.max(4, Math.round((entry.currentTime / totalDur) * 100))
    );
    const isSeries = entry.item.type === 'series';
    const totalEps = entry.totalEpisodesInSeason || 0;

    return (
      <div className="absolute inset-x-0 bottom-0 z-10 pt-8 pb-2 px-2.5 bg-gradient-to-t from-black/95 via-black/80 to-transparent flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-1">
          <span className="px-2 py-0.5 rounded-md bg-white text-[#141414] text-[10px] sm:text-[11px] font-extrabold shadow tabular-nums">
            ▶ {formatWatchSeconds(entry.currentTime)} /{' '}
            {formatWatchSeconds(totalDur)}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-black/80 text-emerald-400 text-[10px] font-extrabold tabular-nums">
            {pct}%
          </span>
        </div>
        {isSeries && (
          <div className="flex items-center justify-between gap-1 text-[10px] font-extrabold text-purple-200 bg-purple-950/85 border border-purple-400/30 rounded-md px-2 py-0.5">
            <span>
              S{entry.season}:E{entry.episode}
            </span>
            <span>
              {totalEps > 0
                ? `Ep. ${entry.episode} din ${totalEps}`
                : `Episodul ${entry.episode}`}
            </span>
          </div>
        )}
        {/* Visual Progress Line (Bar) inside the card */}
        <div className="w-full h-1.5 rounded-full bg-white/25 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      ref={rootContainerRef}
      className="fixed inset-0 z-40 bg-[#181818] text-zinc-100 flex flex-col overflow-hidden select-none"
    >
      {/* Full-Bleed Sharp Lampa Movie Backdrop when viewing Movie Content Page */}
      {(activeVodItem?.background ||
        detailedMeta?.background ||
        activeVodItem?.poster) &&
        !isPlayingVod && (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#10141d] transition-opacity duration-500"
          >
            <img
              src={
                detailedMeta?.background ||
                activeVodItem?.background ||
                `https://images.metahub.space/background/medium/${activeVodItem?.id}/img`
              }
              onError={(e) => {
                if (activeVodItem?.poster && e.currentTarget.src !== activeVodItem.poster) {
                  e.currentTarget.src = activeVodItem.poster;
                }
              }}
              alt=""
              className="w-full h-full object-cover object-top opacity-65"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#10141d] via-[#10141d]/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#10141d] via-[#10141d]/55 to-transparent" />
          </div>
        )}

      {/* TOP FULL-WIDTH LAMPA HEADER BAR (Identical to Lampa screenshot) */}
      {!isPlayingVod && (
        <header
          className={`relative z-20 h-16 px-5 sm:px-7 flex items-center justify-between gap-4 shrink-0 ${
            activeVodItem ? 'bg-transparent' : 'bg-[#141414]'
          }`}
        >
          {/* Left: < Back + ☰ Menu + Section Name - Source */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (activeVodItem) {
                  setIsPlayingVod(false);
                  setIsInfoSheetOpen(false);
                  setActiveVodItem(null);
                  setIsSidebarOpen(true);
                } else if (section !== 'home') {
                  setSection('home');
                  setIsSidebarOpen(true);
                }
              }}
              title="Назад / Înapoi la meniul anterior"
              className="h-10 px-3.5 rounded-full bg-white/15 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.4]" />
              {(activeVodItem || section !== 'home') && <span>Назад</span>}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen((prev) => {
                  const next = !prev;
                  if (next) {
                    window.setTimeout(() => {
                      const firstNav =
                        rootContainerRef.current?.querySelector<HTMLElement>(
                          'aside button'
                        );
                      firstNav?.focus();
                    }, 50);
                  }
                  return next;
                });
              }}
              title="Meniu Lateral Lampa (☰)"
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isSidebarOpen && activeVodItem
                  ? 'bg-white text-[#141414]'
                  : 'text-zinc-200 hover:bg-white/10 focus:bg-white focus:text-zinc-950'
              }`}
            >
              <Menu className="w-6 h-6 stroke-[2.2]" />
            </button>

            {!activeVodItem && (
              <h1 className="text-lg sm:text-[21px] font-normal tracking-wide text-zinc-100 truncate ml-1">
                {section === 'home'
                  ? 'Главная - TMDB'
                  : section === 'movies'
                    ? 'Фильмы - TMDB'
                    : section === 'cartoons'
                      ? 'Мультфильмы - TMDB'
                      : section === 'series'
                        ? 'Сериалы - TMDB'
                        : section === 'tv'
                          ? 'ТВ Онлайн - IPTV'
                          : section === 'radio'
                            ? 'Радио - Live'
                            : section === 'catalog'
                              ? 'Каталог - Страны'
                              : section === 'filter'
                                ? 'Фильтр - Жанры'
                                : section === 'saved'
                                  ? 'Избранное - Favorite'
                                  : section === 'history'
                                    ? 'История - Istoric'
                                    : 'Поиск - Căutare'}
              </h1>
            )}
          </div>

          {/* Right: Lampa Utility Icons + Clock + 2-Line Date */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {currentStation && (
              <div className="inline-flex items-center rounded-full bg-emerald-500/20 border border-emerald-500/40 overflow-hidden shadow">
                <button
                  type="button"
                  onClick={() => setIsTvRadioPlayerOpen(true)}
                  title="Deschide Playerul Radio cu Poză & Info Piesă"
                  className="h-8 pl-2 pr-2.5 text-emerald-300 hover:bg-emerald-500/30 focus:bg-white focus:text-[#141414] focus:outline-none text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {activeRadioTrack?.coverUrl ? (
                    <img
                      src={activeRadioTrack.coverUrl}
                      alt=""
                      className="w-5 h-5 rounded-full object-cover shrink-0 border border-white/20"
                    />
                  ) : (
                    <Volume2
                      className={`w-3.5 h-3.5 shrink-0 ${
                        playerStatus === 'playing' ? 'animate-pulse' : ''
                      }`}
                    />
                  )}
                  <span className="max-w-[190px] truncate">
                    {activeRadioTrack
                      ? `${currentStation.name} • ${
                          activeRadioTrack.artist
                            ? `${activeRadioTrack.artist} - ${activeRadioTrack.title}`
                            : activeRadioTrack.title
                        }`
                      : currentStation.name}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={stopRadio}
                  title="Oprește Radio"
                  className="h-8 px-2.5 border-l border-emerald-500/30 text-emerald-300 hover:bg-rose-500 hover:text-white focus:bg-rose-500 focus:text-white focus:outline-none inline-flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Search Icon */}
            <button
              type="button"
              onClick={() => {
                setActiveVodItem(null);
                setSection('search');
              }}
              title="Поиск / Căutare"
              className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 focus:bg-white focus:text-zinc-950 focus:outline-none transition-colors cursor-pointer"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Bell Icon with Red Dot */}
            <button
              type="button"
              onClick={() => {
                setActiveVodItem(null);
                setSection('catalog');
              }}
              title="Каталог по странам / Filtru pe Țări"
              className="relative w-9 h-9 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 focus:bg-white focus:text-zinc-950 focus:outline-none transition-colors cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
            </button>

            {/* Smart TV Settings Icon (Настройки / Setări Smart TV) */}
            <button
              type="button"
              onClick={() => {
                setIsFilterDrawerOpen(false);
                setIsCatalogDrawerOpen(false);
                setSettingsSubMenu(null);
                setIsSettingsDrawerOpen((prev) => !prev);
              }}
              title="Настройки / Setări Smart TV (Limbă Audio, Subtitrări, Calitate Video)"
              className={`flex w-9 h-9 rounded-full items-center justify-center transition-colors cursor-pointer ${
                isSettingsDrawerOpen
                  ? 'bg-white text-[#141414] shadow'
                  : 'text-zinc-300 hover:text-white hover:bg-white/10 focus:bg-white focus:text-zinc-950 focus:outline-none'
              }`}
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Profile / Favorites Icon */}
            <button
              type="button"
              onClick={() => {
                setActiveVodItem(null);
                setSection('saved');
              }}
              title="Избранное / Favorite"
              className="hidden sm:flex w-9 h-9 rounded-full bg-white/10 items-center justify-center text-zinc-200 hover:bg-white/20 focus:bg-white focus:text-zinc-950 focus:outline-none transition-colors cursor-pointer"
            >
              <User className="w-5 h-5" />
            </button>

            {/* Fullscreen Icon */}
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
              title="Ecran Complet TV"
              className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 focus:bg-white focus:text-zinc-950 focus:outline-none transition-colors cursor-pointer"
            >
              <Maximize2 className="w-5 h-5" />
            </button>

            {/* Reload Icon */}
            <button
              type="button"
              onClick={() => void fetchVodCatalog(1, false)}
              title="Reîncarcă"
              className="hidden md:flex w-9 h-9 rounded-full items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 focus:bg-white focus:text-zinc-950 focus:outline-none transition-colors cursor-pointer"
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            {/* Lampa 3-Dot Status Indicator */}
            <div className="hidden md:flex flex-col items-center gap-1 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="w-1 h-1 rounded-full bg-zinc-500" />
              <span className="w-1 h-1 rounded-full bg-zinc-500" />
            </div>

            {/* Lampa Clock + 2-Line Date */}
            <div className="flex items-center gap-2.5 pl-1">
              <div className="text-xl sm:text-[26px] font-bold tracking-tight text-white tabular-nums leading-none">
                {clockText}
              </div>
              <div className="hidden lg:flex flex-col text-[11px] leading-tight text-zinc-300 font-normal">
                <span>{dateLine1}</span>
                <span className="text-zinc-400">{dateLine2}</span>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* BODY CONTAINER: LEFT LAMPA SIDEBAR + RIGHT CONTENT AREA */}
      <div className="relative z-10 flex-1 min-h-0 flex overflow-hidden">
        {/* LEFT LAMPA NAVIGATION SIDEBAR (Toggled by ☰ Menu icon; shown on catalog or when ☰ is pressed on Movie Content Page) */}
        {!isPlayingVod && isSidebarOpen && (
          <aside
            aria-label="Meniu Principal Smart TV Lampa"
            className={`w-16 sm:w-56 py-2 px-2 sm:px-3 overflow-y-auto shrink-0 no-scrollbar ${
              activeVodItem
                ? 'bg-[#141414]/95 backdrop-blur-xl border-r border-white/10 shadow-2xl z-30'
                : 'bg-[#141414]'
            }`}
          >
            <nav className="space-y-1">
              {(
                [
                  { id: 'home', label: 'Главная', Icon: Home },
                  { id: 'movies', label: 'Фильмы', Icon: Clapperboard },
                  {
                    id: 'cartoons',
                    label: 'Мультфильмы',
                    Icon: Smile,
                  },
                  { id: 'series', label: 'Сериалы', Icon: Tv },
                  { id: 'tv', label: 'ТВ Онлайн', Icon: Monitor },
                  { id: 'radio', label: 'Радио', Icon: Radio },
                  { id: 'catalog', label: 'Каталог', Icon: Folder },
                  {
                    id: 'filter',
                    label: 'Фильтр',
                    Icon: SlidersHorizontal,
                  },
                  {
                    id: 'saved',
                    label: 'Избранное',
                    Icon: Bookmark,
                  },
                  {
                    id: 'history',
                    label: 'История',
                    Icon: Clock,
                  },
                  { id: 'search', label: 'Поиск', Icon: Search },
                ] as const
              ).map(({ id, label, Icon }) => {
                const isActive = section === id && !activeVodItem;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setActiveVodItem(null);
                      setIsSidebarOpen(true);
                      if (id === 'filter') {
                        setIsCatalogDrawerOpen(false);
                        setFilterSubMenu(null);
                        setIsFilterDrawerOpen(true);
                        return;
                      }
                      if (id === 'catalog') {
                        setIsFilterDrawerOpen(false);
                        setIsCatalogDrawerOpen(true);
                        return;
                      }
                      setIsFilterDrawerOpen(false);
                      setIsCatalogDrawerOpen(false);
                      setSection(id);
                    }}
                    className={`w-full min-h-[42px] px-3 sm:px-4 py-2 rounded-xl flex items-center justify-center sm:justify-start gap-3.5 text-[15px] transition-all focus:outline-none cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-[#d4d4d4] via-[#ffffff] to-[#c8c8c8] text-[#141414] font-medium shadow-md'
                        : 'text-zinc-300 hover:bg-white/10 hover:text-white focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] focus:font-medium'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0 stroke-[1.8]" />
                    <span className="hidden sm:inline truncate">{label}</span>
                  </button>
                );
              })}

              {/* Smart TV Settings & Normal Web Mode inside Lampa Left Sidebar */}
              <div className="pt-2 mt-2 border-t border-white/10 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsFilterDrawerOpen(false);
                    setIsCatalogDrawerOpen(false);
                    setSettingsSubMenu(null);
                    setIsSettingsDrawerOpen(true);
                  }}
                  className={`w-full min-h-[42px] px-3 sm:px-4 py-2 rounded-xl flex items-center justify-center sm:justify-start gap-3.5 text-[15px] transition-all focus:outline-none cursor-pointer ${
                    isSettingsDrawerOpen
                      ? 'bg-gradient-to-r from-[#d4d4d4] via-[#ffffff] to-[#c8c8c8] text-[#141414] font-medium shadow-md'
                      : 'text-zinc-300 hover:bg-white/10 hover:text-white focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] focus:font-medium'
                  }`}
                >
                  <Settings className="w-5 h-5 shrink-0 stroke-[1.8]" />
                  <span className="hidden sm:inline truncate">
                    Настройки / Setări
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onExitTvMode}
                  className="w-full min-h-[42px] px-3 sm:px-4 py-2 rounded-xl flex items-center justify-center sm:justify-start gap-3.5 text-[14px] text-zinc-400 hover:bg-white/10 hover:text-white focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] focus:font-medium transition-all focus:outline-none cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5 shrink-0 stroke-[1.8]" />
                  <span className="hidden sm:inline truncate">
                    Mod Web Normal
                  </span>
                </button>
              </div>
            </nav>
          </aside>
        )}

        {/* MAIN RIGHT SMART TV CANVAS */}
        <div className="relative z-10 flex-1 min-w-0 flex flex-col h-full overflow-hidden">

        {/* MAIN SCROLLABLE CONTENT AREA */}
        <main
          className={
            isPlayingVod
              ? 'flex-1 overflow-hidden p-0 m-0'
              : 'flex-1 overflow-y-auto px-5 sm:px-8 py-5 space-y-6'
          }
        >
          {/* 1A. ACTIVE MOVIE / SERIES 100% FULL MODE CINEMA PLAYER (WHEN PLAYING) */}
          {activeVodItem && isPlayingVod ? (
            <div
              ref={playerBoxRef}
              onMouseMove={wakeVodOsd}
              onKeyDown={wakeVodOsd}
              onClick={wakeVodOsd}
              className="fixed inset-0 z-[100] w-screen h-screen bg-black flex flex-col overflow-hidden"
            >
              {/* Auto-Hiding Smart TV Top OSD Overlay (Always visible when using an external iframe so mouse events aren't swallowed) */}
              <div
                onMouseEnter={wakeVodOsd}
                className={`absolute top-0 inset-x-0 z-30 p-3 sm:p-5 bg-gradient-to-b from-black/95 via-black/80 to-transparent transition-opacity duration-300 ${
                  isVodOsdVisible ||
                  isEpisodesDrawerOpen ||
                  activeServer !== 'kinogram_hls' ||
                  (!isDirectStreamLoading &&
                    !(
                      resolvedDirectStream?.ok &&
                      (resolvedDirectStream.dashUrl ||
                        resolvedDirectStream.hlsUrl)
                    ))
                    ? 'opacity-100 pointer-events-auto'
                    : 'opacity-0 pointer-events-none'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  {/* Left: Back to Lampa Card + Title + Quick Info */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => setIsPlayingVod(false)}
                      className="h-10 px-4 rounded-full bg-amber-500 hover:bg-amber-400 focus:bg-white text-zinc-950 font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 shadow-lg shrink-0 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Fișa Filmului</span>
                    </button>

                    <span className="px-2.5 py-1 rounded-full bg-zinc-800 border border-white/15 text-amber-400 text-xs font-extrabold uppercase shrink-0">
                      {activeVodItem.type === 'series'
                        ? `S${selectedSeason}:E${selectedEpisode}`
                        : 'FILM HD'}
                    </span>

                    <div className="min-w-0">
                      <h1 className="text-base sm:text-xl font-extrabold text-white truncate">
                        {activeVodItem.name}
                      </h1>
                      {(detailedMeta?.nameOriginal ||
                        detailedMeta?.country ||
                        detailedMeta?.runtime) && (
                        <div className="text-[11px] text-zinc-300 truncate">
                          {[
                            detailedMeta?.nameOriginal,
                            activeVodItem.releaseInfo,
                            detailedMeta?.country,
                            detailedMeta?.runtime,
                          ]
                            .filter(Boolean)
                            .join(' • ')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Server + Episoade + Favorite + Settings + Fullscreen */}
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <div className="inline-flex items-center gap-1 bg-zinc-900/95 border border-white/15 rounded-full px-3 h-10">
                      <Layers className="w-4 h-4 text-amber-400 shrink-0" />
                      <select
                        aria-label="Server Video"
                        value={activeServer}
                        onChange={(e) =>
                          setActiveServer(e.target.value as VodServerId)
                        }
                        className="bg-transparent text-white text-xs sm:text-sm font-bold outline-none cursor-pointer"
                      >
                        {VOD_SERVERS.map((srv) => (
                          <option
                            key={srv.id}
                            value={srv.id}
                            className="bg-zinc-900 text-white"
                          >
                            {srv.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {activeVodItem.type === 'series' &&
                      availableSeasons.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEpisodesDrawerOpen((prev) => !prev);
                            setIsInfoSheetOpen(false);
                          }}
                          className={`h-10 px-4 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                            isEpisodesDrawerOpen
                              ? 'bg-amber-500 text-zinc-950 border-amber-400'
                              : 'bg-zinc-900/95 hover:bg-zinc-800 text-amber-300 border-white/15'
                          }`}
                        >
                          <Tv className="w-4 h-4" />
                          <span>
                            Episoade (S{selectedSeason}:E{selectedEpisode})
                          </span>
                        </button>
                      )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsInfoSheetOpen((prev) => !prev);
                        setIsEpisodesDrawerOpen(false);
                      }}
                      className={`h-10 px-4 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                        isInfoSheetOpen
                          ? 'bg-white text-[#141414] border-white'
                          : 'bg-zinc-900/95 hover:bg-zinc-800 text-white border-white/15'
                      }`}
                    >
                      <span>🎙 Озвучка & Субтитры</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSettingsSubMenu(null);
                        setIsSettingsDrawerOpen(true);
                      }}
                      title="Настройки / Setări Smart TV"
                      className="h-10 w-10 rounded-full bg-zinc-900/95 hover:bg-zinc-800 text-white inline-flex items-center justify-center border border-white/15 cursor-pointer"
                    >
                      <Settings className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleSaveVodItem(activeVodItem)}
                      className={`h-10 px-3.5 rounded-full text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                        savedVodItems.some((x) => x.id === activeVodItem.id)
                          ? 'bg-rose-600 text-white border-rose-500'
                          : 'bg-zinc-900/95 hover:bg-zinc-800 text-zinc-200 border-white/15'
                      }`}
                    >
                      <Heart className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={requestTvFullscreen}
                      title="Ecran Complet"
                      className="h-10 w-10 rounded-full bg-zinc-900/95 hover:bg-zinc-800 text-white inline-flex items-center justify-center border border-white/15 cursor-pointer"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 100% Fullscreen Video Area */}
              <div className="relative flex-1 w-full h-full min-h-0 bg-black">
                {pendingResumePromptSec !== null &&
                  pendingResumePromptSec > 10 &&
                  isVodOsdVisible && (
                    <div className="absolute top-16 left-4 z-30 flex flex-wrap items-center gap-2 px-3.5 py-2 rounded-full bg-zinc-950/90 border border-amber-500/40 text-xs sm:text-sm text-zinc-100 shadow-2xl backdrop-blur-md">
                      <span>
                        Reluat automat de la{' '}
                        <strong className="font-mono text-amber-400">
                          {formatWatchSeconds(pendingResumePromptSec)}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setResumeStartSeconds(0);
                          setPendingResumePromptSec(null);
                        }}
                        className="px-3 py-1 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>De la început (00:00)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingResumePromptSec(null)}
                        className="px-2 py-0.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                {activeServer === 'kinogram_hls' ? (
                  isDirectStreamLoading ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-zinc-300">
                      <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
                      <p className="text-sm font-bold">
                        Pornire automată Full Mode HD pentru Smart TV...
                      </p>
                    </div>
                  ) : resolvedDirectStream?.ok &&
                    (resolvedDirectStream.dashUrl ||
                      resolvedDirectStream.hlsUrl) ? (
                    <VodNativeHlsPlayer
                      dashUrl={resolvedDirectStream.dashUrl}
                      hlsUrl={resolvedDirectStream.hlsUrl}
                      audioTrackLabels={resolvedDirectStream.audioNames}
                      initialAudioTrackIndex={effectiveAudioTrackIdx}
                      preferredQuality={tvSettings.defaultVideoQuality}
                      initialSubFontSize={tvSettings.defaultSubFontSize}
                      preferredSubLang={tvSettings.defaultSubLang}
                      startAtSeconds={resumeStartSeconds}
                      poster={activeVodItem.poster}
                      imdbId={
                        activeVodItem.id.startsWith('tt')
                          ? activeVodItem.id
                          : detailedMeta?.imdbId
                      }
                      mediaType={activeVodItem.type}
                      season={selectedSeason}
                      episode={selectedEpisode}
                      subtitleVttUrl={activeSubVttUrl}
                      subtitleLabel={activeSubLabel}
                      subtitleCues={activeSubCues}
                      isOsdVisible={isVodOsdVisible}
                      onApplyAutoSubtitle={({ vttBlobUrl, label, cues }) => {
                        setActiveSubVttUrl(vttBlobUrl);
                        setActiveSubLabel(label);
                        setActiveSubCues(cues);
                      }}
                      onOpenSubtitleFinder={() => setIsSubFinderOpen(true)}
                      onClearSubtitle={() => {
                        setActiveSubVttUrl(null);
                        setActiveSubLabel('');
                        setActiveSubCues([]);
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
                        resumeStartSeconds,
                        detailedMeta?.imdbId
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
                      resumeStartSeconds,
                      detailedMeta?.imdbId
                    )}
                    title={activeVodItem.name}
                    className="w-full h-full border-0"
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                )}

                {/* LAMPA MOVIE / SERIES FULL INFORMATION SHEET OVERLAY IN FULLSCREEN PLAYER */}
                {isInfoSheetOpen && isVodOsdVisible && (
                  <div className="absolute bottom-0 inset-x-0 z-30 max-h-[68vh] overflow-y-auto p-5 sm:p-7 bg-zinc-950/95 border-t border-amber-500/30 backdrop-blur-2xl shadow-2xl transition-opacity duration-300">
                    <div className="max-w-6xl mx-auto flex flex-col sm:flex-row gap-5">
                      {/* Left Poster */}
                      <div className="w-28 sm:w-40 aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 border border-white/15 shrink-0 hidden sm:block shadow-xl">
                        <img
                          src={
                            detailedMeta?.poster ||
                            activeVodItem.poster ||
                            `https://images.metahub.space/poster/medium/${activeVodItem.id}/img`
                          }
                          alt={activeVodItem.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Right Lampa Metadata Details */}
                      <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-zinc-950 text-xs font-extrabold uppercase">
                                {activeVodItem.type === 'series'
                                  ? 'Serial TV'
                                  : 'Film HD'}
                              </span>
                              {(detailedMeta?.imdbRating ||
                                activeVodItem.imdbRating) && (
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-extrabold inline-flex items-center gap-1">
                                  ★ IMDb{' '}
                                  {detailedMeta?.imdbRating ||
                                    activeVodItem.imdbRating}
                                </span>
                              )}
                              {detailedMeta?.ratingKinopoisk && (
                                <span className="px-2.5 py-0.5 rounded-full bg-orange-500/20 border border-orange-400/40 text-orange-300 text-xs font-extrabold">
                                  КП ★ {detailedMeta.ratingKinopoisk}
                                </span>
                              )}
                              {detailedMeta?.ageRating && (
                                <span className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-extrabold">
                                  {detailedMeta.ageRating}
                                </span>
                              )}
                              {(detailedMeta?.releaseInfo ||
                                activeVodItem.releaseInfo) && (
                                <span className="text-xs font-bold text-zinc-300">
                                  {detailedMeta?.releaseInfo ||
                                    activeVodItem.releaseInfo}
                                </span>
                              )}
                              {detailedMeta?.runtime && (
                                <span className="text-xs font-bold text-zinc-300">
                                  • {detailedMeta.runtime}
                                </span>
                              )}
                              {detailedMeta?.country && (
                                <span className="text-xs font-bold text-emerald-300">
                                  • {detailedMeta.country}
                                </span>
                              )}
                            </div>

                            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                              {activeVodItem.name}
                            </h2>
                            {detailedMeta?.nameOriginal &&
                              detailedMeta.nameOriginal !==
                                activeVodItem.name && (
                                <div className="text-xs sm:text-sm font-semibold text-zinc-400">
                                  Titlu original: {detailedMeta.nameOriginal}
                                </div>
                              )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setIsInfoSheetOpen(false)}
                            className="h-9 px-4 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-extrabold shrink-0 cursor-pointer"
                          >
                            Închide ✕
                          </button>
                        </div>

                        {/* Full Lampa Audio / Server / Subtitles Selector inside Fullscreen Player Overlay */}
                        <div className="p-4 rounded-2xl bg-black/70 border border-white/15 space-y-3">
                          <div className="space-y-2">
                            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                              Озвучка и Источник / Pistă Audio & Server
                            </div>
                            {resolvedDirectStream?.audioNames &&
                              resolvedDirectStream.audioNames.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2">
                                  {(() => {
                                    const names =
                                      resolvedDirectStream.audioNames || [];
                                    const prefIdx =
                                      resolveAudioTrackIndexByPreference(
                                        names,
                                        tvSettings.defaultAudioPref
                                      );
                                    const ordered = names
                                      .map((aName, idx) => ({ aName, idx }))
                                      .sort((a, b) => {
                                        if (a.idx === prefIdx) return -1;
                                        if (b.idx === prefIdx) return 1;
                                        return a.idx - b.idx;
                                      });
                                    return ordered.map(({ aName, idx }) => {
                                      const isSel =
                                        activeServer === 'kinogram_hls' &&
                                        effectiveAudioTrackIdx === idx;
                                      return (
                                        <button
                                          key={`${aName}_${idx}`}
                                          type="button"
                                          onClick={() => {
                                            setActiveServer('kinogram_hls');
                                            setSelectedAudioTrackIdx(idx);
                                          }}
                                          className={`h-9 px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                                            isSel
                                              ? 'bg-white text-[#141414] font-bold shadow'
                                              : 'bg-white/10 hover:bg-white/20 focus:bg-white focus:text-[#141414] text-zinc-200'
                                          }`}
                                        >
                                          <span>🎙 {aName}</span>
                                        </button>
                                      );
                                    });
                                  })()}
                                </div>
                              )}
                            <div className="flex flex-wrap items-center gap-2">
                              {VOD_SERVERS.map((srv) => {
                                const isSrv = activeServer === srv.id;
                                return (
                                  <button
                                    key={srv.id}
                                    type="button"
                                    onClick={() => setActiveServer(srv.id)}
                                    className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                      isSrv
                                        ? 'bg-white text-[#141414] font-bold shadow'
                                        : 'bg-white/10 hover:bg-white/20 focus:bg-white focus:text-[#141414] text-zinc-300'
                                    }`}
                                  >
                                    {srv.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="pt-2.5 border-t border-white/10 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 mr-1">
                              Субтитры:
                            </span>
                            {(
                              [
                                { id: 'off', label: 'Выкл / Oprit' },
                                { id: 'ro', label: '🇷🇴 Română' },
                                { id: 'ru', label: '🇷🇺 Русский' },
                                { id: 'en', label: '🇬🇧 English' },
                              ] as const
                            ).map((subOpt) => {
                              const isActiveSub =
                                subOpt.id === 'off'
                                  ? activeSubCues.length === 0 &&
                                    !activeSubVttUrl
                                  : (activeSubCues.length > 0 ||
                                      activeSubVttUrl) &&
                                    preferredSubLang === subOpt.id;
                              const isLoadingThis =
                                isLoadingQuickSub === subOpt.id;
                              return (
                                <button
                                  key={subOpt.id}
                                  type="button"
                                  onClick={() =>
                                    void handleQuickSubLangSwitch(subOpt.id)
                                  }
                                  className={`h-9 px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                                    isActiveSub
                                      ? 'bg-white text-[#141414] font-bold shadow'
                                      : 'bg-white/10 hover:bg-white/20 focus:bg-white focus:text-[#141414] text-zinc-200'
                                  }`}
                                >
                                  {isLoadingThis && (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  )}
                                  <span>{subOpt.label}</span>
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => setIsSubFinderOpen(true)}
                              className="h-9 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 focus:bg-white focus:text-[#141414] text-zinc-200 text-xs font-semibold cursor-pointer"
                            >
                              🔍 Поиск .SRT
                            </button>
                          </div>
                        </div>

                        {/* Genres & Audio Dubbing Pills */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(
                            detailedMeta?.genres ||
                            activeVodItem.genres ||
                            []
                          ).map((g) => (
                            <span
                              key={g}
                              className="px-2.5 py-0.5 rounded-full bg-zinc-800 border border-white/10 text-zinc-200 text-xs font-bold"
                            >
                              {g}
                            </span>
                          ))}
                          {resolvedDirectStream?.audioNames &&
                            resolvedDirectStream.audioNames.length > 0 && (
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                                🎙 Dublaj / Audio:{' '}
                                {resolvedDirectStream.audioNames
                                  .slice(0, 4)
                                  .join(', ')}
                              </span>
                            )}
                        </div>

                        {detailedMeta?.slogan && (
                          <p className="text-xs italic text-amber-300/90">
                            „{detailedMeta.slogan}”
                          </p>
                        )}

                        {/* Full Description / Synopsis */}
                        <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed max-w-4xl">
                          {detailedMeta?.description ||
                            activeVodItem.description ||
                            'Descrierea completă se încarcă...'}
                        </p>

                        {/* Director & Cast */}
                        {(detailedMeta?.director?.length ||
                          detailedMeta?.cast?.length) && (
                          <div className="pt-1 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-300">
                            {detailedMeta?.director &&
                              detailedMeta.director.length > 0 && (
                                <div>
                                  <span className="text-zinc-500 font-bold">
                                    Regia:{' '}
                                  </span>
                                  <span className="font-semibold text-white">
                                    {detailedMeta.director.join(', ')}
                                  </span>
                                </div>
                              )}
                            {detailedMeta?.cast &&
                              detailedMeta.cast.length > 0 && (
                                <div className="inline-flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span className="text-zinc-500 font-bold">
                                    Actori:{' '}
                                  </span>
                                  <span className="font-semibold text-zinc-200">
                                    {detailedMeta.cast.slice(0, 6).join(', ')}
                                  </span>
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Floating Bottom Seasons & Episodes Drawer for Series */}
                {activeVodItem.type === 'series' &&
                  isEpisodesDrawerOpen &&
                  availableSeasons.length > 0 && (
                    <div className="absolute bottom-0 inset-x-0 z-30 max-h-[55vh] overflow-y-auto p-5 bg-zinc-950/95 border-t border-white/15 backdrop-blur-xl space-y-4">
                      <div className="flex items-center justify-between gap-2">
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
                              className={`h-9 px-4 rounded-full text-xs sm:text-sm font-extrabold shrink-0 transition-all cursor-pointer ${
                                selectedSeason === sNum
                                  ? 'bg-amber-500 text-zinc-950 shadow-md'
                                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                              }`}
                            >
                              Sezonul {sNum}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsEpisodesDrawerOpen(false)}
                          className="h-9 px-4 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold shrink-0 cursor-pointer"
                        >
                          Închide ✕
                        </button>
                      </div>

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
                                setIsEpisodesDrawerOpen(false);
                              }}
                              className={`p-3 rounded-2xl text-left transition-all border cursor-pointer ${
                                isCurrent
                                  ? 'bg-amber-500 text-zinc-950 border-amber-400 font-extrabold shadow-lg'
                                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/10'
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
            </div>
          ) : activeVodItem ? (
            /* 1B. 100% IDENTICAL LAMPA CONTENT PAGE (Карточка фильма — Identical to media_1793707282476_ca720a98.jpg) */
            <div className="relative z-10 pb-16 pt-1 px-2 sm:px-4 space-y-7">
              {/* HERO SECTION: Left Poster + Right Metadata & Action Bar */}
              <div className="flex flex-col md:flex-row gap-7 lg:gap-9 items-start">
                {/* Left Poster (Clean Rounded Poster, No Clutter Below) */}
                <div className="w-44 sm:w-52 lg:w-[225px] shrink-0 mx-auto md:mx-0">
                  <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden bg-[#1e1e1e] shadow-2xl relative">
                    <img
                      src={
                        detailedMeta?.poster ||
                        activeVodItem.poster ||
                        `https://images.metahub.space/poster/medium/${activeVodItem.id}/img`
                      }
                      alt={activeVodItem.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Right Column: Year/Country, Huge Title, TMDB/IMDB/KP Row, Runtime/Genres, Reactions, Action Pills */}
                <div className="flex-1 min-w-0 space-y-3.5 pt-1 w-full">
                  {/* Line 1: Year, Country */}
                  <div className="text-sm sm:text-[15px] text-zinc-200 font-normal">
                    {[
                      detailedMeta?.releaseInfo ||
                        activeVodItem.releaseInfo ||
                        '2026',
                      detailedMeta?.country || 'США, Европа',
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </div>

                  {/* Line 2: Huge Bold Title */}
                  <h1 className="text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
                    {activeVodItem.name}
                  </h1>

                  {/* Line 3: TMDB / IMDB / KP Ratings + Age Rating + Status Outlined Boxes */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                    <span className="inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded bg-black/45 text-white">
                      <strong className="text-sm sm:text-[15px] font-bold">
                        {detailedMeta?.imdbRating ||
                          activeVodItem.imdbRating ||
                          '7.7'}
                      </strong>
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold tracking-wider">
                        TMDB
                      </span>
                    </span>

                    <span className="inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded bg-black/45 text-white">
                      <strong className="text-sm sm:text-[15px] font-bold">
                        {detailedMeta?.imdbRating ||
                          activeVodItem.imdbRating ||
                          '0.0'}
                      </strong>
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold tracking-wider">
                        IMDB
                      </span>
                    </span>

                    <span className="inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded bg-black/45 text-white">
                      <strong className="text-sm sm:text-[15px] font-bold">
                        {detailedMeta?.ratingKinopoisk || '0.0'}
                      </strong>
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold tracking-wider">
                        KP
                      </span>
                    </span>

                    <span className="px-2 py-0.5 rounded border border-white/60 text-xs text-white font-medium">
                      {detailedMeta?.ageRating || '17+'}
                    </span>

                    <span className="px-2.5 py-0.5 rounded border border-white/60 text-xs text-white font-medium">
                      Выпущенный
                    </span>
                  </div>

                  {/* Line 4: Runtime • Genres separated by | */}
                  <div className="text-sm sm:text-[15px] text-zinc-200 font-normal pt-0.5">
                    {[
                      detailedMeta?.runtime || '01:43',
                      (
                        detailedMeta?.genres ||
                        activeVodItem.genres || ['Мелодрама', 'Триллер']
                      ).join(' | '),
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </div>

                  {/* Line 5: Lampa Emoji Reactions Pills */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {[
                      { emoji: '👍', count: 199 },
                      { emoji: '🔥', count: 137 },
                      { emoji: '🥴', count: 89 },
                      { emoji: '💩', count: 39 },
                      { emoji: '😢', count: 29 },
                    ].map((r) => (
                      <span
                        key={r.emoji}
                        className="px-3 py-1 rounded-full bg-black/45 text-xs sm:text-sm text-white font-medium inline-flex items-center gap-1.5"
                      >
                        <span>{r.emoji}</span>
                        <span>{r.count}</span>
                      </span>
                    ))}
                  </div>

                  {/* Line 6: Lampa Action Buttons Row (White Play Pill + Round Trailer & Action Pills) */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-2">
                    {/* Primary White Play Pill ("Play") */}
                    <button
                      ref={playVodBtnRef}
                      type="button"
                      onClick={() => handleStartVodPlayback()}
                      className="h-12 px-7 rounded-full bg-white text-[#141414] hover:brightness-95 focus:ring-4 focus:ring-white/60 font-bold text-sm sm:text-[15px] inline-flex items-center gap-2.5 shadow-lg transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        {pendingResumePromptSec && pendingResumePromptSec > 10
                          ? `Play (${formatWatchSeconds(pendingResumePromptSec)})`
                          : activeVodItem.type === 'series'
                            ? `Play (S${selectedSeason}:E${selectedEpisode})`
                            : 'Play'}
                      </span>
                    </button>

                    {/* Circle Play Icon Pill — Official Trailer (Трейлер / Trailer) */}
                    <button
                      type="button"
                      title="Трейлер / Trailer"
                      aria-label="Трейлер / Trailer"
                      onClick={() => void handleOpenTrailer()}
                      className="h-12 w-14 rounded-full bg-black/50 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center">
                        <Play className="w-3 h-3 fill-current ml-0.5" />
                      </div>
                    </button>

                    {/* Bookmark Icon Pill (Избранное / Favorite) */}
                    <button
                      type="button"
                      title="В Избранное / La Favorite"
                      onClick={() => toggleSaveVodItem(activeVodItem)}
                      className={`h-12 w-14 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                        savedVodItems.some((x) => x.id === activeVodItem.id)
                          ? 'bg-white text-[#141414] shadow-md'
                          : 'bg-black/50 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-white'
                      }`}
                    >
                      <Bookmark
                        className={`w-5 h-5 ${
                          savedVodItems.some((x) => x.id === activeVodItem.id)
                            ? 'fill-current'
                            : ''
                        }`}
                      />
                    </button>

                    {/* Subtitles / Ticket Icon Pill */}
                    <button
                      type="button"
                      title="Субтитры / Subtitrări Online"
                      onClick={() => setIsSubFinderOpen(true)}
                      className={`h-12 w-14 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                        activeSubLabel || activeSubCues.length > 0
                          ? 'bg-white text-[#141414]'
                          : 'bg-black/50 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-white'
                      }`}
                    >
                      <Layers className="w-5 h-5" />
                    </button>

                    {/* Three Dots (•••) Options Pill — Opens Extended Player with Audio & Subtitles Selector */}
                    <button
                      type="button"
                      title="Озвучка, Сервер и Субтитры (Modul Extins)"
                      onClick={() => handleStartVodPlayback()}
                      className="h-12 w-14 rounded-full bg-black/50 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <span className="text-lg font-black tracking-widest leading-none">
                        •••
                      </span>
                    </button>

                    {/* Back Button Pill ("← Назад / Înapoi") directly in the Action Row */}
                    <button
                      type="button"
                      title="Назад к списку / Înapoi la catalog"
                      onClick={() => {
                        setIsPlayingVod(false);
                        setIsInfoSheetOpen(false);
                        setActiveVodItem(null);
                        setIsSidebarOpen(true);
                      }}
                      className="h-12 px-5 rounded-full bg-black/50 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Назад / Înapoi</span>
                    </button>
                  </div>

                  {/* Watch Progress Line (Time + Episodes Count) on Movie/Series Detail Card */}
                  {(() => {
                    const prog = watchProgressMap[activeVodItem.id];
                    if (!prog || prog.currentTime <= 5) return null;
                    const totalDur =
                      prog.duration && prog.duration > 60
                        ? prog.duration
                        : activeVodItem.type === 'series'
                          ? 2700
                          : 5400;
                    const pct = Math.min(
                      100,
                      Math.max(3, Math.round((prog.currentTime / totalDur) * 100))
                    );
                    const totalEps =
                      episodesForSeason.length ||
                      prog.totalEpisodesInSeason ||
                      0;
                    const epPct =
                      activeVodItem.type === 'series' && totalEps > 0
                        ? Math.min(
                            100,
                            Math.max(
                              5,
                              Math.round((selectedEpisode / totalEps) * 100)
                            )
                          )
                        : 0;

                    return (
                      <div className="max-w-xl p-3.5 rounded-2xl bg-black/55 border border-white/15 backdrop-blur-md space-y-2.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs sm:text-sm font-semibold text-zinc-200 tabular-nums">
                            <span>
                              Progres vizionare:{' '}
                              <strong className="text-amber-400">
                                {formatWatchSeconds(prog.currentTime)}
                              </strong>{' '}
                              / {formatWatchSeconds(totalDur)}
                            </span>
                            <span className="text-emerald-400 font-bold">
                              {pct}%
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-white/15 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {activeVodItem.type === 'series' && (
                          <div className="space-y-1 pt-1 border-t border-white/10">
                            <div className="flex items-center justify-between text-xs font-semibold text-purple-300">
                              <span>
                                Sezonul {selectedSeason} •{' '}
                                {totalEps > 0
                                  ? `Episodul ${selectedEpisode} din ${totalEps}`
                                  : `Episodul ${selectedEpisode}`}
                              </span>
                              {totalEps > 0 && (
                                <span className="text-purple-200 font-bold tabular-nums">
                                  Ep. {selectedEpisode}/{totalEps}
                                </span>
                              )}
                            </div>
                            {totalEps > 0 && (
                              <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-400 transition-all"
                                  style={{ width: `${epPct}%` }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* LAMPA "Подробно" DETAILS SECTION (Unboxed Synopsis + Metadata Columns + Bottom Count Badges) */}
              <div className="space-y-5 max-w-4xl">
                <h2 className="text-xl sm:text-[22px] font-normal text-white tracking-tight">
                  Подробно
                </h2>

                <p className="text-sm sm:text-[16px] text-zinc-100 leading-relaxed font-normal">
                  {detailedMeta?.description ||
                    activeVodItem.description ||
                    'Описание загружается...'}
                </p>

                {/* Metadata Columns Row: Дата релиза | Страны | Режиссер */}
                <div className="flex flex-wrap items-start gap-8 sm:gap-12 pt-1">
                  <div>
                    <div className="text-xs text-zinc-400 font-semibold">
                      Дата релиза
                    </div>
                    <div className="text-sm sm:text-[15px] text-zinc-100 mt-0.5">
                      {detailedMeta?.releaseInfo ||
                        activeVodItem.releaseInfo ||
                        '2026'}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-zinc-400 font-semibold">
                      Страны
                    </div>
                    <div className="text-sm sm:text-[15px] text-zinc-100 mt-0.5">
                      {detailedMeta?.country || 'Германия, США'}
                    </div>
                  </div>

                  {detailedMeta?.director &&
                    detailedMeta.director.length > 0 && (
                      <div>
                        <div className="text-xs text-zinc-400 font-semibold">
                          Режиссер
                        </div>
                        <div className="text-sm sm:text-[15px] text-zinc-100 mt-0.5">
                          {detailedMeta.director.join(', ')}
                        </div>
                      </div>
                    )}
                </div>

                {/* Bottom Lampa Count Badges Row: Жанр [2] | Производство [1] | Теги [11] */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsInfoSheetOpen((v) => !v)}
                    className="inline-flex items-center gap-2.5 pl-3.5 pr-1.5 py-1.5 rounded-lg bg-black/55 hover:bg-black/75 focus:bg-white focus:text-[#141414] text-xs sm:text-sm text-zinc-200 transition-colors cursor-pointer"
                  >
                    <span>Жанр</span>
                    <span className="px-2 py-0.5 rounded bg-white text-[#141414] font-bold text-xs">
                      {(detailedMeta?.genres || activeVodItem.genres || [])
                        .length || 2}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsInfoSheetOpen((v) => !v)}
                    className="inline-flex items-center gap-2.5 pl-3.5 pr-1.5 py-1.5 rounded-lg bg-black/55 hover:bg-black/75 focus:bg-white focus:text-[#141414] text-xs sm:text-sm text-zinc-200 transition-colors cursor-pointer"
                  >
                    <span>Производство</span>
                    <span className="px-2 py-0.5 rounded bg-white text-[#141414] font-bold text-xs">
                      1
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsInfoSheetOpen((v) => !v)}
                    className="inline-flex items-center gap-2.5 pl-3.5 pr-1.5 py-1.5 rounded-lg bg-black/55 hover:bg-black/75 focus:bg-white focus:text-[#141414] text-xs sm:text-sm text-zinc-200 transition-colors cursor-pointer"
                  >
                    <span>Теги</span>
                    <span className="px-2 py-0.5 rounded bg-white text-[#141414] font-bold text-xs">
                      11
                    </span>
                  </button>
                </div>
              </div>

              {/* For Series: Full Lampa Seasons & Episodes Section right on the Card */}
              {activeVodItem.type === 'series' &&
                availableSeasons.length > 0 && (
                  <div className="p-5 rounded-2xl bg-zinc-900/80 border border-white/15 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black uppercase tracking-wider text-amber-400 mr-2">
                        Sezoane & Episoade:
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
                          className={`h-10 px-5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                            selectedSeason === sNum
                              ? 'bg-amber-500 text-zinc-950 shadow-md'
                              : 'bg-zinc-950 hover:bg-zinc-800 focus:bg-white focus:text-zinc-950 text-zinc-200 border border-white/10'
                          }`}
                        >
                          Sezonul {sNum}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                      {episodesForSeason.map((ep) => {
                        const isCurrent = selectedEpisode === ep.episode;
                        const epKey = `S${selectedSeason}E${ep.episode}`;
                        const epProg =
                          watchProgressMap[activeVodItem.id]
                            ?.episodeProgressMap?.[epKey];
                        return (
                          <button
                            key={ep.id || ep.episode}
                            type="button"
                            onClick={() => {
                              setSelectedEpisode(ep.episode);
                              const startAt = epProg?.currentTime || 0;
                              handleStartVodPlayback(startAt > 10 ? startAt : 0);
                            }}
                            className={`p-3.5 rounded-xl text-left transition-all border cursor-pointer ${
                              isCurrent
                                ? 'bg-amber-500 text-zinc-950 border-amber-300 font-extrabold shadow-lg'
                                : 'bg-zinc-950 hover:bg-zinc-800 focus:bg-white focus:text-zinc-950 text-zinc-200 border-white/10'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-black">
                                Episodul {ep.episode}
                              </span>
                              <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                            </div>
                            <div
                              className={`text-[11px] truncate mt-1 ${
                                isCurrent ? 'text-zinc-900' : 'text-zinc-400'
                              }`}
                            >
                              {ep.name || `Episodul ${ep.episode}`}
                            </div>
                            {epProg && epProg.currentTime > 10 && (
                              <div
                                className={`text-[10px] font-bold mt-1 ${
                                  isCurrent
                                    ? 'text-zinc-950'
                                    : 'text-amber-400'
                                }`}
                              >
                                ▶ {formatWatchSeconds(epProg.currentTime)}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>
          ) : (
            <>
              {/* SECTION 0A: LAMPA MAIN PAGE ("Главная" — Mixed Series, Movies, Newly Added 2025-2026, Cartoons & Top IMDb) */}
              {section === 'home' && (
                <div className="space-y-8 pb-16">
                  {isVodLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
                      <Loader2 className="w-10 h-10 text-white animate-spin" />
                      <span className="text-sm font-medium">
                        Загрузка Главная (Фильмы, Сериалы, Новинки)...
                      </span>
                    </div>
                  ) : (
                    <>
                      {/* Optional Shelf 0: Продолжить просмотр (Continue Watching Movies & Series) */}
                      {historyList.length > 0 && (
                        <div className="space-y-3.5">
                          <div className="flex items-center justify-between gap-3">
                            <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                              Продолжить просмотр
                            </h2>
                            <button
                              type="button"
                              onClick={() => setSection('history')}
                              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
                            >
                              Вся история ({historyList.length}) →
                            </button>
                          </div>
                          <div className="grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-4">
                            {historyList.slice(0, 8).map((entry) => {
                              const item = entry.item;
                              const posterUrl =
                                item.poster ||
                                `https://images.metahub.space/poster/medium/${item.id}/img`;
                              return (
                                <button
                                  key={`home_hist_${item.id}`}
                                  type="button"
                                  onFocus={() => handleFocusVodItem(item)}
                                  onMouseEnter={() => handleFocusVodItem(item)}
                                  onClick={() => handleOpenVod(item)}
                                  className="group text-left focus:outline-none cursor-pointer"
                                >
                                  <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                    <img
                                      src={posterUrl}
                                      alt={item.name}
                                      loading="lazy"
                                      className="w-full h-full object-cover"
                                    />
                                    <span
                                      className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow ${
                                        item.type === 'series'
                                          ? 'bg-purple-600/90 text-white'
                                          : 'bg-amber-500/90 text-zinc-950'
                                      }`}
                                    >
                                      {item.type === 'series'
                                        ? `СЕРИАЛ S${entry.season}:E${entry.episode}`
                                        : 'ФИЛЬМ'}
                                    </span>
                                    {item.imdbRating && (
                                      <span className="absolute bottom-3.5 right-2.5 px-2 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs font-bold tracking-tight shadow-md">
                                        {item.imdbRating}
                                      </span>
                                    )}
                                    {renderPosterProgressOverlay(entry)}
                                  </div>
                                  <div className="mt-2.5 px-0.5">
                                    <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                      {item.name}
                                    </div>
                                    <div className="text-xs text-zinc-400 mt-0.5">
                                      {item.releaseInfo || '2026'}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Shelf 1: Сейчас смотрят — Фильмы и Сериалы (Mixed Movies & Series) */}
                      {homeShelves.watchingNowMix.length > 0 && (
                        <div className="space-y-3.5">
                          <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                            Сейчас смотрят — Фильмы и Сериалы
                          </h2>
                          <div className="grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-4">
                            {homeShelves.watchingNowMix.map((item) => {
                              const savedProg = watchProgressMap[item.id];
                              const isFav = savedVodItems.some(
                                (x) => x.id === item.id
                              );
                              const posterUrl =
                                item.poster ||
                                `https://images.metahub.space/poster/medium/${item.id}/img`;
                              return (
                                <button
                                  key={`home_watch_${item.id}`}
                                  type="button"
                                  onFocus={() => handleFocusVodItem(item)}
                                  onMouseEnter={() => handleFocusVodItem(item)}
                                  onClick={() => handleOpenVod(item)}
                                  className="group text-left focus:outline-none cursor-pointer"
                                >
                                  <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                    <img
                                      src={posterUrl}
                                      alt={item.name}
                                      loading="lazy"
                                      className="w-full h-full object-cover"
                                    />
                                    <span
                                      className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow ${
                                        item.type === 'series'
                                          ? 'bg-purple-600/90 text-white'
                                          : 'bg-amber-500/90 text-zinc-950'
                                      }`}
                                    >
                                      {item.type === 'series'
                                        ? 'СЕРИАЛ'
                                        : 'ФИЛЬМ'}
                                    </span>
                                    {isFav && (
                                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                        ❤
                                      </span>
                                    )}
                                    {item.imdbRating && (
                                      <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs sm:text-sm font-bold tracking-tight shadow-md">
                                        {item.imdbRating}
                                      </span>
                                    )}
                                    {renderPosterProgressOverlay(savedProg)}
                                  </div>
                                  <div className="mt-2.5 px-0.5">
                                    <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                      {item.name}
                                    </div>
                                    <div className="text-xs text-zinc-400 mt-0.5">
                                      {item.releaseInfo || '2026'} •{' '}
                                      {item.type === 'series'
                                        ? 'Сериал'
                                        : 'Фильм'}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Shelf 2: Новинки 2025–2026 — Недавно добавленные (Newly Added Movies & Series) */}
                      {homeShelves.newlyAddedMix.length > 0 && (
                        <div className="space-y-3.5 pt-1">
                          <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                            Новинки — Недавно добавленные (Фильмы и Сериалы)
                          </h2>
                          <div className="grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-4">
                            {homeShelves.newlyAddedMix.map((item) => {
                              const savedProg = watchProgressMap[item.id];
                              const isFav = savedVodItems.some(
                                (x) => x.id === item.id
                              );
                              const posterUrl =
                                item.poster ||
                                `https://images.metahub.space/poster/medium/${item.id}/img`;
                              return (
                                <button
                                  key={`home_new_${item.id}`}
                                  type="button"
                                  onFocus={() => handleFocusVodItem(item)}
                                  onMouseEnter={() => handleFocusVodItem(item)}
                                  onClick={() => handleOpenVod(item)}
                                  className="group text-left focus:outline-none cursor-pointer"
                                >
                                  <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                    <img
                                      src={posterUrl}
                                      alt={item.name}
                                      loading="lazy"
                                      className="w-full h-full object-cover"
                                    />
                                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-emerald-500 text-zinc-950 text-[10px] font-extrabold uppercase tracking-wider shadow">
                                      NEW
                                    </span>
                                    <span
                                      className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow ${
                                        item.type === 'series'
                                          ? 'bg-purple-600/90 text-white'
                                          : 'bg-amber-500/90 text-zinc-950'
                                      }`}
                                    >
                                      {item.type === 'series'
                                        ? 'СЕРИАЛ'
                                        : 'ФИЛЬМ'}
                                    </span>
                                    {isFav && (
                                      <span className="absolute top-9 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                        ❤
                                      </span>
                                    )}
                                    {item.imdbRating && (
                                      <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs sm:text-sm font-bold tracking-tight shadow-md">
                                        {item.imdbRating}
                                      </span>
                                    )}
                                    {renderPosterProgressOverlay(savedProg)}
                                  </div>
                                  <div className="mt-2.5 px-0.5">
                                    <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                      {item.name}
                                    </div>
                                    <div className="text-xs text-zinc-400 mt-0.5">
                                      {item.releaseInfo || '2026'} •{' '}
                                      {item.type === 'series'
                                        ? 'Сериал'
                                        : 'Фильм'}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Shelf 3: Популярные сериалы (Popular TV Series) */}
                      {homeShelves.popularSeries.length > 0 && (
                        <div className="space-y-3.5 pt-1">
                          <div className="flex items-center justify-between gap-3">
                            <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                              Популярные сериалы
                            </h2>
                            <button
                              type="button"
                              onClick={() => setSection('series')}
                              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
                            >
                              Все сериалы →
                            </button>
                          </div>
                          <div className="grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-4">
                            {homeShelves.popularSeries.map((item) => {
                              const savedProg = watchProgressMap[item.id];
                              const isFav = savedVodItems.some(
                                (x) => x.id === item.id
                              );
                              const posterUrl =
                                item.poster ||
                                `https://images.metahub.space/poster/medium/${item.id}/img`;
                              return (
                                <button
                                  key={`home_ser_${item.id}`}
                                  type="button"
                                  onFocus={() => handleFocusVodItem(item)}
                                  onMouseEnter={() => handleFocusVodItem(item)}
                                  onClick={() => handleOpenVod(item)}
                                  className="group text-left focus:outline-none cursor-pointer"
                                >
                                  <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                    <img
                                      src={posterUrl}
                                      alt={item.name}
                                      loading="lazy"
                                      className="w-full h-full object-cover"
                                    />
                                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-purple-600/90 text-white text-[10px] font-extrabold uppercase tracking-wider shadow">
                                      СЕРИАЛ
                                    </span>
                                    {isFav && (
                                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                        ❤
                                      </span>
                                    )}
                                    {item.imdbRating && (
                                      <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs sm:text-sm font-bold tracking-tight shadow-md">
                                        {item.imdbRating}
                                      </span>
                                    )}
                                    {renderPosterProgressOverlay(savedProg)}
                                  </div>
                                  <div className="mt-2.5 px-0.5">
                                    <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                      {item.name}
                                    </div>
                                    <div className="text-xs text-zinc-400 mt-0.5">
                                      {item.releaseInfo || '2026'} • Сериал
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Shelf 4: Популярные фильмы (Popular Movies) */}
                      {homeShelves.popularMovies.length > 0 && (
                        <div className="space-y-3.5 pt-1">
                          <div className="flex items-center justify-between gap-3">
                            <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                              Популярные фильмы
                            </h2>
                            <button
                              type="button"
                              onClick={() => setSection('movies')}
                              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
                            >
                              Все фильмы →
                            </button>
                          </div>
                          <div className="grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-4">
                            {homeShelves.popularMovies.map((item) => {
                              const savedProg = watchProgressMap[item.id];
                              const isFav = savedVodItems.some(
                                (x) => x.id === item.id
                              );
                              const posterUrl =
                                item.poster ||
                                `https://images.metahub.space/poster/medium/${item.id}/img`;
                              return (
                                <button
                                  key={`home_mov_${item.id}`}
                                  type="button"
                                  onFocus={() => handleFocusVodItem(item)}
                                  onMouseEnter={() => handleFocusVodItem(item)}
                                  onClick={() => handleOpenVod(item)}
                                  className="group text-left focus:outline-none cursor-pointer"
                                >
                                  <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                    <img
                                      src={posterUrl}
                                      alt={item.name}
                                      loading="lazy"
                                      className="w-full h-full object-cover"
                                    />
                                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-amber-500/90 text-zinc-950 text-[10px] font-extrabold uppercase tracking-wider shadow">
                                      ФИЛЬМ
                                    </span>
                                    {isFav && (
                                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                        ❤
                                      </span>
                                    )}
                                    {item.imdbRating && (
                                      <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs sm:text-sm font-bold tracking-tight shadow-md">
                                        {item.imdbRating}
                                      </span>
                                    )}
                                    {renderPosterProgressOverlay(savedProg)}
                                  </div>
                                  <div className="mt-2.5 px-0.5">
                                    <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                      {item.name}
                                    </div>
                                    <div className="text-xs text-zinc-400 mt-0.5">
                                      {item.releaseInfo || '2026'} • Фильм
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Shelf 5: Мультфильмы и Анимация (Cartoons & Animation) */}
                      {homeShelves.cartoons.length > 0 && (
                        <div className="space-y-3.5 pt-1">
                          <div className="flex items-center justify-between gap-3">
                            <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                              Мультфильмы и Анимация
                            </h2>
                            <button
                              type="button"
                              onClick={() => setSection('cartoons')}
                              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
                            >
                              Все мультфильмы →
                            </button>
                          </div>
                          <div className="grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-4">
                            {homeShelves.cartoons.map((item) => {
                              const savedProg = watchProgressMap[item.id];
                              const isFav = savedVodItems.some(
                                (x) => x.id === item.id
                              );
                              const posterUrl =
                                item.poster ||
                                `https://images.metahub.space/poster/medium/${item.id}/img`;
                              return (
                                <button
                                  key={`home_cart_${item.id}`}
                                  type="button"
                                  onFocus={() => handleFocusVodItem(item)}
                                  onMouseEnter={() => handleFocusVodItem(item)}
                                  onClick={() => handleOpenVod(item)}
                                  className="group text-left focus:outline-none cursor-pointer"
                                >
                                  <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                    <img
                                      src={posterUrl}
                                      alt={item.name}
                                      loading="lazy"
                                      className="w-full h-full object-cover"
                                    />
                                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-sky-500/90 text-zinc-950 text-[10px] font-extrabold uppercase tracking-wider shadow">
                                      МУЛЬТ
                                    </span>
                                    {isFav && (
                                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                        ❤
                                      </span>
                                    )}
                                    {item.imdbRating && (
                                      <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs sm:text-sm font-bold tracking-tight shadow-md">
                                        {item.imdbRating}
                                      </span>
                                    )}
                                    {renderPosterProgressOverlay(savedProg)}
                                  </div>
                                  <div className="mt-2.5 px-0.5">
                                    <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                      {item.name}
                                    </div>
                                    <div className="text-xs text-zinc-400 mt-0.5">
                                      {item.releaseInfo || '2026'} • Мультфильм
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Shelf 6: Рекомендуем посмотреть — Топ IMDb (Фильмы и Сериалы) */}
                      {vodItems.length > 0 && (
                        <div className="space-y-3.5 pt-2">
                          <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                            Рекомендуем посмотреть — Топ IMDb (Фильмы и Сериалы)
                          </h2>
                          <div className="grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-x-4 gap-y-6">
                            {vodItems.map((item) => {
                              const savedProg = watchProgressMap[item.id];
                              const isFav = savedVodItems.some(
                                (x) => x.id === item.id
                              );
                              const posterUrl =
                                item.poster ||
                                `https://images.metahub.space/poster/medium/${item.id}/img`;
                              return (
                                <button
                                  key={`home_rec_${item.id}`}
                                  type="button"
                                  onFocus={() => handleFocusVodItem(item)}
                                  onMouseEnter={() => handleFocusVodItem(item)}
                                  onClick={() => handleOpenVod(item)}
                                  className="group text-left focus:outline-none cursor-pointer"
                                >
                                  <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                    <img
                                      src={posterUrl}
                                      alt={item.name}
                                      loading="lazy"
                                      className="w-full h-full object-cover"
                                    />
                                    <span
                                      className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow ${
                                        item.type === 'series'
                                          ? 'bg-purple-600/90 text-white'
                                          : 'bg-amber-500/90 text-zinc-950'
                                      }`}
                                    >
                                      {item.type === 'series'
                                        ? 'СЕРИАЛ'
                                        : 'ФИЛЬМ'}
                                    </span>
                                    {isFav && (
                                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                        ❤
                                      </span>
                                    )}
                                    {item.imdbRating && (
                                      <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs sm:text-sm font-bold tracking-tight shadow-md">
                                        {item.imdbRating}
                                      </span>
                                    )}
                                    {renderPosterProgressOverlay(savedProg)}
                                  </div>
                                  <div className="mt-2.5 px-0.5">
                                    <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                      {item.name}
                                    </div>
                                    <div className="text-xs text-zinc-400 mt-0.5">
                                      {item.releaseInfo || '2026'} •{' '}
                                      {item.type === 'series'
                                        ? 'Сериал'
                                        : 'Фильм'}
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
                                Загрузка...
                              </>
                            ) : (
                              <>Показать ещё (Фильмы и Сериалы)</>
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* SECTION 0B: LAMPA CATEGORY VIEWS ("Фильмы", "Мультфильмы", "Сериалы" — Сейчас смотрят + Рекомендуем посмотреть, 5 per row) */}
              {(section === 'movies' ||
                section === 'cartoons' ||
                section === 'series') && (
                <div className="space-y-7 pb-16">
                  {isVodLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
                      <Loader2 className="w-10 h-10 text-white animate-spin" />
                      <span className="text-sm font-medium">
                        Загрузка TMDB...
                      </span>
                    </div>
                  ) : vodItems.length === 0 ? (
                    <div className="py-16 px-6 rounded-2xl bg-[#202020] border border-white/10 text-center space-y-2">
                      <div className="text-base font-bold text-white">
                        Nu s-au găsit titluri
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Shelf 1: Сейчас смотрят */}
                      <div className="space-y-3.5">
                        <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                          Сейчас смотрят
                        </h2>
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-4">
                          {vodItems.slice(0, 12).map((item) => {
                            const savedProg = watchProgressMap[item.id];
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
                                    className="w-full h-full object-cover"
                                  />
                                  {isFav && (
                                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                      ❤
                                    </span>
                                  )}
                                  {item.imdbRating && (
                                    <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs sm:text-sm font-bold tracking-tight shadow-md">
                                      {item.imdbRating}
                                    </span>
                                  )}
                                  {renderPosterProgressOverlay(savedProg)}
                                </div>
                                <div className="mt-2.5 px-0.5">
                                  <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                    {item.name}
                                  </div>
                                  <div className="text-xs text-zinc-400 mt-0.5">
                                    {item.releaseInfo || '2026'}
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
                            Рекомендуем посмотреть
                          </h2>
                          <div className="grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-x-4 gap-y-6">
                            {vodItems.slice(12).map((item) => {
                              const savedProg = watchProgressMap[item.id];
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
                                  onFocus={() => handleFocusVodItem(item)}
                                  onMouseEnter={() => handleFocusVodItem(item)}
                                  onClick={() => handleOpenVod(item)}
                                  className="group text-left focus:outline-none cursor-pointer"
                                >
                                  <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                    <img
                                      src={posterUrl}
                                      alt={item.name}
                                      loading="lazy"
                                      className="w-full h-full object-cover"
                                    />
                                    {isFav && (
                                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                        ❤
                                      </span>
                                    )}
                                    {item.imdbRating && (
                                      <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs sm:text-sm font-bold tracking-tight shadow-md">
                                        {item.imdbRating}
                                      </span>
                                    )}
                                    {renderPosterProgressOverlay(savedProg)}
                                  </div>
                                  <div className="mt-2.5 px-0.5">
                                    <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                      {item.name}
                                    </div>
                                    <div className="text-xs text-zinc-400 mt-0.5">
                                      {item.releaseInfo || '2026'}
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
                                Загрузка...
                              </>
                            ) : (
                              <>Показать ещё</>
                            )}
                          </button>
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
                      {section === 'catalog' ? 'Каталог' : 'Фильтр'}
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
                          ? 'Открыть Каталог'
                          : 'Настроить Фильтр'}
                      </span>
                    </button>
                  </div>

                  {/* Lampa 5-Column Poster Grid */}
                  {isVodLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
                      <Loader2 className="w-10 h-10 text-white animate-spin" />
                      <span className="text-sm font-medium">
                        Загрузка TMDB / Se încarcă catalogul Lampa...
                      </span>
                    </div>
                  ) : vodItems.length === 0 ? (
                    <div className="py-16 px-6 rounded-2xl bg-[#202020] border border-white/10 text-center space-y-2">
                      <div className="text-base font-extrabold text-white">
                        {originCountry === 'FAV'
                          ? 'Nu ai niciun titlu salvat la Favorite încă'
                          : 'Nu s-au găsit titluri pentru acest filtru'}
                      </div>
                      <p className="text-xs text-zinc-400">
                        {originCountry === 'FAV'
                          ? 'Deschide orice film sau serial și apasă pe butonul „В Избранное / La Favorite” din fișa Lampa.'
                          : 'Alege altă țară sau alt gen din filtrele de sus.'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-x-4 gap-y-6 pt-1">
                        {vodItems.map((item) => {
                          const savedProg = watchProgressMap[item.id];
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
                              onFocus={() => handleFocusVodItem(item)}
                              onMouseEnter={() => handleFocusVodItem(item)}
                              onClick={() => handleOpenVod(item)}
                              className="group text-left focus:outline-none cursor-pointer"
                            >
                              <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                <img
                                  src={posterUrl}
                                  alt={item.name}
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                                {isFav && (
                                  <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                    ❤
                                  </span>
                                )}
                                {item.imdbRating && (
                                  <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs sm:text-sm font-bold tracking-tight shadow-md">
                                    {item.imdbRating}
                                  </span>
                                )}
                                {renderPosterProgressOverlay(savedProg)}
                              </div>
                              <div className="mt-2.5 px-0.5">
                                <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                  {item.name}
                                </div>
                                <div className="text-xs text-zinc-400 mt-0.5">
                                  {item.releaseInfo || '2026'}
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
                                Se încarcă...
                              </>
                            ) : (
                              <>Показать ещё / Încarcă mai multe</>
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* SECTION 3: LIVE TV CHANNELS (WITH FAVORITES + iEDEM M3U + ADULT 18+ + COUNTRY FILTER + CATEGORY FILTER) */}
              {section === 'tv' && (
                <div className="space-y-3.5 pb-16">
                  {/* Row 1: Favorite TV + iEdem + 18+ Adult + Country Pills */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {TV_LIVE_REGIONS.filter(
                      (reg) => adultContentEnabled || reg.id !== 'ADULT'
                    ).map((reg) => {
                      const active = tvRegionId === reg.id;
                      const isAdultPill = reg.id === 'ADULT';
                      return (
                        <button
                          key={reg.id}
                          type="button"
                          onClick={() => {
                            setTvRegionId(reg.id);
                            if (reg.id === 'ADULT') {
                              setTvCategoryId('ALL');
                            }
                          }}
                          className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs sm:text-sm whitespace-nowrap shrink-0 transition-all focus:outline-none cursor-pointer ${
                            active
                              ? isAdultPill
                                ? 'bg-rose-600 text-white font-extrabold shadow-lg shadow-rose-600/30 border border-rose-400'
                                : 'bg-gradient-to-r from-[#d4d4d4] via-[#ffffff] to-[#c8c8c8] text-[#141414] font-semibold shadow-md'
                              : isAdultPill
                                ? 'bg-rose-500/15 hover:bg-rose-500/25 focus:bg-rose-600 focus:text-white text-rose-300 border border-rose-500/40 font-semibold'
                                : 'bg-[#222222] hover:bg-[#2c2c2c] focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] text-zinc-300 border border-white/5'
                          }`}
                        >
                          {reg.label}
                          {reg.id === 'FAV'
                            ? ` (${favoriteTvChannels.length})`
                            : reg.id === 'IEDEM' && customTvChannels.length > 0
                              ? ` (${customTvChannels.length})`
                              : ''}
                        </button>
                      );
                    })}
                  </div>

                  {/* Row 2: Live TV Category Filter Pills (Standard + iEdem Dynamic Groups + 18+ Adult) */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {(() => {
                      const baseCats = TV_LIVE_CATEGORIES.filter(
                        (cat) => adultContentEnabled || cat.id !== 'ADULT'
                      );
                      // Also expose dynamic group-title categories from the user's iEdem M3U playlist
                      const dynamicGroups: Array<{
                        id: string;
                        label: string;
                        match: string;
                      }> = [];
                      if (customTvChannels.length > 0) {
                        const counts = new Map<string, number>();
                        for (const ch of customTvChannels) {
                          if (!adultContentEnabled && isAdultTvChannel(ch)) {
                            continue;
                          }
                          const g = (ch.group || '').trim();
                          if (g) counts.set(g, (counts.get(g) || 0) + 1);
                        }
                        for (const [groupName, count] of counts.entries()) {
                          const isAdultGrp =
                            /взросл|adult|xxx|18\+|эротик/i.test(groupName);
                          dynamicGroups.push({
                            id: `GRP:${groupName}`,
                            label: `${isAdultGrp ? '🔞 ' : '📁 '}${groupName} (${count})`,
                            match: groupName.toLowerCase(),
                          });
                        }
                      }
                      const allCats = [...baseCats, ...dynamicGroups];
                      return allCats.map((cat) => {
                        const active = tvCategoryId === cat.id;
                        const isAdultCat =
                          cat.id === 'ADULT' ||
                          /взросл|adult|xxx|18\+|эротик/i.test(cat.label);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setTvCategoryId(cat.id)}
                            className={`min-h-[36px] px-4 py-1 rounded-xl text-xs whitespace-nowrap shrink-0 transition-all focus:outline-none cursor-pointer ${
                              active
                                ? isAdultCat
                                  ? 'bg-rose-600 text-white font-bold shadow-md border border-rose-400'
                                  : 'bg-gradient-to-r from-[#d4d4d4] via-[#ffffff] to-[#c8c8c8] text-[#141414] font-semibold shadow-md'
                                : isAdultCat
                                  ? 'bg-rose-500/15 hover:bg-rose-500/25 focus:bg-rose-600 focus:text-white text-rose-300 border border-rose-500/35 font-semibold'
                                  : 'bg-[#202020] hover:bg-[#2a2a2a] focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] text-zinc-300 border border-white/5'
                            }`}
                          >
                            {cat.label}
                          </button>
                        );
                      });
                    })()}
                  </div>

                  {isTvLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
                      <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
                      <span className="text-sm font-bold">
                        Se încarcă grila TV Live HD...
                      </span>
                    </div>
                  ) : (
                    (() => {
                      const sourcePool =
                        tvCategoryId.startsWith('GRP:') &&
                        customTvChannels.length > 0
                          ? customTvChannels
                          : tvChannels;
                      const filteredTv = sourcePool.filter((c) => {
                        if (
                          !adultContentEnabled &&
                          isAdultTvChannel(c)
                        ) {
                          return false;
                        }
                        if (tvRegionId === 'ADULT' || tvCategoryId === 'ADULT') {
                          return isAdultTvChannel(c);
                        }
                        if (tvCategoryId === 'ALL') return true;
                        if (tvCategoryId.startsWith('GRP:')) {
                          const targetGrp = tvCategoryId
                            .slice(4)
                            .toLowerCase();
                          return (c.group || '').trim().toLowerCase() === targetGrp;
                        }
                        const catUpper = tvCategoryId.toUpperCase();
                        const g = (c.group || '').toLowerCase();
                        if (catUpper === 'GENERAL')
                          return (
                            g.includes('general') ||
                            g.includes('national') ||
                            g.includes('общ') ||
                            g.includes('федерал') ||
                            !c.group
                          );
                        if (catUpper === 'NEWS')
                          return (
                            g.includes('news') ||
                            g.includes('stiri') ||
                            g.includes('știr') ||
                            g.includes('инфо') ||
                            g.includes('новост')
                          );
                        if (catUpper === 'MOVIES')
                          return (
                            g.includes('movie') ||
                            g.includes('cinema') ||
                            g.includes('film') ||
                            g.includes('series') ||
                            g.includes('кино') ||
                            g.includes('сериал')
                          );
                        if (catUpper === 'SPORT' || catUpper === 'SPORTS')
                          return g.includes('sport') || g.includes('спорт');
                        if (catUpper === 'MUSIC')
                          return (
                            g.includes('music') ||
                            g.includes('muzic') ||
                            g.includes('музык')
                          );
                        if (catUpper === 'DOC' || catUpper === 'DOCUMENTARY')
                          return (
                            g.includes('doc') ||
                            g.includes('science') ||
                            g.includes('history') ||
                            g.includes('познав')
                          );
                        if (catUpper === 'KIDS')
                          return (
                            g.includes('kids') ||
                            g.includes('children') ||
                            g.includes('animation') ||
                            g.includes('детск')
                          );
                        return true;
                      });

                      if (filteredTv.length === 0) {
                        return (
                          <div className="py-16 px-6 rounded-2xl bg-zinc-900/60 border border-white/10 text-center space-y-2">
                            <div className="text-base font-extrabold text-white">
                              {tvRegionId === 'FAV'
                                ? 'Nu ai niciun canal TV adăugat la Favorite încă'
                                : 'Niciun canal TV găsit pentru această categorie'}
                            </div>
                            <p className="text-xs text-zinc-400">
                              Apasă pe inima ❤ din dreptul oricărui canal TV pentru a-l salva la Favorite.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
                          {filteredTv.map((ch) => {
                            const isFavTv = favoriteTvChannels.some(
                              (f) => f.id === ch.id
                            );
                            return (
                              <div
                                key={ch.id}
                                className="relative rounded-2xl bg-zinc-900/90 border-2 border-white/10 hover:border-amber-400 transition-all flex items-center shadow-md overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    requestTvFullscreen();
                                    playTvChannel(ch, filteredTv);
                                  }}
                                  className="flex-1 min-w-0 p-3.5 flex items-center gap-3 text-left focus:outline-none focus:bg-amber-500/20 focus:ring-4 focus:ring-inset focus:ring-white cursor-pointer"
                                >
                                  <div className="w-11 h-11 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 relative">
                                    <span className="text-[11px] font-black text-amber-400 uppercase tracking-tighter select-none">
                                      {ch.name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '').slice(0, 3) || 'TV'}
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
                                <button
                                  type="button"
                                  title={
                                    isFavTv
                                      ? 'Elimină de la Favorite'
                                      : 'Adaugă la Favorite'
                                  }
                                  onClick={() => toggleFavoriteTvChannel(ch)}
                                  className={`h-full px-3 py-3.5 flex items-center justify-center border-l border-white/10 transition-colors focus:outline-none focus:ring-4 focus:ring-inset focus:ring-white cursor-pointer ${
                                    isFavTv
                                      ? 'text-rose-500 bg-rose-500/10 hover:bg-rose-500/20'
                                      : 'text-zinc-500 hover:text-white hover:bg-white/10'
                                  }`}
                                >
                                  <Heart
                                    className={`w-4 h-4 ${
                                      isFavTv ? 'fill-rose-500' : ''
                                    }`}
                                  />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  )}
                </div>
              )}

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
                          .map((t) => t.trim())
                          .filter(Boolean)
                          .slice(0, 4)
                      : [];

                    return (
                      <div className="relative rounded-3xl bg-[#1c1c1c] border border-white/15 shadow-2xl overflow-hidden p-4 sm:p-6">
                        {/* Blurred Artwork Ambient Background */}
                        {trackInfo?.coverUrl && (
                          <img
                            src={trackInfo.coverUrl}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 w-full h-full object-cover opacity-20 blur-2xl scale-110 pointer-events-none select-none"
                          />
                        )}
                        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                          {/* Left + Center: Artwork (Cover Art / Station Logo) + Song & Station Info */}
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 min-w-0 flex-1 w-full">
                            {/* Large Artwork Box */}
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
                              title="Deschide Playerul Radio pe tot ecranul"
                              className="relative group shrink-0 rounded-2xl focus:outline-none focus:ring-4 focus:ring-white cursor-pointer"
                            >
                              {trackInfo?.coverUrl ? (
                                <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-zinc-900">
                                  <img
                                    src={trackInfo.coverUrl}
                                    alt={trackInfo.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                  <div className="absolute -bottom-1.5 -right-1.5 p-1 rounded-xl bg-[#141414] border border-white/20 shadow-lg">
                                    <StationAvatar
                                      name={activeStation.name}
                                      favicon={activeStation.favicon}
                                      homepage={activeStation.homepage}
                                      size="sm"
                                      isPlaying={isPlayingCurrent}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <StationAvatar
                                  name={activeStation.name}
                                  favicon={activeStation.favicon}
                                  homepage={activeStation.homepage}
                                  size="xl"
                                  isPlaying={isPlayingCurrent}
                                  className="!w-28 !h-28 sm:!w-36 sm:!h-36 !rounded-2xl shadow-2xl border-2 border-white/15"
                                />
                              )}
                            </button>

                            {/* Song Metadata & Station Details */}
                            <div className="min-w-0 flex-1 space-y-2.5 w-full">
                              {/* Top Status Badges */}
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
                                    isPlayingCurrent
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                      : isLoadingCurrent
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                        : 'bg-white/10 text-zinc-300 border border-white/10'
                                  }`}
                                >
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      isPlayingCurrent
                                        ? 'bg-emerald-400 animate-ping'
                                        : isLoadingCurrent
                                          ? 'bg-amber-400 animate-pulse'
                                          : 'bg-zinc-400'
                                    }`}
                                  />
                                  {isPlayingCurrent
                                    ? 'ÎN DIRECT • ON AIR'
                                    : isLoadingCurrent
                                      ? 'SE CONECTEAZĂ...'
                                      : 'PREGĂTIT DE REDARE'}
                                </span>

                                <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1">
                                  <span>
                                    {getCountryFlagEmoji(
                                      activeStation.countrycode
                                    )}
                                  </span>
                                  <span>
                                    {activeStation.country ||
                                      activeStation.countrycode}
                                  </span>
                                </span>

                                {activeStation.bitrate ? (
                                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                                    {activeStation.bitrate} kbps{' '}
                                    {activeStation.codec
                                      ? `• ${activeStation.codec.toUpperCase()}`
                                      : ''}
                                  </span>
                                ) : null}
                              </div>

                              {/* Station Name */}
                              <div>
                                <div className="text-lg sm:text-2xl font-extrabold text-white tracking-tight truncate">
                                  {activeStation.name}
                                </div>
                                {stationTags.length > 0 && (
                                  <div className="text-xs text-zinc-400 truncate mt-0.5">
                                    {stationTags.join(' • ')}
                                  </div>
                                )}
                              </div>

                              {/* Dedicated Now Playing Song Info Card (Poza artist/piesă + Titlu piesă + Artist + Album) */}
                              <div className="p-3 rounded-2xl bg-black/55 border border-white/10 flex items-center gap-3.5 max-w-2xl">
                                {trackInfo?.artistAvatarUrl ||
                                trackInfo?.coverUrl ? (
                                  <img
                                    src={
                                      trackInfo.artistAvatarUrl ||
                                      trackInfo.coverUrl
                                    }
                                    alt={trackInfo.artist || trackInfo.title}
                                    className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white/20 shadow"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                                    <Music className="w-6 h-6" />
                                  </div>
                                )}

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                                      🎵 Piesa în curs / Сейчас играет
                                    </span>
                                    {trackInfo?.album && (
                                      <span className="text-[11px] text-zinc-400 truncate inline-flex items-center gap-1">
                                        <Disc className="w-3 h-3 shrink-0" />
                                        {trackInfo.album}
                                      </span>
                                    )}
                                  </div>
                                  {trackInfo ? (
                                    <>
                                      <div className="text-sm sm:text-base font-extrabold text-white truncate mt-0.5">
                                        {trackInfo.title}
                                      </div>
                                      <div className="text-xs sm:text-sm font-semibold text-amber-300 truncate">
                                        🎤{' '}
                                        {trackInfo.artist || activeStation.name}
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="text-sm font-bold text-zinc-100 truncate mt-0.5">
                                        {currentStation?.stationuuid ===
                                          activeStation.stationuuid &&
                                        nowPlayingTitle
                                          ? nowPlayingTitle
                                          : isPlayingCurrent
                                            ? `Transmisiune Live — ${activeStation.name}`
                                            : 'Selectează Play pentru a asculta live'}
                                      </div>
                                      <div className="text-xs text-zinc-400 truncate">
                                        {activeStation.tags ||
                                          'Informațiile piesei apar automat când postul transmite titlul'}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right: Dedicated Radio Player Controls (Play/Pause, Prev/Next, Volume, Favorite, Fullscreen Player) */}
                          <div className="flex flex-col items-stretch sm:items-end gap-3 shrink-0 w-full lg:w-auto border-t lg:border-t-0 border-white/10 pt-3 lg:pt-0">
                            {/* Primary Transport Row */}
                            <div className="flex flex-wrap items-center gap-2.5">
                              <button
                                type="button"
                                onClick={playPreviousStation}
                                title="Postul anterior"
                                className="w-11 h-11 rounded-full bg-[#2b2b2b] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] focus:outline-none text-white flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <SkipBack className="w-5 h-5 fill-current" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (isPlayingCurrent) {
                                    stopRadio();
                                  } else {
                                    playStation(activeStation, radioStations);
                                  }
                                }}
                                className="h-12 px-6 rounded-full bg-gradient-to-r from-[#d4d4d4] via-[#ffffff] to-[#c8c8c8] text-[#141414] hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-white/50 font-extrabold text-sm inline-flex items-center gap-2.5 shadow-xl cursor-pointer"
                              >
                                {isLoadingCurrent ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                ) : isPlayingCurrent ? (
                                  <Pause className="w-5 h-5 fill-current" />
                                ) : (
                                  <Play className="w-5 h-5 fill-current" />
                                )}
                                <span>
                                  {isPlayingCurrent ? 'Pauză / Stop' : 'Play Live'}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={playNextAvailableStation}
                                title="Postul următor"
                                className="w-11 h-11 rounded-full bg-[#2b2b2b] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] focus:outline-none text-white flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <SkipForward className="w-5 h-5 fill-current" />
                              </button>

                              <button
                                type="button"
                                onClick={() => toggleFavorite(activeStation)}
                                title={
                                  isFavActive
                                    ? 'Elimină de la Favorite'
                                    : 'Adaugă la Favorite'
                                }
                                className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-4 focus:ring-white cursor-pointer ${
                                  isFavActive
                                    ? 'bg-rose-500 text-white'
                                    : 'bg-[#2b2b2b] text-zinc-200 hover:bg-white hover:text-[#141414]'
                                }`}
                              >
                                <Heart
                                  className={`w-5 h-5 ${
                                    isFavActive ? 'fill-current' : ''
                                  }`}
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
                                  setIsTvRadioPlayerOpen(true);
                                }}
                                title="Deschide Playerul Radio pe tot ecranul"
                                className="h-11 px-4 rounded-full bg-[#2b2b2b] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] focus:outline-none text-zinc-100 text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Maximize2 className="w-4 h-4" />
                                <span>Player Mare</span>
                              </button>
                            </div>

                            {/* Volume Control Row */}
                            <div className="flex items-center gap-2 bg-black/45 px-3 py-1.5 rounded-full border border-white/10">
                              <button
                                type="button"
                                onClick={toggleMute}
                                title={isMuted ? 'Activează sunetul' : 'Mut'}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-300 hover:text-white focus:bg-white focus:text-[#141414] focus:outline-none cursor-pointer"
                              >
                                {isMuted || volume === 0 ? (
                                  <VolumeX className="w-4 h-4 text-rose-400" />
                                ) : (
                                  <Volume2 className="w-4 h-4 text-emerald-400" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setVolume(Math.max(0, Number((volume - 0.1).toFixed(2))))
                                }
                                className="w-6 h-6 rounded-full bg-white/10 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] focus:outline-none text-xs font-bold flex items-center justify-center cursor-pointer"
                              >
                                −
                              </button>
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.02}
                                value={isMuted ? 0 : volume}
                                onChange={(e) =>
                                  setVolume(parseFloat(e.target.value))
                                }
                                aria-label="Volum Radio"
                                className="w-24 sm:w-28 accent-emerald-400 cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setVolume(Math.min(1, Number((volume + 0.1).toFixed(2))))
                                }
                                className="w-6 h-6 rounded-full bg-white/10 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] focus:outline-none text-xs font-bold flex items-center justify-center cursor-pointer"
                              >
                                +
                              </button>
                              <span className="text-[11px] font-bold text-zinc-300 w-9 text-right tabular-nums">
                                {effectiveVolPct}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {RADIO_COUNTRIES.map((rc) => {
                      const active = radioCountry === rc.code;
                      return (
                        <button
                          key={rc.code}
                          type="button"
                          onClick={() => setRadioCountry(rc.code)}
                          className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs sm:text-sm whitespace-nowrap shrink-0 transition-all focus:outline-none cursor-pointer ${
                            active
                              ? 'bg-gradient-to-r from-[#d4d4d4] via-[#ffffff] to-[#c8c8c8] text-[#141414] font-semibold shadow-md'
                              : 'bg-[#222222] hover:bg-[#2c2c2c] focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] text-zinc-300 border border-white/5'
                          }`}
                        >
                          {rc.label}
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
                  ) : radioStations.length === 0 ? (
                    <div className="py-16 px-6 rounded-2xl bg-[#202020] border border-white/10 text-center space-y-2">
                      <div className="text-base font-extrabold text-white">
                        {radioCountry === 'FAV'
                          ? 'Nu ai niciun post Radio adăugat la Favorite încă'
                          : 'Niciun post radio găsit pentru această țară'}
                      </div>
                      <p className="text-xs text-zinc-400">
                        Apasă pe inima ❤ din dreptul oricărui post radio pentru a-l salva la Favorite.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
                      {radioStations.map((st) => {
                        const isPlayingThis =
                          currentStation?.stationuuid === st.stationuuid &&
                          playerStatus === 'playing';
                        const isFavRadio = favorites.some(
                          (f) => f.stationuuid === st.stationuuid
                        );
                        return (
                          <div
                            key={st.stationuuid}
                            className={`relative rounded-2xl border-2 transition-all flex items-center shadow-md overflow-hidden ${
                              isPlayingThis
                                ? 'bg-white/15 border-white'
                                : 'bg-[#222222] border-white/10 hover:border-white/50'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => playStation(st, radioStations)}
                              className="flex-1 min-w-0 p-3.5 flex items-center gap-3 text-left focus:outline-none focus:bg-white/15 focus:ring-4 focus:ring-inset focus:ring-white cursor-pointer"
                            >
                              <StationAvatar
                                name={st.name}
                                favicon={st.favicon}
                                homepage={st.homepage}
                                size="sm"
                                isPlaying={isPlayingThis}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                                  {st.name}
                                </div>
                                <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                                  {isPlayingThis ? (
                                    <span className="text-emerald-300 font-semibold">
                                      {activeRadioTrack
                                        ? `🎵 ${
                                            activeRadioTrack.artist
                                              ? `${activeRadioTrack.artist} - ${activeRadioTrack.title}`
                                              : activeRadioTrack.title
                                          }`
                                        : '▶ Se redă acum'}
                                    </span>
                                  ) : (
                                    st.tags || 'Live Radio'
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
                              className={`h-full px-3 py-3.5 flex items-center justify-center border-l border-white/10 transition-colors focus:outline-none focus:ring-4 focus:ring-inset focus:ring-white cursor-pointer ${
                                isFavRadio
                                  ? 'text-rose-500 bg-rose-500/10 hover:bg-rose-500/20'
                                  : 'text-zinc-500 hover:text-white hover:bg-white/10'
                              }`}
                            >
                              <Heart
                                className={`w-4 h-4 ${
                                  isFavRadio ? 'fill-rose-500' : ''
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                          placeholder="Поиск / Scrie de la tastatura PC sau folosește tastatura TV de mai jos..."
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
                  </div>

                  {/* Search Results Grid (5 per row Lampa style) */}
                  {isSearchLoading ? (
                    <div className="py-12 flex items-center justify-center gap-3 text-zinc-400">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                      <span className="text-sm font-bold">Поиск / Se caută...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-x-4 gap-y-6">
                      {searchResults.map((item) => {
                        const posterUrl =
                          item.poster ||
                          `https://images.metahub.space/poster/medium/${item.id}/img`;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleOpenVod(item)}
                            className="group text-left focus:outline-none cursor-pointer"
                          >
                            <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all">
                              <img
                                src={posterUrl}
                                alt={item.name}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                              {item.imdbRating && (
                                <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs sm:text-sm font-bold tracking-tight shadow-md">
                                  {item.imdbRating}
                                </span>
                              )}
                            </div>
                            <div className="mt-2.5 px-0.5">
                              <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                {item.name}
                              </div>
                              <div className="text-xs text-zinc-400 mt-0.5">
                                {item.releaseInfo || '2026'}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 6: WATCH HISTORY ("История / Continuă vizionarea") */}
              {section === 'history' && (
                <div className="space-y-4 pb-16">
                  <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                    История просмотров / Continuă vizionarea ({historyList.length})
                  </h2>
                  {historyList.length === 0 ? (
                    <p className="text-sm text-zinc-400">
                      Nu ai niciun film sau serial început încă.
                    </p>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-x-4 gap-y-6">
                      {historyList.map((entry) => {
                        const item = entry.item;
                        const posterUrl =
                          item.poster ||
                          `https://images.metahub.space/poster/medium/${item.id}/img`;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onFocus={() => handleFocusVodItem(item)}
                            onMouseEnter={() => handleFocusVodItem(item)}
                            onClick={() => handleOpenVod(item)}
                            className="group text-left focus:outline-none cursor-pointer"
                          >
                            <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all">
                              <img
                                src={posterUrl}
                                alt={item.name}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                              <span
                                className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow ${
                                  item.type === 'series'
                                    ? 'bg-purple-600/90 text-white'
                                    : 'bg-amber-500/90 text-zinc-950'
                                }`}
                              >
                                {item.type === 'series'
                                  ? `СЕРИАЛ S${entry.season}:E${entry.episode}`
                                  : 'ФИЛЬМ'}
                              </span>
                              {item.imdbRating && (
                                <span className="absolute bottom-3.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs sm:text-sm font-bold tracking-tight shadow-md">
                                  {item.imdbRating}
                                </span>
                              )}
                              {renderPosterProgressOverlay(entry)}
                            </div>
                            <div className="mt-2.5 px-0.5">
                              <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                {item.name}
                              </div>
                              <div className="text-xs text-zinc-400 mt-0.5">
                                {item.releaseInfo || '2026'}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 7: UNIFIED SMART TV FAVORITES HUB ("Избранное") */}
              {section === 'saved' && (
                <div className="space-y-8 pb-16">
                  {/* Group 1: Favorite Movies & Series */}
                  <div className="space-y-3.5">
                    <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                      Избранное — Фильмы и Сериалы ({savedVodItems.length})
                    </h2>
                    {savedVodItems.length === 0 ? (
                      <p className="text-xs sm:text-sm text-zinc-400">
                        Niciun film sau serial salvat la Favorite încă.
                      </p>
                    ) : (
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-x-4 gap-y-6">
                        {savedVodItems.map((item) => {
                          const posterUrl =
                            item.poster ||
                            `https://images.metahub.space/poster/medium/${item.id}/img`;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleOpenVod(item)}
                              className="group text-left focus:outline-none cursor-pointer"
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
                                {item.imdbRating && (
                                  <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs sm:text-sm font-bold tracking-tight shadow-md">
                                    {item.imdbRating}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2.5 px-0.5">
                                <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                  {item.name}
                                </div>
                                <div className="text-xs text-zinc-400 mt-0.5">
                                  {item.releaseInfo || '2026'}
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
                      Избранное — ТВ Онлайн ({favoriteTvChannels.length})
                    </h2>
                    {favoriteTvChannels.length === 0 ? (
                      <p className="text-xs sm:text-sm text-zinc-400">
                        Niciun canal TV salvat la Favorite încă.
                      </p>
                    ) : (
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
                        {favoriteTvChannels.map((ch) => (
                          <div
                            key={ch.id}
                            className="relative rounded-2xl bg-[#222222] border-2 border-white/10 hover:border-white/50 transition-all flex items-center shadow-md overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                requestTvFullscreen();
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
                                  {ch.countryCode} • {ch.group || 'Live HD'}
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
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Group 3: Favorite Radio Stations */}
                  <div className="space-y-3.5 pt-4 border-t border-white/10">
                    <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                      Избранное — Радио ({favorites.length})
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
                          return (
                            <div
                              key={st.stationuuid}
                              className={`relative rounded-2xl border-2 transition-all flex items-center shadow-md overflow-hidden ${
                                isPlayingThis
                                  ? 'bg-white/15 border-white'
                                  : 'bg-[#222222] border-white/10 hover:border-white/50'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => playStation(st, favorites)}
                                className="flex-1 min-w-0 p-3.5 flex items-center gap-3 text-left focus:outline-none focus:bg-white/15 focus:ring-4 focus:ring-inset focus:ring-white cursor-pointer"
                              >
                                <StationAvatar
                                  name={st.name}
                                  favicon={st.favicon}
                                  homepage={st.homepage}
                                  size="sm"
                                  isPlaying={isPlayingThis}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                                    {st.name}
                                  </div>
                                  <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                                    {isPlayingThis ? (
                                      <span className="text-emerald-300 font-semibold">
                                        {activeRadioTrack
                                          ? `🎵 ${
                                              activeRadioTrack.artist
                                                ? `${activeRadioTrack.artist} - ${activeRadioTrack.title}`
                                                : activeRadioTrack.title
                                            }`
                                          : '▶ Se redă acum'}
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
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
        </div>
      </div>

      {/* LAMPA RIGHT-HAND SLIDE-OVER "Фильтр" DRAWER (100% Identical to Lampa Filter Screenshots) */}
      {isFilterDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => {
            if (filterSubMenu) {
              setFilterSubMenu(null);
            } else {
              setIsFilterDrawerOpen(false);
            }
          }}
        >
          <div
            className="w-80 sm:w-[370px] h-full bg-[#212121] text-zinc-100 shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {filterSubMenu === null ? (
              <>
                <div className="px-7 py-6 flex items-center justify-between">
                  <h2 className="text-[26px] font-normal text-white tracking-tight">
                    Фильтр
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsFilterDrawerOpen(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03]">
                  {/* 1. Начать поиск */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsFilterDrawerOpen(false);
                      setSection('filter');
                      setVodPage(1);
                      void fetchVodCatalog(1, false);
                    }}
                    className="w-full px-7 py-4 text-left bg-[#2b2b2b] hover:bg-[#343434] focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] transition-colors cursor-pointer"
                  >
                    <div className="text-[17px] font-normal">Начать поиск</div>
                  </button>

                  {/* 2. Тип */}
                  <button
                    type="button"
                    onClick={() => setFilterSubMenu('type')}
                    className="w-full px-7 py-4 text-left hover:bg-[#2e2e2e] focus:bg-[#2e2e2e] transition-colors cursor-pointer"
                  >
                    <div className="text-[17px] font-normal text-white">
                      Тип
                    </div>
                    <div className="text-[13px] text-zinc-400 mt-0.5">
                      {filterMediaType === 'series' ? 'Сериалы' : 'Фильмы'}
                    </div>
                  </button>

                  {/* 3. Рейтинг */}
                  <button
                    type="button"
                    onClick={() => setFilterSubMenu('rating')}
                    className="w-full px-7 py-4 text-left hover:bg-[#2e2e2e] focus:bg-[#2e2e2e] transition-colors cursor-pointer"
                  >
                    <div className="text-[17px] font-normal text-white">
                      Рейтинг
                    </div>
                    <div className="text-[13px] text-zinc-400 mt-0.5">
                      {LAMPA_FILTER_RATINGS.find((r) => r.id === filterRating)
                        ?.label || 'Не выбрано'}
                    </div>
                  </button>

                  {/* 4. Жанр */}
                  <button
                    type="button"
                    onClick={() => setFilterSubMenu('genre')}
                    className="w-full px-7 py-4 text-left hover:bg-[#2e2e2e] focus:bg-[#2e2e2e] transition-colors cursor-pointer"
                  >
                    <div className="text-[17px] font-normal text-white">
                      Жанр
                    </div>
                    <div className="text-[13px] text-zinc-400 mt-0.5">
                      {TV_GENRE_PILLS.find((g) => g.id === selectedGenre)
                        ?.label || 'Не выбрано'}
                    </div>
                  </button>

                  {/* 5. Язык оригинала */}
                  <button
                    type="button"
                    onClick={() => setFilterSubMenu('lang')}
                    className="w-full px-7 py-4 text-left hover:bg-[#2e2e2e] focus:bg-[#2e2e2e] transition-colors cursor-pointer"
                  >
                    <div className="text-[17px] font-normal text-white">
                      Язык оригинала
                    </div>
                    <div className="text-[13px] text-zinc-400 mt-0.5">
                      {TV_ORIGIN_COUNTRIES.find((c) => c.id === originCountry)
                        ?.label || 'Не выбрано'}
                    </div>
                  </button>

                  {/* 6. Год */}
                  <button
                    type="button"
                    onClick={() => setFilterSubMenu('year')}
                    className="w-full px-7 py-4 text-left hover:bg-[#2e2e2e] focus:bg-[#2e2e2e] transition-colors cursor-pointer"
                  >
                    <div className="text-[17px] font-normal text-white">
                      Год
                    </div>
                    <div className="text-[13px] text-zinc-400 mt-0.5">
                      {LAMPA_FILTER_YEARS.find((y) => y.id === filterYear)
                        ?.label || 'Не выбрано'}
                    </div>
                  </button>

                  {/* 7. Сбросить фильтр */}
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMediaType('movie');
                      setFilterRating('any');
                      setSelectedGenre('top');
                      setOriginCountry('ALL');
                      setFilterYear('any');
                    }}
                    className="w-full px-7 py-4 text-left text-zinc-400 hover:text-white hover:bg-[#2e2e2e] focus:bg-[#2e2e2e] transition-colors cursor-pointer"
                  >
                    <div className="text-[15px] font-normal">
                      Сбросить фильтр
                    </div>
                  </button>
                </div>
              </>
            ) : (
              /* SUB-MENU WITH CHECKBOXES ON THE RIGHT (Язык оригинала / Жанр / Тип / Рейтинг / Год) */
              <>
                <div className="px-7 py-6 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setFilterSubMenu(null)}
                    className="inline-flex items-center gap-2 text-left text-white hover:text-zinc-300 cursor-pointer"
                  >
                    <ChevronLeft className="w-6 h-6" />
                    <span className="text-[24px] font-normal tracking-tight">
                      {filterSubMenu === 'lang'
                        ? 'Язык оригинала'
                        : filterSubMenu === 'genre'
                          ? 'Жанр'
                          : filterSubMenu === 'rating'
                            ? 'Рейтинг'
                            : filterSubMenu === 'year'
                              ? 'Год'
                              : 'Тип'}
                    </span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {filterSubMenu === 'type' &&
                    (
                      [
                        { id: 'movie', label: 'Фильмы' },
                        { id: 'series', label: 'Сериалы' },
                      ] as const
                    ).map((opt) => {
                      const checked = filterMediaType === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setFilterMediaType(opt.id);
                            setFilterSubMenu(null);
                          }}
                          className={`w-full px-7 py-4 flex items-center justify-between text-left transition-colors cursor-pointer ${
                            checked
                              ? 'bg-[#2e2e2e]'
                              : 'hover:bg-[#2e2e2e] focus:bg-[#2e2e2e]'
                          }`}
                        >
                          <span className="text-[16px] text-white font-normal">
                            {opt.label}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center ${
                              checked
                                ? 'border-white bg-white text-[#212121]'
                                : 'border-zinc-500'
                            }`}
                          >
                            {checked && (
                              <span className="text-xs font-black">✓</span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                  {filterSubMenu === 'lang' &&
                    TV_ORIGIN_COUNTRIES.map((opt) => {
                      const checked = originCountry === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setOriginCountry(opt.id);
                            setFilterSubMenu(null);
                          }}
                          className={`w-full px-7 py-4 flex items-center justify-between text-left transition-colors cursor-pointer ${
                            checked
                              ? 'bg-[#2e2e2e]'
                              : 'hover:bg-[#2e2e2e] focus:bg-[#2e2e2e]'
                          }`}
                        >
                          <span className="text-[16px] text-white font-normal">
                            {opt.label}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center ${
                              checked
                                ? 'border-white bg-white text-[#212121]'
                                : 'border-zinc-500'
                            }`}
                          >
                            {checked && (
                              <span className="text-xs font-black">✓</span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                  {filterSubMenu === 'genre' &&
                    TV_GENRE_PILLS.filter(
                      (opt) => adultContentEnabled || opt.id !== 'Adult'
                    ).map((opt) => {
                      const checked = selectedGenre === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSelectedGenre(opt.id);
                            setFilterSubMenu(null);
                          }}
                          className={`w-full px-7 py-4 flex items-center justify-between text-left transition-colors cursor-pointer ${
                            checked
                              ? 'bg-[#2e2e2e]'
                              : 'hover:bg-[#2e2e2e] focus:bg-[#2e2e2e]'
                          }`}
                        >
                          <span className="text-[16px] text-white font-normal">
                            {opt.label}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center ${
                              checked
                                ? 'border-white bg-white text-[#212121]'
                                : 'border-zinc-500'
                            }`}
                          >
                            {checked && (
                              <span className="text-xs font-black">✓</span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                  {filterSubMenu === 'rating' &&
                    LAMPA_FILTER_RATINGS.map((opt) => {
                      const checked = filterRating === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setFilterRating(opt.id);
                            setFilterSubMenu(null);
                          }}
                          className={`w-full px-7 py-4 flex items-center justify-between text-left transition-colors cursor-pointer ${
                            checked
                              ? 'bg-[#2e2e2e]'
                              : 'hover:bg-[#2e2e2e] focus:bg-[#2e2e2e]'
                          }`}
                        >
                          <span className="text-[16px] text-white font-normal">
                            {opt.label}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center ${
                              checked
                                ? 'border-white bg-white text-[#212121]'
                                : 'border-zinc-500'
                            }`}
                          >
                            {checked && (
                              <span className="text-xs font-black">✓</span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                  {filterSubMenu === 'year' &&
                    LAMPA_FILTER_YEARS.map((opt) => {
                      const checked = filterYear === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setFilterYear(opt.id);
                            setFilterSubMenu(null);
                          }}
                          className={`w-full px-7 py-4 flex items-center justify-between text-left transition-colors cursor-pointer ${
                            checked
                              ? 'bg-[#2e2e2e]'
                              : 'hover:bg-[#2e2e2e] focus:bg-[#2e2e2e]'
                          }`}
                        >
                          <span className="text-[16px] text-white font-normal">
                            {opt.label}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center ${
                              checked
                                ? 'border-white bg-white text-[#212121]'
                                : 'border-zinc-500'
                            }`}
                          >
                            {checked && (
                              <span className="text-xs font-black">✓</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* LAMPA RIGHT-HAND SLIDE-OVER "Каталог" DRAWER */}
      {isCatalogDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => setIsCatalogDrawerOpen(false)}
        >
          <div
            className="w-80 sm:w-[370px] h-full bg-[#212121] text-zinc-100 shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-7 py-6 flex items-center justify-between">
              <h2 className="text-[26px] font-normal text-white tracking-tight">
                Каталог
              </h2>
              <button
                type="button"
                onClick={() => setIsCatalogDrawerOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {TV_GENRE_PILLS.filter(
                (g) => g.id !== 'top' && (adultContentEnabled || g.id !== 'Adult')
              ).map((g) => {
                const active =
                  section === 'catalog' && selectedGenre === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setOriginCountry('ALL');
                      setSelectedGenre(g.id);
                      setSection('catalog');
                      setIsCatalogDrawerOpen(false);
                    }}
                    className={`w-full px-7 py-4 text-left text-[16px] font-normal transition-colors cursor-pointer ${
                      active
                        ? 'bg-gradient-to-r from-[#d4d4d4] via-[#ffffff] to-[#c8c8c8] text-[#141414] font-medium'
                        : 'text-white hover:bg-[#2e2e2e] focus:bg-[#2e2e2e]'
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* LAMPA RIGHT-HAND SLIDE-OVER "Настройки / Setări Smart TV" DRAWER */}
      {isSettingsDrawerOpen && (
        <div
          className="fixed inset-0 z-[150] flex justify-end bg-black/55 backdrop-blur-[2px]"
          onClick={() => {
            if (settingsSubMenu) {
              setSettingsSubMenu(null);
            } else {
              setIsSettingsDrawerOpen(false);
            }
          }}
        >
          <div
            className="w-80 sm:w-[410px] h-full bg-[#212121] text-zinc-100 shadow-2xl flex flex-col overflow-hidden border-l border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {settingsSubMenu === null ? (
              <>
                <div className="px-7 py-6 flex items-center justify-between border-b border-white/[0.06]">
                  <div>
                    <h2 className="text-[25px] font-normal text-white tracking-tight">
                      Настройки
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Setări implicite Player & Smart TV
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSettingsDrawerOpen(false)}
                    title="Închide (Esc)"
                    className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 focus:bg-white focus:text-[#141414] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
                  {/* 1. Pistă Audio Implicită (Limbă Originală / Dublaj) */}
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setSettingsSubMenu('audio')}
                    className="w-full px-7 py-4 text-left hover:bg-[#2e2e2e] focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] group transition-colors cursor-pointer"
                  >
                    <div className="text-[16px] font-medium text-white group-focus:text-[#141414]">
                      Аудиодорожка по умолчанию / Limbă Audio Implicită
                    </div>
                    <div className="text-[13px] text-amber-400 group-focus:text-zinc-800 mt-0.5 font-medium">
                      {SMART_TV_AUDIO_OPTIONS.find(
                        (o) => o.id === tvSettings.defaultAudioPref
                      )?.label || 'Limba Originală'}
                    </div>
                  </button>

                  {/* 2. Subtitrare Automată Implicită (RO / RU / EN / Oprit) */}
                  <button
                    type="button"
                    onClick={() => setSettingsSubMenu('subtitles')}
                    className="w-full px-7 py-4 text-left hover:bg-[#2e2e2e] focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] group transition-colors cursor-pointer"
                  >
                    <div className="text-[16px] font-medium text-white group-focus:text-[#141414]">
                      Субтитры по умолчанию / Subtitrare Automată
                    </div>
                    <div className="text-[13px] text-emerald-400 group-focus:text-zinc-800 mt-0.5 font-medium">
                      {SMART_TV_SUB_LANG_OPTIONS.find(
                        (o) => o.id === tvSettings.defaultSubLang
                      )?.label || '🇷🇴 Română'}
                    </div>
                  </button>

                  {/* 3. Mărime Font Subtitrare TV */}
                  <button
                    type="button"
                    onClick={() => setSettingsSubMenu('subSize')}
                    className="w-full px-7 py-4 text-left hover:bg-[#2e2e2e] focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] group transition-colors cursor-pointer"
                  >
                    <div className="text-[16px] font-medium text-white group-focus:text-[#141414]">
                      Размер субтитров / Mărime Font Subtitrare
                    </div>
                    <div className="text-[13px] text-zinc-400 group-focus:text-zinc-800 mt-0.5">
                      {SMART_TV_SUB_SIZE_OPTIONS.find(
                        (o) => o.id === tvSettings.defaultSubFontSize
                      )?.label || 'Mare — Smart TV (125%)'}
                    </div>
                  </button>

                  {/* 4. Calitate Video Implicită (4K / 1080p / 720p / 480p / Auto) */}
                  <button
                    type="button"
                    onClick={() => setSettingsSubMenu('quality')}
                    className="w-full px-7 py-4 text-left hover:bg-[#2e2e2e] focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] group transition-colors cursor-pointer"
                  >
                    <div className="text-[16px] font-medium text-white group-focus:text-[#141414]">
                      Качество видео / Calitate Video Implicită
                    </div>
                    <div className="text-[13px] text-amber-400 group-focus:text-zinc-800 mt-0.5 font-medium">
                      {SMART_TV_QUALITY_OPTIONS.find(
                        (o) => o.id === tvSettings.defaultVideoQuality
                      )?.label || '★ Maximă Disponibilă (4K / 1080p)'}
                    </div>
                  </button>

                  {/* 5. Server / Sursă Video Implicită */}
                  <button
                    type="button"
                    onClick={() => setSettingsSubMenu('server')}
                    className="w-full px-7 py-4 text-left hover:bg-[#2e2e2e] focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] group transition-colors cursor-pointer"
                  >
                    <div className="text-[16px] font-medium text-white group-focus:text-[#141414]">
                      Источник видео / Sursă Video Implicită
                    </div>
                    <div className="text-[13px] text-zinc-400 group-focus:text-zinc-800 mt-0.5">
                      {SMART_TV_SERVER_OPTIONS.find(
                        (o) => o.id === tvSettings.defaultVodServer
                      )?.label || '★ Automat — Cea mai bună calitate'}
                    </div>
                  </button>

                  {/* 6. Ascundere Automată OSD & Info în Player */}
                  <button
                    type="button"
                    onClick={() => setSettingsSubMenu('osd')}
                    className="w-full px-7 py-4 text-left hover:bg-[#2e2e2e] focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] group transition-colors cursor-pointer"
                  >
                    <div className="text-[16px] font-medium text-white group-focus:text-[#141414]">
                      Автоскрытие интерфейса / Ascundere Controale Player
                    </div>
                    <div className="text-[13px] text-zinc-400 group-focus:text-zinc-800 mt-0.5">
                      {SMART_TV_OSD_OPTIONS.find(
                        (o) => o.id === tvSettings.osdAutoHideSec
                      )?.label || 'După 4 secunde'}
                    </div>
                  </button>

                  {/* 7. Toggle Ecran Complet Automat la Play */}
                  <button
                    type="button"
                    onClick={() =>
                      updateTvSetting(
                        'autoFullscreenOnPlay',
                        !tvSettings.autoFullscreenOnPlay
                      )
                    }
                    className="w-full px-7 py-4 flex items-center justify-between text-left hover:bg-[#2e2e2e] focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] group transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="text-[16px] font-medium text-white group-focus:text-[#141414]">
                        Полный экран при запуске / Fullscreen Automat
                      </div>
                      <div className="text-[13px] text-zinc-400 group-focus:text-zinc-800 mt-0.5">
                        {tvSettings.autoFullscreenOnPlay
                          ? 'Activat — intră automat în Fullscreen la Play'
                          : 'Dezactivat — păstrează fereastra curentă'}
                      </div>
                    </div>
                    <span
                      className={`w-6 h-6 rounded-[5px] border-2 flex items-center justify-center shrink-0 ${
                        tvSettings.autoFullscreenOnPlay
                          ? 'border-emerald-400 bg-emerald-400 text-[#141414]'
                          : 'border-zinc-500'
                      }`}
                    >
                      {tvSettings.autoFullscreenOnPlay && (
                        <span className="text-xs font-black">✓</span>
                      )}
                    </span>
                  </button>

                  {/* 8. Conținut pentru Adulți (18+ / Для взрослых — iEdem & TV): ON / OFF */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !adultContentEnabled;
                      setAdultContentEnabled(next);
                      if (!next) {
                        if (tvRegionId === 'ADULT') setTvRegionId('RO');
                        if (tvCategoryId === 'ADULT') setTvCategoryId('ALL');
                        if (selectedGenre === 'Adult') setSelectedGenre('top');
                      }
                    }}
                    className="w-full px-7 py-4 flex items-center justify-between gap-3 text-left hover:bg-[#2e2e2e] focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] group transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-[16px] font-medium text-white group-focus:text-[#141414] flex items-center gap-2">
                        <span>🔞 Контент 18+ / Conținut pentru Adulți</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wider ${
                            adultContentEnabled
                              ? 'bg-rose-500 text-white'
                              : 'bg-zinc-700 text-zinc-300'
                          }`}
                        >
                          {adultContentEnabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <div className="text-[13px] text-zinc-400 group-focus:text-zinc-800 mt-0.5">
                        {adultContentEnabled
                          ? 'ON (Pornit) — Categoria «Для взрослых / 18+» (iEdem & TV) este vizibilă'
                          : 'OFF (Oprit) — Toate canalele și filmele 18+ sunt ascunse'}
                      </div>
                    </div>
                    <span
                      className={`w-6 h-6 rounded-[5px] border-2 flex items-center justify-center shrink-0 ${
                        adultContentEnabled
                          ? 'border-rose-500 bg-rose-500 text-white'
                          : 'border-zinc-500'
                      }`}
                    >
                      {adultContentEnabled && (
                        <span className="text-xs font-black">✓</span>
                      )}
                    </span>
                  </button>

                  {/* 8. Șterge Istoricul de Vizionare */}
                  <button
                    type="button"
                    onClick={() => {
                      setWatchProgressMap({});
                      saveWatchProgressMap({});
                    }}
                    className="w-full px-7 py-4 text-left hover:bg-[#2e2e2e] focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] group transition-colors cursor-pointer"
                  >
                    <div className="text-[15px] font-normal text-zinc-300 group-focus:text-[#141414]">
                      🗑 Очистить историю просмотров / Șterge Istoricul ({historyList.length})
                    </div>
                  </button>

                  {/* 9. Resetează Setările Smart TV la valorile din fabrică */}
                  <button
                    type="button"
                    onClick={() => {
                      setTvSettings(DEFAULT_SMART_TV_SETTINGS);
                      saveSmartTvSettings(DEFAULT_SMART_TV_SETTINGS);
                      setPreferredSubLang('ro');
                    }}
                    className="w-full px-7 py-4 text-left hover:bg-[#2e2e2e] focus:bg-gradient-to-r focus:from-[#d4d4d4] focus:via-[#ffffff] focus:to-[#c8c8c8] focus:text-[#141414] group transition-colors cursor-pointer"
                  >
                    <div className="text-[15px] font-normal text-zinc-300 group-focus:text-[#141414]">
                      ↺ Сбросить настройки / Resetează la Setările Implicite
                    </div>
                  </button>

                  {/* 10. Comută în Modul Web Normal */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsDrawerOpen(false);
                      onExitTvMode();
                    }}
                    className="w-full px-7 py-4 text-left hover:bg-rose-500/20 focus:bg-rose-500 focus:text-white transition-colors cursor-pointer"
                  >
                    <div className="text-[15px] font-medium text-rose-400">
                      ← Ieșire în Modul Web Normal (AetherRadio)
                    </div>
                  </button>
                </div>
              </>
            ) : (
              /* SUB-MENUS FOR SMART TV SETTINGS */
              <>
                <div className="px-7 py-6 flex items-center justify-between border-b border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setSettingsSubMenu(null)}
                    className="inline-flex items-center gap-2 text-left text-white hover:text-zinc-300 cursor-pointer"
                  >
                    <ChevronLeft className="w-6 h-6" />
                    <span className="text-[22px] font-normal tracking-tight">
                      {settingsSubMenu === 'audio'
                        ? 'Limbă Audio Implicită'
                        : settingsSubMenu === 'subtitles'
                          ? 'Subtitrare Automată'
                          : settingsSubMenu === 'subSize'
                            ? 'Mărime Font Subtitrare'
                            : settingsSubMenu === 'quality'
                              ? 'Calitate Video Implicită'
                              : settingsSubMenu === 'server'
                                ? 'Sursă Video Implicită'
                                : 'Ascundere Controale'}
                    </span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
                  {settingsSubMenu === 'audio' &&
                    SMART_TV_AUDIO_OPTIONS.map((opt) => {
                      const checked = tvSettings.defaultAudioPref === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            updateTvSetting('defaultAudioPref', opt.id);
                            if (resolvedDirectStream?.audioNames?.length) {
                              const nextIdx = resolveAudioTrackIndexByPreference(
                                resolvedDirectStream.audioNames,
                                opt.id
                              );
                              setSelectedAudioTrackIdx(nextIdx);
                            }
                            setSettingsSubMenu(null);
                          }}
                          className={`w-full px-7 py-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                            checked
                              ? 'bg-[#2e2e2e]'
                              : 'hover:bg-[#2e2e2e] focus:bg-[#2e2e2e]'
                          }`}
                        >
                          <div>
                            <div className="text-[15px] text-white font-medium">
                              {opt.label}
                            </div>
                            <div className="text-[12px] text-zinc-400 mt-0.5">
                              {opt.desc}
                            </div>
                          </div>
                          <span
                            className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 ${
                              checked
                                ? 'border-white bg-white text-[#212121]'
                                : 'border-zinc-500'
                            }`}
                          >
                            {checked && (
                              <span className="text-xs font-black">✓</span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                  {settingsSubMenu === 'subtitles' &&
                    SMART_TV_SUB_LANG_OPTIONS.map((opt) => {
                      const checked = tvSettings.defaultSubLang === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            updateTvSetting('defaultSubLang', opt.id);
                            if (opt.id === 'off') {
                              setActiveSubVttUrl(null);
                              setActiveSubLabel('');
                              setActiveSubCues([]);
                            } else {
                              setPreferredSubLang(opt.id);
                              if (activeVodItem) {
                                void handleQuickSubLangSwitch(opt.id);
                              }
                            }
                            setSettingsSubMenu(null);
                          }}
                          className={`w-full px-7 py-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                            checked
                              ? 'bg-[#2e2e2e]'
                              : 'hover:bg-[#2e2e2e] focus:bg-[#2e2e2e]'
                          }`}
                        >
                          <div>
                            <div className="text-[15px] text-white font-medium">
                              {opt.label}
                            </div>
                            <div className="text-[12px] text-zinc-400 mt-0.5">
                              {opt.desc}
                            </div>
                          </div>
                          <span
                            className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 ${
                              checked
                                ? 'border-white bg-white text-[#212121]'
                                : 'border-zinc-500'
                            }`}
                          >
                            {checked && (
                              <span className="text-xs font-black">✓</span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                  {settingsSubMenu === 'subSize' &&
                    SMART_TV_SUB_SIZE_OPTIONS.map((opt) => {
                      const checked = tvSettings.defaultSubFontSize === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            updateTvSetting('defaultSubFontSize', opt.id);
                            setSettingsSubMenu(null);
                          }}
                          className={`w-full px-7 py-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                            checked
                              ? 'bg-[#2e2e2e]'
                              : 'hover:bg-[#2e2e2e] focus:bg-[#2e2e2e]'
                          }`}
                        >
                          <span className="text-[16px] text-white font-normal">
                            {opt.label}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 ${
                              checked
                                ? 'border-white bg-white text-[#212121]'
                                : 'border-zinc-500'
                            }`}
                          >
                            {checked && (
                              <span className="text-xs font-black">✓</span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                  {settingsSubMenu === 'quality' &&
                    SMART_TV_QUALITY_OPTIONS.map((opt) => {
                      const checked = tvSettings.defaultVideoQuality === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            updateTvSetting('defaultVideoQuality', opt.id);
                            setSettingsSubMenu(null);
                          }}
                          className={`w-full px-7 py-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                            checked
                              ? 'bg-[#2e2e2e]'
                              : 'hover:bg-[#2e2e2e] focus:bg-[#2e2e2e]'
                          }`}
                        >
                          <div>
                            <div className="text-[15px] text-white font-medium">
                              {opt.label}
                            </div>
                            <div className="text-[12px] text-zinc-400 mt-0.5">
                              {opt.desc}
                            </div>
                          </div>
                          <span
                            className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 ${
                              checked
                                ? 'border-white bg-white text-[#212121]'
                                : 'border-zinc-500'
                            }`}
                          >
                            {checked && (
                              <span className="text-xs font-black">✓</span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                  {settingsSubMenu === 'server' &&
                    SMART_TV_SERVER_OPTIONS.map((opt) => {
                      const checked = tvSettings.defaultVodServer === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            updateTvSetting('defaultVodServer', opt.id);
                            if (opt.id !== 'auto_best') {
                              setActiveServer(opt.id);
                            } else if (
                              resolvedDirectStream?.ok &&
                              (resolvedDirectStream.dashUrl ||
                                resolvedDirectStream.hlsUrl)
                            ) {
                              setActiveServer('kinogram_hls');
                            } else if (activeVodItem) {
                              setActiveServer('vidspark');
                            }
                            setSettingsSubMenu(null);
                          }}
                          className={`w-full px-7 py-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                            checked
                              ? 'bg-[#2e2e2e]'
                              : 'hover:bg-[#2e2e2e] focus:bg-[#2e2e2e]'
                          }`}
                        >
                          <div>
                            <div className="text-[15px] text-white font-medium">
                              {opt.label}
                            </div>
                            <div className="text-[12px] text-zinc-400 mt-0.5">
                              {opt.desc}
                            </div>
                          </div>
                          <span
                            className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 ${
                              checked
                                ? 'border-white bg-white text-[#212121]'
                                : 'border-zinc-500'
                            }`}
                          >
                            {checked && (
                              <span className="text-xs font-black">✓</span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                  {settingsSubMenu === 'osd' &&
                    SMART_TV_OSD_OPTIONS.map((opt) => {
                      const checked = tvSettings.osdAutoHideSec === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            updateTvSetting('osdAutoHideSec', opt.id);
                            setSettingsSubMenu(null);
                          }}
                          className={`w-full px-7 py-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                            checked
                              ? 'bg-[#2e2e2e]'
                              : 'hover:bg-[#2e2e2e] focus:bg-[#2e2e2e]'
                          }`}
                        >
                          <span className="text-[16px] text-white font-normal">
                            {opt.label}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 ${
                              checked
                                ? 'border-white bg-white text-[#212121]'
                                : 'border-zinc-500'
                            }`}
                          >
                            {checked && (
                              <span className="text-xs font-black">✓</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* DEDICATED FULLSCREEN SMART TV RADIO PLAYER MODAL ("Плеер Радио — Cu Poză & Info Piesă") */}
      {isTvRadioPlayerOpen && currentStation && (
        <div
          className="fixed inset-0 z-[125] bg-[#101010]/95 backdrop-blur-2xl flex flex-col justify-between p-5 sm:p-10 overflow-y-auto"
          onClick={() => setIsTvRadioPlayerOpen(false)}
        >
          {/* Ambient Blurred Cover Art Background */}
          {activeRadioTrack?.coverUrl && (
            <img
              src={activeRadioTrack.coverUrl}
              alt=""
              aria-hidden="true"
              className="fixed inset-0 w-full h-full object-cover opacity-25 blur-3xl scale-110 pointer-events-none select-none"
            />
          )}

          {/* Top Bar */}
          <div
            className="relative z-10 flex items-center justify-between gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              autoFocus
              onClick={() => setIsTvRadioPlayerOpen(false)}
              className="h-11 px-5 rounded-full bg-white text-[#141414] hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-white/50 font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 shadow-xl cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Назад / Înapoi la Радио</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    playerStatus === 'playing'
                      ? 'bg-emerald-400 animate-ping'
                      : 'bg-amber-400'
                  }`}
                />
                {playerStatus === 'playing'
                  ? 'РАДИО В ЭФИРЕ • ÎN DIRECT'
                  : playerStatus === 'loading'
                    ? 'SE CONECTEAZĂ...'
                    : 'PAUZĂ'}
              </span>
            </div>
          </div>

          {/* Center Hero: Giant Cover Art + Station Logo + Track Metadata + Controls */}
          <div
            className="relative z-10 my-auto py-6 max-w-5xl w-full mx-auto flex flex-col md:flex-row items-center gap-8 sm:gap-12"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Giant Artwork Box */}
            <div className="relative shrink-0">
              {activeRadioTrack?.coverUrl ? (
                <div className="relative w-52 h-52 sm:w-72 sm:h-72 rounded-3xl overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.85)] border-2 border-white/20 bg-zinc-900">
                  <img
                    src={activeRadioTrack.coverUrl}
                    alt={activeRadioTrack.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute -bottom-2 -right-2 p-1.5 rounded-2xl bg-[#141414] border border-white/20 shadow-2xl">
                    <StationAvatar
                      name={currentStation.name}
                      favicon={currentStation.favicon}
                      homepage={currentStation.homepage}
                      size="md"
                      isPlaying={playerStatus === 'playing'}
                    />
                  </div>
                </div>
              ) : (
                <StationAvatar
                  name={currentStation.name}
                  favicon={currentStation.favicon}
                  homepage={currentStation.homepage}
                  size="xl"
                  isPlaying={playerStatus === 'playing'}
                  className="!w-52 !h-52 sm:!w-72 sm:!h-72 !rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] border-2 border-white/20"
                />
              )}
            </div>

            {/* Right: Station & Live Song Info + Full Player Controls */}
            <div className="flex-1 min-w-0 text-center md:text-left space-y-5 w-full">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className="px-3 py-1 rounded-full bg-white/10 text-zinc-200 text-xs font-bold inline-flex items-center gap-1.5">
                  <span>{getCountryFlagEmoji(currentStation.countrycode)}</span>
                  <span>
                    {currentStation.country || currentStation.countrycode}
                  </span>
                </span>
                {currentStation.bitrate ? (
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
                    {currentStation.bitrate} kbps{' '}
                    {currentStation.codec
                      ? `• ${currentStation.codec.toUpperCase()}`
                      : ''}
                  </span>
                ) : null}
              </div>

              <div>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                  {currentStation.name}
                </h2>
                {currentStation.tags && (
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                    {currentStation.tags
                      .split(',')
                      .slice(0, 5)
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .join(' • ')}
                  </p>
                )}
              </div>

              {/* Song Info Box */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white/[0.07] border border-white/15 flex items-center gap-4 text-left shadow-xl">
                {activeRadioTrack?.artistAvatarUrl ||
                activeRadioTrack?.coverUrl ? (
                  <img
                    src={
                      activeRadioTrack.artistAvatarUrl ||
                      activeRadioTrack.coverUrl
                    }
                    alt={activeRadioTrack.artist || activeRadioTrack.title}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shrink-0 border border-white/20 shadow-lg"
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Music className="w-8 h-8" />
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider">
                      🎵 Acum pe post / Сейчас играет
                    </span>
                    {activeRadioTrack?.album && (
                      <span className="text-xs text-zinc-300 truncate inline-flex items-center gap-1">
                        <Disc className="w-3.5 h-3.5 shrink-0" />
                        {activeRadioTrack.album}
                      </span>
                    )}
                  </div>
                  {activeRadioTrack ? (
                    <>
                      <div className="text-lg sm:text-2xl font-extrabold text-white truncate">
                        {activeRadioTrack.title}
                      </div>
                      <div className="text-sm sm:text-base font-bold text-amber-300 truncate">
                        🎤 {activeRadioTrack.artist || currentStation.name}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-base sm:text-xl font-bold text-white truncate">
                        {nowPlayingTitle ||
                          `Transmisiune Live — ${currentStation.name}`}
                      </div>
                      <div className="text-xs sm:text-sm text-zinc-400 truncate">
                        {currentStation.tags || 'Flux audio în direct'}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Transport & Volume Controls */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1">
                <button
                  type="button"
                  onClick={playPreviousStation}
                  className="h-12 px-5 rounded-full bg-[#262626] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] focus:outline-none text-white font-bold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <SkipBack className="w-5 h-5 fill-current" />
                  <span>Anterior</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (playerStatus === 'playing') {
                      stopRadio();
                    } else {
                      playStation(currentStation, radioStations);
                    }
                  }}
                  className="h-14 px-8 rounded-full bg-gradient-to-r from-[#d4d4d4] via-[#ffffff] to-[#c8c8c8] text-[#141414] hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-white/60 font-extrabold text-base inline-flex items-center gap-3 shadow-2xl cursor-pointer"
                >
                  {playerStatus === 'loading' ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : playerStatus === 'playing' ? (
                    <Pause className="w-6 h-6 fill-current" />
                  ) : (
                    <Play className="w-6 h-6 fill-current" />
                  )}
                  <span>
                    {playerStatus === 'playing' ? 'Pauză / Stop' : 'Play Live'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={playNextAvailableStation}
                  className="h-12 px-5 rounded-full bg-[#262626] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] focus:outline-none text-white font-bold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Următorul</span>
                  <SkipForward className="w-5 h-5 fill-current" />
                </button>

                <button
                  type="button"
                  onClick={() => triggerStreamReload()}
                  title="Reîncarcă fluxul audio"
                  className="w-12 h-12 rounded-full bg-[#262626] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] focus:outline-none text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => toggleFavorite(currentStation)}
                  className={`h-12 px-5 rounded-full font-bold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors focus:outline-none focus:ring-4 focus:ring-white cursor-pointer ${
                    favorites.some(
                      (f) => f.stationuuid === currentStation.stationuuid
                    )
                      ? 'bg-rose-500 text-white'
                      : 'bg-[#262626] text-zinc-200 hover:bg-white hover:text-[#141414]'
                  }`}
                >
                  <Heart
                    className={`w-5 h-5 ${
                      favorites.some(
                        (f) => f.stationuuid === currentStation.stationuuid
                      )
                        ? 'fill-current'
                        : ''
                    }`}
                  />
                  <span>Favorite</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Quick Station Switcher Strip */}
          <div
            className="relative z-10 pt-4 border-t border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
              Schimbă rapid postul radio ({ (radioStations.length > 0 ? radioStations : favorites).length })
            </div>
            <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
              {(radioStations.length > 0 ? radioStations : favorites)
                .slice(0, 20)
                .map((st) => {
                  const active = currentStation.stationuuid === st.stationuuid;
                  return (
                    <button
                      key={`modal_st_${st.stationuuid}`}
                      type="button"
                      onClick={() =>
                        playStation(
                          st,
                          radioStations.length > 0 ? radioStations : favorites
                        )
                      }
                      className={`px-3.5 py-2 rounded-2xl border flex items-center gap-2.5 shrink-0 transition-all focus:outline-none focus:ring-4 focus:ring-white cursor-pointer ${
                        active
                          ? 'bg-white text-[#141414] border-white font-extrabold shadow-lg'
                          : 'bg-[#1f1f1f]/90 hover:bg-[#2a2a2a] text-zinc-200 border-white/10'
                      }`}
                    >
                      <StationAvatar
                        name={st.name}
                        favicon={st.favicon}
                        homepage={st.homepage}
                        size="sm"
                        isPlaying={active && playerStatus === 'playing'}
                      />
                      <span className="text-xs font-bold max-w-[130px] truncate">
                        {st.name}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Live HLS TV Video Player Modal (when a TV channel is clicked — 100% Full Mode on Smart TV) */}
      <TvPlayerModal isSmartTvFullMode />

      {/* Hidden Audio Engine for Radio playback */}
      <div className="hidden">
        <GlobalPlayer />
      </div>

      {/* LAMPA FULLSCREEN TRAILER PLAYER MODAL */}
      {isTrailerModalOpen && activeVodItem && (
        <div
          className="fixed inset-0 z-[130] bg-black/95 backdrop-blur-xl flex flex-col"
          onClick={() => setIsTrailerModalOpen(false)}
        >
          {/* Top Header Bar with Back/Close & Trailer Switcher */}
          <div
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-gradient-to-b from-black via-black/85 to-transparent z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                autoFocus
                onClick={() => setIsTrailerModalOpen(false)}
                className="h-10 px-5 rounded-full bg-white text-[#141414] hover:brightness-95 font-bold text-xs sm:text-sm inline-flex items-center gap-2 shadow-lg shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Назад / Închide Trailer</span>
              </button>
              <div className="min-w-0">
                <div className="text-sm sm:text-lg font-bold text-white truncate">
                  {activeVodItem.name} — Трейлер / Official Trailer
                </div>
                {trailerList[activeTrailerIdx]?.title && (
                  <div className="text-xs text-zinc-400 truncate">
                    {trailerList[activeTrailerIdx].title}
                  </div>
                )}
              </div>
            </div>

            {trailerList.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                {trailerList.map((tr, idx) => (
                  <button
                    key={tr.id + idx}
                    type="button"
                    onClick={() => setActiveTrailerIdx(idx)}
                    className={`h-9 px-3.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      activeTrailerIdx === idx
                        ? 'bg-white text-[#141414] font-bold shadow'
                        : 'bg-white/10 hover:bg-white/20 text-zinc-200'
                    }`}
                  >
                    {tr.title || `Трейлер #${idx + 1}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Center Trailer Video Player */}
          <div
            className="flex-1 w-full h-full flex items-center justify-center p-3 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {isLoadingTrailer ? (
              <div className="flex flex-col items-center gap-3 text-zinc-300">
                <Loader2 className="w-10 h-10 text-white animate-spin" />
                <span className="text-sm font-semibold">
                  Загрузка трейлера / Se încarcă trailerul...
                </span>
              </div>
            ) : trailerList[activeTrailerIdx] ? (
              <div className="w-full max-w-6xl aspect-video rounded-2xl overflow-hidden bg-black border border-white/15 shadow-2xl">
                <iframe
                  key={trailerList[activeTrailerIdx].embedUrl}
                  src={trailerList[activeTrailerIdx].embedUrl}
                  title={trailerList[activeTrailerIdx].title}
                  className="w-full h-full border-0"
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Online Subtitle Finder Modal */}
      <OnlineSubtitleFinderModal
        isOpen={isSubFinderOpen}
        onClose={() => setIsSubFinderOpen(false)}
        initialImdbId={
          activeVodItem?.id.startsWith('tt')
            ? activeVodItem.id
            : detailedMeta?.imdbId || ''
        }
        initialTitle={activeVodItem?.name || ''}
        initialType={activeVodItem?.type || 'movie'}
        initialSeason={selectedSeason}
        initialEpisode={selectedEpisode}
        initialLangFilter={preferredSubLang}
        onApplySubtitle={({ vttBlobUrl, label, cues }) => {
          setActiveSubVttUrl(vttBlobUrl);
          setActiveSubLabel(label);
          setActiveSubCues(cues);
        }}
      />
    </div>
  );
};

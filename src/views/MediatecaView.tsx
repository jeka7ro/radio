import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Film,
  Tv,
  Search,
  X,
  Play,
  Heart,
  Star,
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
  RotateCcw,
  ShieldCheck,
  History,
  Flame,
  Zap,
  Rocket,
  Compass,
  Smile,
  Globe,
  Download,
  HardDriveDownload,
  Trash2,
  CheckCircle2,
  FolderDown,
  Subtitles,
} from 'lucide-react';
import { useRadioStore } from '../store/useRadioStore';
import { EnrichedCountry } from '../hooks/useCountries';
import { TvChannel } from '../types/radio';
import { parseM3uPlaylist } from '../services/tvApi';
import {
  OfflineMediaItem,
  OfflineDownloadProgress,
  listOfflineItems,
  deleteOfflineItem,
  downloadHlsToOfflineDb,
  saveLocalFileToOfflineDb,
  exportOfflineItemToDeviceFile,
  formatBytes,
} from '../services/offlineMediaService';
import {
  fetchOnlineSubtitlesByImdb,
  downloadSubtitleAsVttBlobUrl,
} from '../services/subtitleSearchService';
import { VodNativeHlsPlayer } from '../components/tv/VodNativeHlsPlayer';
import { OnlineSubtitleFinderModal } from '../components/tv/OnlineSubtitleFinderModal';

interface MediatecaViewProps {
  selectedCountry: EnrichedCountry;
}

type MediatecaTab =
  | 'movies'
  | 'series'
  | 'russia'
  | 'offline'
  | 'saved'
  | 'lampa'
  | 'custom';

interface CinemetaItem {
  id: string; // IMDb ID e.g. tt15239678 or kp_5304403
  kpId?: string; // Kinopoisk ID e.g. 5304403
  moviedb_id?: number | string; // TMDB ID e.g. 693134
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
  | 'kinogram_hls'
  | 'kinogram_embed'
  | 'vidspark'
  | 'vidzee'
  | 'nontongo'
  | 'vidsrc_pm'
  | 'frembed';

type SubtitleLangId = 'ro' | 'ru' | 'en' | 'es' | 'fr' | 'de';

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

const SUBTITLE_LANGUAGES: Array<{
  id: SubtitleLangId;
  label: string;
}> = [
  { id: 'ro', label: 'Română' },
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' },
];

const VOD_SERVERS: Array<{ id: VodServerId; label: string; badge: string }> = [
  {
    id: 'kinogram_hls',
    label: 'Server 1: Player Nativ HD (Audio RU + Offline)',
    badge: 'Fără Reclame • Dublaj RU / Original + Descărcare Offline pe Device',
  },
  {
    id: 'kinogram_embed',
    label: 'Server 2: Kinogram RU (Дубляж)',
    badge: 'Fără Pop-up • Filme & Seriale Rusești + Dublaj RU Multi-Audio',
  },
  {
    id: 'vidspark',
    label: 'Server 3: VidSpark Direct HD',
    badge: 'Fără Reclame • Reluare Automată + Subtitrări RO/RU/EN',
  },
  {
    id: 'vidzee',
    label: 'Server 4: VidZee Multi-Server',
    badge: 'Fără Pop-up • Reluare Automată + Multi-Sub',
  },
  {
    id: 'nontongo',
    label: 'Server 5: NontonGo VIP & 4K',
    badge: 'Fără Pop-up • 3 Surse HD/VIP + Subtitrări',
  },
  {
    id: 'vidsrc_pm',
    label: 'Server 6: VidSrc Pro',
    badge: 'Fără Pop-up • Reluare Automată + OpenSubtitles',
  },
  {
    id: 'frembed',
    label: 'Server 7: CloudStream Backup',
    badge: 'Fără Pop-up • Backup Global',
  },
];

const GENRE_FILTERS: Array<{
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'top', label: 'Populare Acum', Icon: Flame },
  { id: 'imdbRating', label: 'Top IMDb', Icon: Star },
  { id: 'Action', label: 'Acțiune', Icon: Zap },
  { id: 'Sci-Fi', label: 'Sci-Fi', Icon: Rocket },
  { id: 'Thriller', label: 'Thriller', Icon: Film },
  { id: 'Comedy', label: 'Comedie', Icon: Smile },
  { id: 'Drama', label: 'Dramă', Icon: Clapperboard },
  { id: 'Crime', label: 'Crimă & Mister', Icon: Sparkles },
  { id: 'Adventure', label: 'Aventură', Icon: Compass },
  { id: 'Horror', label: 'Horror', Icon: Film },
  { id: 'Animation', label: 'Animație & Familie', Icon: Smile },
  { id: 'Romance', label: 'Romantic', Icon: Heart },
  { id: 'Documentary', label: 'Documentare', Icon: Globe },
];

/**
 * Curated & Verified Russian Movies & Series Catalog (with exact Kinopoisk & IMDb IDs)
 */
const RUSSIAN_MEDIA_CATALOG: CinemetaItem[] = [
  {
    id: 'tt28429213',
    kpId: '5304403',
    type: 'series',
    name: 'Слово пацана. Кровь на асфальте',
    releaseInfo: '2023',
    imdbRating: '8.5',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/5304403.jpg',
    genres: ['Драма', 'Криминал'],
    description:
      'Конец 1980-х. Пока родители борются за выживание, брошенные всеми дети сбиваются в уличные стаи и делят асфальт.',
  },
  {
    id: 'tt0337898',
    type: 'series',
    name: 'Бригада (Brigada)',
    releaseInfo: '2002',
    imdbRating: '8.3',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/79848.jpg',
    genres: ['Криминал', 'Драма', 'Боевик'],
    description:
      'История четырех друзей детства, обычных московских парней, Саши Белого, Космоса, Пчёлы и Фила, выросших в одном дворе.',
  },
  {
    id: 'tt4426042',
    kpId: '820638',
    type: 'series',
    name: 'Мажор (Silver Spoon)',
    releaseInfo: '2014–2025',
    imdbRating: '7.8',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/820638.jpg',
    genres: ['Драма', 'Криминал', 'Детектив'],
    description:
      'Сын высокопоставленного человека Игорь Соколовский попадает на службу в отделение полиции, где пытается раскрыть тайну гибели матери.',
  },
  {
    id: 'tt2363260',
    kpId: '687595',
    type: 'series',
    name: 'Кухня (Kitchen)',
    releaseInfo: '2012–2016',
    imdbRating: '8.4',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/687595.jpg',
    genres: ['Комедия', 'Мелодрама'],
    description:
      'Максим Лавров приезжает в Москву и устраивается поваром в элитный ресторан французской кухни Claude Monet.',
  },
  {
    id: 'tt0118767',
    kpId: '41519',
    type: 'movie',
    name: 'Брат (Brat)',
    releaseInfo: '1997',
    imdbRating: '7.8',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/41519.jpg',
    genres: ['Драма', 'Криминал', 'Боевик'],
    description:
      'Демобилизованный Данила Багров приезжает в Петербург к старшему брату и оказывается втянут в криминальный мир 90-х.',
  },
  {
    id: 'tt0238883',
    kpId: '41520',
    type: 'movie',
    name: 'Брат 2 (Brat 2)',
    releaseInfo: '2000',
    imdbRating: '7.8',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/41520.jpg',
    genres: ['Боевик', 'Криминал'],
    description:
      'Данила Багров отправляется в Америку, чтобы восстановить справедливость и помочь брату погибшего боевого товарища.',
  },
  {
    id: 'tt5135336',
    kpId: '838050',
    type: 'series',
    name: 'Метод (The Method)',
    releaseInfo: '2015–2025',
    imdbRating: '7.4',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/838050.jpg',
    genres: ['Триллер', 'Детектив', 'Драма'],
    description:
      'Гениальный следователь Родион Меглин раскрывает самые сложные серийные убийства вместе со стажеркой Есеней.',
  },
  {
    id: 'tt11418452',
    kpId: '1183582',
    type: 'movie',
    name: 'Холоп (Son of a Rich)',
    releaseInfo: '2019',
    imdbRating: '6.7',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/1183582.jpg',
    genres: ['Комедия'],
    description:
      'Избалованный мажор Гриша попадает в подстроенную деревню XIX века, где становится обычным конюхом.',
  },
  {
    id: 'tt21916002',
    kpId: '5047468',
    type: 'movie',
    name: 'Холоп 2 (Son of a Rich 2)',
    releaseInfo: '2024',
    imdbRating: '6.5',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/5047468.jpg',
    genres: ['Комедия'],
    description:
      'Перевоспитавшийся Гриша сам берется за перевоспитание избалованной дочки чиновницы Кати в декорациях 1812 года.',
  },
  {
    id: 'tt14536120',
    kpId: '1115471',
    type: 'movie',
    name: 'Мастер и Маргарита',
    releaseInfo: '2024',
    imdbRating: '7.6',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/1115471.jpg',
    genres: ['Драма', 'Фэнтези', 'Мелодрама'],
    description:
      'Москва 1930-х годов. Известный писатель оказывается в центре литературного скандала и знакомится с Маргаритой и таинственным Воландом.',
  },
  {
    id: 'tt9151230',
    kpId: '1108682',
    type: 'series',
    name: 'Эпидемия (To the Lake)',
    releaseInfo: '2019–2022',
    imdbRating: '7.3',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/1108682.jpg',
    genres: ['Фантастика', 'Триллер', 'Драма'],
    description:
      'Москву поражает неизвестный смертельный вирус. Несколько семей пытаются спастись на уединенном острове в Карелии.',
  },
  {
    id: 'tt14306560',
    kpId: '1224067',
    type: 'series',
    name: 'Вампиры средней полосы',
    releaseInfo: '2021–2025',
    imdbRating: '8.3',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/1224067.jpg',
    genres: ['Детектив', 'Комедия', 'Фэнтези'],
    description:
      'В Смоленске живет необычная семья вампиров во главе со старейшиной Святославом Вернидубовичем, которые никого не убивают.',
  },
  {
    id: 'tt10404944',
    kpId: '1100777',
    type: 'series',
    name: 'Триггер (Trigger)',
    releaseInfo: '2018–2024',
    imdbRating: '8.5',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/1100777.jpg',
    genres: ['Драма', 'Психология'],
    description:
      'Психолог Артём Стрелецкий практикует метод провокативной терапии, заставляя клиентов взглянуть в лицо своим страхам.',
  },
  {
    id: 'kp_913033',
    kpId: '913033',
    type: 'series',
    name: 'Полицейский с Рублёвки',
    releaseInfo: '2016–2019',
    imdbRating: '8.1',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/913033.jpg',
    genres: ['Комедия', 'Детектив'],
    description:
      'Гриша Измайлов — оперуполномоченный в самом элитном районе России, который раскрывает дела с фирменным черным юмором.',
  },
  {
    id: 'tt22074038',
    kpId: '4370148',
    type: 'movie',
    name: 'Чебурашка (Cheburashka)',
    releaseInfo: '2023',
    imdbRating: '7.3',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/4370148.jpg',
    genres: ['Семейный', 'Комедия'],
    description:
      'Мохнатый непоседливый зверек из далекой апельсиновой страны попадает в тихий приморский городок к угрюмому садовнику Гене.',
  },
  {
    id: 'tt8820590',
    type: 'movie',
    name: 'Т-34 (T-34)',
    releaseInfo: '2018',
    imdbRating: '6.8',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/939981.jpg',
    genres: ['Военный', 'Боевик', 'Драма'],
    description:
      'Пленный курсант Ивушкин планирует дерзкий побег с немецкого полигона на легендарном танке Т-34.',
  },
  {
    id: 'tt3560686',
    kpId: '808639',
    type: 'movie',
    name: 'Дурак (The Fool)',
    releaseInfo: '2014',
    imdbRating: '8.1',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/808639.jpg',
    genres: ['Драма'],
    description:
      'Простой сантехник обнаруживает трещину в старом общежитии, которое может рухнуть в любую минуту вместе с 800 жильцами.',
  },
  {
    id: 'tt2802154',
    kpId: '705356',
    type: 'movie',
    name: 'Левиафан (Leviathan)',
    releaseInfo: '2014',
    imdbRating: '7.6',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/705356.jpg',
    genres: ['Драма', 'Криминал'],
    description:
      'Автомеханик Николай из северного городка вступает в неравную борьбу с коррумпированным мэром за свой дом и землю.',
  },
  {
    id: 'tt0381936',
    type: 'movie',
    name: 'Бумер (Bumer)',
    releaseInfo: '2003',
    imdbRating: '7.0',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/40774.jpg',
    genres: ['Криминал', 'Драма'],
    description:
      'Четверо друзей уходят от погони на черном BMW по дорогам российской глубинки.',
  },
  {
    id: 'tt0420982',
    type: 'movie',
    name: 'Жмурки (Dead Man’s Bluff)',
    releaseInfo: '2005',
    imdbRating: '7.2',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/81555.jpg',
    genres: ['Комедия', 'Криминал'],
    description:
      'Черная криминальная комедия Алексея Балабанова о двух незадачливых бандитах середины 90-х.',
  },
  {
    id: 'kp_378244',
    kpId: '378244',
    type: 'series',
    name: 'Ликвидация (Liquidation)',
    releaseInfo: '2007',
    imdbRating: '8.5',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/378244.jpg',
    genres: ['Детектив', 'Криминал', 'Драма'],
    description:
      'Послевоенная Одесса, 1946 год. Давид Гоцман и маршал Жуков ведут борьбу с бандитским подпольем и неуловимым Академиком.',
  },
  {
    id: 'tt0403783',
    type: 'series',
    name: 'Мастер и Маргарита (Сериал 2005)',
    releaseInfo: '2005',
    imdbRating: '7.6',
    poster: 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/161104.jpg',
    genres: ['Драма', 'Мистика'],
    description:
      'Классическая многосерийная экранизация великого романа Михаила Булгакова режиссера Владимира Бортко.',
  },
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
const WATCH_PROGRESS_STORAGE_KEY = 'aether_vod_watch_progress_v1';

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

const VALID_SERVERS = new Set<VodServerId>([
  'kinogram_hls',
  'kinogram_embed',
  'vidspark',
  'vidzee',
  'nontongo',
  'vidsrc_pm',
  'frembed',
]);

function normalizeServerId(raw: unknown): VodServerId {
  if (typeof raw === 'string' && VALID_SERVERS.has(raw as VodServerId)) {
    return raw as VodServerId;
  }
  return 'kinogram_hls';
}

function loadWatchProgressMap(): Record<string, VodWatchProgressEntry> {
  try {
    const raw = localStorage.getItem(WATCH_PROGRESS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const normalized: Record<string, VodWatchProgressEntry> = {};
    for (const [key, val] of Object.entries(
      parsed as Record<string, VodWatchProgressEntry>
    )) {
      if (val && val.item && val.item.id) {
        normalized[key] = {
          ...val,
          server: normalizeServerId(val.server),
        };
      }
    }
    return normalized;
  } catch {
    return {};
  }
}

function saveWatchProgressMap(map: Record<string, VodWatchProgressEntry>): void {
  try {
    localStorage.setItem(WATCH_PROGRESS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

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
    item.kpId ||
    (item.id.startsWith('kp_') ? item.id.replace(/^kp_/, '') : '');
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
      if (start > 5) {
        params.set('startAt', String(start));
      }
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
    case 'frembed':
      return isSeries
        ? `https://frembed.live/api/serie.php?id=${imdbId}&sa=${season}&epi=${episode}`
        : `https://frembed.live/api/film.php?id=${imdbId}`;
  }
}

async function searchKinopoiskByKeyword(
  keyword: string
): Promise<CinemetaItem[]> {
  try {
    const res = await fetch(
      `https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(
        keyword.trim()
      )}&page=1`,
      {
        headers: {
          'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
        },
      }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      films?: Array<{
        filmId: number;
        nameRu?: string;
        nameEn?: string;
        type?: string;
        year?: string;
        rating?: string;
        posterUrlPreview?: string;
        posterUrl?: string;
        description?: string;
        genres?: Array<{ genre: string }>;
      }>;
    };
    return (data.films || []).map((f) => {
      const isSeries =
        f.type === 'TV_SERIES' ||
        f.type === 'MINI_SERIES' ||
        f.type === 'TV_SHOW';
      return {
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
        genres: f.genres?.map((g) => g.genre).filter(Boolean),
        description: f.description,
      };
    });
  } catch {
    return [];
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
  const [russiaFilter, setRussiaFilter] = useState<'all' | 'movie' | 'series'>(
    'all'
  );
  const [selectedGenre, setSelectedGenre] = useState<string>('top');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');

  const [catalogItems, setCatalogItems] = useState<CinemetaItem[]>([]);
  const [russiaSearchResults, setRussiaSearchResults] = useState<
    CinemetaItem[]
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [skipOffset, setSkipOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const [savedItems, setSavedItems] = useState<CinemetaItem[]>(() =>
    loadSavedVodItems()
  );

  // Offline Downloaded Videos Library State (IndexedDB)
  const [offlineItems, setOfflineItems] = useState<OfflineMediaItem[]>([]);
  const [activeOfflineItem, setActiveOfflineItem] =
    useState<OfflineMediaItem | null>(null);
  const [downloadQuality, setDownloadQuality] = useState<360 | 720>(360);
  const [activeDownloadProgress, setActiveDownloadProgress] =
    useState<OfflineDownloadProgress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const downloadAbortRef = useRef<AbortController | null>(null);
  const localVideoInputRef = useRef<HTMLInputElement | null>(null);

  // Watch progress state ("Continuă vizionarea — De unde ai rămas")
  const [watchProgressMap, setWatchProgressMap] = useState<
    Record<string, VodWatchProgressEntry>
  >(() => loadWatchProgressMap());

  // Active Movie / Series Player Modal state
  const [activeVodItem, setActiveVodItem] = useState<CinemetaItem | null>(null);
  const [detailedMeta, setDetailedMeta] = useState<DetailedMeta | null>(null);
  const [resolvedDirectStream, setResolvedDirectStream] =
    useState<ResolvedDirectVodStream | null>(null);
  const [isDirectStreamLoading, setIsDirectStreamLoading] =
    useState<boolean>(false);
  const [isMetaLoading, setIsMetaLoading] = useState<boolean>(false);
  const [activeServer, setActiveServer] =
    useState<VodServerId>('kinogram_hls');
  const [preferredSubLang, setPreferredSubLang] =
    useState<SubtitleLangId>('ro');
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);

  // The start timestamp passed into the player when opening/switching servers/episodes
  const [resumeStartSeconds, setResumeStartSeconds] = useState<number>(0);
  const [pendingResumePromptSec, setPendingResumePromptSec] = useState<
    number | null
  >(null);
  const [liveCurrentTime, setLiveCurrentTime] = useState<number>(0);
  const [liveDuration, setLiveDuration] = useState<number>(0);

  // Online Subtitle Finder & Active WebVTT Track State
  const [isSubFinderOpen, setIsSubFinderOpen] = useState<boolean>(false);
  const [activeSubVttUrl, setActiveSubVttUrl] = useState<string | null>(null);
  const [activeSubLabel, setActiveSubLabel] = useState<string>('');

  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const vodIframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastPostMessageTimeRef = useRef<number>(0);
  const preserveEpisodeOnOpenRef = useRef<boolean>(false);

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

  // Refresh offline library from IndexedDB
  const refreshOfflineLibrary = useCallback(async () => {
    try {
      const items = await listOfflineItems();
      setOfflineItems(items);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refreshOfflineLibrary();
  }, [refreshOfflineLibrary]);

  // Sorted list of items in "Continuă vizionarea"
  const continueWatchingList = useMemo(() => {
    return Object.values(watchProgressMap)
      .filter((entry) => entry && entry.item && entry.currentTime >= 5)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 12);
  }, [watchProgressMap]);

  // Persist watch progress helper
  const updateWatchProgress = useCallback(
    (
      item: CinemetaItem,
      season: number,
      episode: number,
      currentTime: number,
      duration: number,
      server: VodServerId,
      subLang: SubtitleLangId
    ) => {
      const cleanTime = Math.max(0, Math.floor(currentTime || 0));
      const defaultDur = item.type === 'series' ? 2700 : 5400;
      const cleanDur =
        duration && Number.isFinite(duration) && duration > 60
          ? Math.floor(duration)
          : defaultDur;

      setWatchProgressMap((prev) => {
        const existing = prev[item.id];
        const epKey = `S${season}E${episode}`;
        const prevEpMap = existing?.episodeProgressMap || {};
        const nextEntry: VodWatchProgressEntry = {
          item: {
            ...existing?.item,
            ...item,
          },
          season,
          episode,
          currentTime: cleanTime,
          duration: cleanDur,
          server,
          subLang,
          updatedAt: Date.now(),
          episodeProgressMap: {
            ...prevEpMap,
            [epKey]: {
              currentTime: cleanTime,
              duration: cleanDur,
              updatedAt: Date.now(),
            },
          },
        };
        const nextMap = {
          ...prev,
          [item.id]: nextEntry,
        };
        saveWatchProgressMap(nextMap);
        return nextMap;
      });
    },
    []
  );

  const removeWatchProgress = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setWatchProgressMap((prev) => {
      const next = { ...prev };
      delete next[id];
      saveWatchProgressMap(next);
      return next;
    });
  };

  // Open a movie or series and automatically resume from where the user left off
  const handleOpenVodItem = useCallback(
    (
      item: CinemetaItem,
      overrideSeason?: number,
      overrideEpisode?: number,
      overrideStartSeconds?: number
    ) => {
      setActiveOfflineItem(null);
      setDownloadError(null);

      const saved = watchProgressMap[item.id];
      const targetSeason =
        overrideSeason ?? (saved?.season ? saved.season : 1);
      const targetEpisode =
        overrideEpisode ?? (saved?.episode ? saved.episode : 1);
      const epKey = `S${targetSeason}E${targetEpisode}`;
      const epSaved = saved?.episodeProgressMap?.[epKey];

      const startSec =
        overrideStartSeconds !== undefined
          ? overrideStartSeconds
          : item.type === 'series'
            ? (epSaved?.currentTime ??
              (saved &&
              saved.season === targetSeason &&
              saved.episode === targetEpisode
                ? saved.currentTime
                : 0))
            : (saved?.currentTime ?? 0);

      const durSec =
        item.type === 'series'
          ? (epSaved?.duration ?? saved?.duration ?? 2700)
          : (saved?.duration ?? 5400);

      // Always open on Native HLS (Server 1) so Russian audio, ad-free playback & Offline Download are immediately active
      const targetServer: VodServerId = 'kinogram_hls';
      const targetSub = saved?.subLang || preferredSubLang;

      preserveEpisodeOnOpenRef.current = Boolean(
        overrideSeason !== undefined ||
          overrideEpisode !== undefined ||
          (saved && item.type === 'series')
      );

      setActiveVodItem(item);
      setSelectedSeason(targetSeason);
      setSelectedEpisode(targetEpisode);
      setActiveServer(targetServer);
      setPreferredSubLang(targetSub);
      setLiveDuration(durSec);

      if (startSec > 10) {
        setPendingResumePromptSec(startSec);
        setResumeStartSeconds(startSec);
        setLiveCurrentTime(startSec);
      } else {
        setPendingResumePromptSec(null);
        setResumeStartSeconds(0);
        setLiveCurrentTime(0);
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [watchProgressMap, preferredSubLang]
  );

  // Resolve Direct HLS Stream & Seasons/Episodes from `/api/vod-stream` whenever activeVodItem / season / episode changes
  useEffect(() => {
    if (!activeVodItem) {
      setResolvedDirectStream(null);
      return;
    }

    let cancelled = false;
    setIsDirectStreamLoading(true);

    const kp =
      activeVodItem.kpId ||
      (activeVodItem.id.startsWith('kp_')
        ? activeVodItem.id.replace(/^kp_/, '')
        : '');
    const imdb = activeVodItem.id.startsWith('tt') ? activeVodItem.id : '';
    const title = activeVodItem.name || '';
    const mediaType = activeVodItem.type || '';
    const year = activeVodItem.releaseInfo || activeVodItem.year || '';

    const fetchDirectStream = async () => {
      try {
        const res = await fetch(
          `/api/vod-stream?kp=${encodeURIComponent(kp)}&imdb=${encodeURIComponent(
            imdb
          )}&title=${encodeURIComponent(title)}&type=${encodeURIComponent(
            mediaType
          )}&year=${encodeURIComponent(
            year
          )}&season=${selectedSeason}&episode=${selectedEpisode}`
        );
        if (!res.ok) {
          if (!cancelled) setResolvedDirectStream({ ok: false });
          return;
        }
        const data = (await res.json()) as ResolvedDirectVodStream;
        if (cancelled) return;
        setResolvedDirectStream(data);
        if (data.duration && data.duration > 60) {
          setLiveDuration(data.duration);
        }
      } catch {
        if (!cancelled) setResolvedDirectStream({ ok: false });
      } finally {
        if (!cancelled) setIsDirectStreamLoading(false);
      }
    };

    void fetchDirectStream();
    return () => {
      cancelled = true;
    };
  }, [activeVodItem, selectedSeason, selectedEpisode]);

  // Listen to real-time postMessage events from VidSpark / VidSrc / VidZee embeds
  useEffect(() => {
    if (!activeVodItem || activeServer === 'kinogram_hls') return;

    const handleMessage = (event: MessageEvent) => {
      let payload = event.data;
      if (!payload) return;

      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }
      if (!payload || typeof payload !== 'object') return;

      let reportedTime: number | null = null;
      let reportedDuration: number | null = null;

      if (
        typeof payload.currentTime === 'number' &&
        Number.isFinite(payload.currentTime)
      ) {
        reportedTime = payload.currentTime;
        if (
          typeof payload.duration === 'number' &&
          Number.isFinite(payload.duration) &&
          payload.duration > 0
        ) {
          reportedDuration = payload.duration;
        }
      } else if (
        payload.type === 'PLAYER_EVENT' &&
        payload.data &&
        typeof payload.data.currentTime === 'number'
      ) {
        reportedTime = payload.data.currentTime;
        if (
          typeof payload.data.duration === 'number' &&
          payload.data.duration > 0
        ) {
          reportedDuration = payload.data.duration;
        }
      } else if (payload.type === 'MEDIA_DATA' && payload.data) {
        const progress =
          payload.data.progress?.watched ?? payload.data.currentTime;
        const duration =
          payload.data.progress?.duration ?? payload.data.duration;
        if (typeof progress === 'number' && Number.isFinite(progress)) {
          reportedTime = progress;
        }
        if (
          typeof duration === 'number' &&
          Number.isFinite(duration) &&
          duration > 0
        ) {
          reportedDuration = duration;
        }
      }

      if (reportedTime !== null && reportedTime >= 3) {
        lastPostMessageTimeRef.current = Date.now();
        const cleanSec = Math.floor(reportedTime);
        setLiveCurrentTime(cleanSec);
        if (reportedDuration && reportedDuration > 60) {
          setLiveDuration(Math.floor(reportedDuration));
        }
        updateWatchProgress(
          activeVodItem,
          selectedSeason,
          selectedEpisode,
          cleanSec,
          reportedDuration || liveDuration,
          activeServer,
          preferredSubLang
        );
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [
    activeVodItem,
    selectedSeason,
    selectedEpisode,
    activeServer,
    preferredSubLang,
    liveDuration,
    updateWatchProgress,
  ]);

  // Fallback automatic watch-time tracker for iframe embeds
  useEffect(() => {
    if (
      !activeVodItem ||
      activeServer === 'kinogram_hls' ||
      pendingResumePromptSec !== null
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastPostMessageTimeRef.current < 6000) return;

      setLiveCurrentTime((prev) => {
        const nextSec = prev + 5;
        updateWatchProgress(
          activeVodItem,
          selectedSeason,
          selectedEpisode,
          nextSec,
          liveDuration,
          activeServer,
          preferredSubLang
        );
        return nextSec;
      });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [
    activeVodItem,
    selectedSeason,
    selectedEpisode,
    activeServer,
    preferredSubLang,
    liveDuration,
    pendingResumePromptSec,
    updateWatchProgress,
  ]);

  // Start Offline Download of the currently open Movie / Episode into IndexedDB
  const handleDownloadCurrentVodOffline = async () => {
    if (!activeVodItem || !resolvedDirectStream?.hlsUrl) return;
    if (activeDownloadProgress) return;

    setDownloadError(null);
    const controller = new AbortController();
    downloadAbortRef.current = controller;

    const offlineId =
      activeVodItem.type === 'series'
        ? `vod_${activeVodItem.id}_S${selectedSeason}E${selectedEpisode}`
        : `vod_${activeVodItem.id}`;

    const subtitleLabel =
      activeVodItem.type === 'series'
        ? `Sezonul ${selectedSeason} • Episodul ${selectedEpisode}`
        : activeVodItem.releaseInfo || 'Film Complet';

    try {
      setActiveDownloadProgress({
        percent: 1,
        downloadedBytes: 0,
        totalSegments: 0,
        completedSegments: 0,
        stage: 'Se pregătește descărcarea Offline...',
      });

      await downloadHlsToOfflineDb({
        id: offlineId,
        title: activeVodItem.name,
        subtitleLabel,
        poster:
          activeVodItem.poster ||
          `https://images.metahub.space/poster/medium/${activeVodItem.id}/img`,
        masterM3u8Url: resolvedDirectStream.hlsUrl,
        preferredHeight: downloadQuality,
        audioLabel:
          resolvedDirectStream.audioNames?.[0] || 'Русский / Original',
        signal: controller.signal,
        onProgress: (prog) => setActiveDownloadProgress(prog),
      });

      await refreshOfflineLibrary();
      window.setTimeout(() => {
        setActiveDownloadProgress(null);
      }, 2500);
    } catch (err) {
      setActiveDownloadProgress(null);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setDownloadError('Descărcarea a fost oprită.');
      } else {
        setDownloadError(
          err instanceof Error
            ? err.message
            : 'Eroare la descărcarea filmului offline.'
        );
      }
    } finally {
      downloadAbortRef.current = null;
    }
  };

  const handleCancelDownload = () => {
    downloadAbortRef.current?.abort();
    downloadAbortRef.current = null;
    setActiveDownloadProgress(null);
  };

  const handleImportLocalVideoToOfflineDb = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const saved = await saveLocalFileToOfflineDb(file);
      await refreshOfflineLibrary();
      setActiveOfflineItem(saved);
      setActiveVodItem(null);
    } catch {
      // ignore
    } finally {
      e.target.value = '';
    }
  };

  // Debounce search query
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Search Kinopoisk when in 'russia' tab OR when user types Cyrillic
  useEffect(() => {
    if (activeTab !== 'russia') return;
    if (!debouncedQuery) {
      setRussiaSearchResults([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    void searchKinopoiskByKeyword(debouncedQuery).then((res) => {
      if (!cancelled) {
        setRussiaSearchResults(res);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, debouncedQuery]);

  // Fetch Movies or Series catalog from Cinemeta
  useEffect(() => {
    if (activeTab !== 'movies' && activeTab !== 'series') return;

    let cancelled = false;
    setIsLoading(true);
    setSkipOffset(0);

    const mediaType = activeTab === 'series' ? 'series' : 'movie';

    const fetchCatalog = async () => {
      try {
        // If user searches in Cyrillic in Movies/Series tab, also fetch Kinopoisk results!
        if (debouncedQuery && /[а-яА-ЯёЁ]/.test(debouncedQuery)) {
          const kpRes = await searchKinopoiskByKeyword(debouncedQuery);
          if (!cancelled && kpRes.length > 0) {
            setCatalogItems(kpRes);
            setHasMore(false);
            setIsLoading(false);
            return;
          }
        }

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

    if (!activeVodItem.id.startsWith('tt')) {
      setDetailedMeta({ ...activeVodItem });
      setIsMetaLoading(false);
      return;
    }

    let cancelled = false;
    setIsMetaLoading(true);

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
          !preserveEpisodeOnOpenRef.current &&
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

  // Combine Cinemeta episodes with Kinogram/Collaps episodes (so Russian series ALWAYS have all seasons & episodes!)
  const effectiveVideos = useMemo<SeriesEpisode[]>(() => {
    if (detailedMeta?.videos && detailedMeta.videos.length > 0) {
      return detailedMeta.videos;
    }
    if (
      resolvedDirectStream?.seasons &&
      resolvedDirectStream.seasons.length > 0
    ) {
      const list: SeriesEpisode[] = [];
      for (const s of resolvedDirectStream.seasons) {
        for (const ep of s.episodes) {
          list.push({
            id: `kp_s${s.season}_e${ep.episode}`,
            name: ep.title || `Серия ${ep.episode}`,
            season: s.season,
            episode: ep.episode,
          });
        }
      }
      return list;
    }
    return [];
  }, [detailedMeta?.videos, resolvedDirectStream?.seasons]);

  const availableSeasons = useMemo(() => {
    if (effectiveVideos.length === 0) return [];
    return Array.from(
      new Set(
        effectiveVideos
          .map((v) => v.season)
          .filter((s) => typeof s === 'number' && s > 0)
      )
    ).sort((a, b) => a - b);
  }, [effectiveVideos]);

  const episodesForSeason = useMemo(() => {
    if (effectiveVideos.length === 0) return [];
    return effectiveVideos
      .filter((v) => v.season === selectedSeason)
      .sort(
        (a, b) => (a.episode || a.number || 1) - (b.episode || b.number || 1)
      );
  }, [effectiveVideos, selectedSeason]);

  const handleSelectEpisode = (seasonNum: number, epNum: number) => {
    if (!activeVodItem) return;
    const saved = watchProgressMap[activeVodItem.id];
    const epKey = `S${seasonNum}E${epNum}`;
    const epSaved = saved?.episodeProgressMap?.[epKey];
    const startSec = epSaved?.currentTime ?? 0;
    const durSec = epSaved?.duration ?? 2700;

    setSelectedSeason(seasonNum);
    setSelectedEpisode(epNum);
    setLiveDuration(durSec);

    if (startSec > 10) {
      setPendingResumePromptSec(startSec);
      setResumeStartSeconds(startSec);
      setLiveCurrentTime(startSec);
    } else {
      setPendingResumePromptSec(null);
      setResumeStartSeconds(0);
      setLiveCurrentTime(0);
    }
  };

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

  const displayedItems = useMemo(() => {
    if (activeTab === 'saved') return savedItems;
    if (activeTab === 'russia') {
      const base = debouncedQuery ? russiaSearchResults : RUSSIAN_MEDIA_CATALOG;
      if (russiaFilter === 'all') return base;
      return base.filter((x) => x.type === russiaFilter);
    }
    return catalogItems;
  }, [
    activeTab,
    savedItems,
    debouncedQuery,
    russiaSearchResults,
    russiaFilter,
    catalogItems,
  ]);

  const activeItemForEmbed: CinemetaItem | null = activeVodItem
    ? {
        ...activeVodItem,
        kpId: resolvedDirectStream?.sourcePath?.startsWith('kp/')
          ? resolvedDirectStream.sourcePath.replace(/^kp\//, '')
          : activeVodItem.kpId,
        moviedb_id: detailedMeta?.moviedb_id ?? activeVodItem.moviedb_id,
      }
    : null;

  const currentVodOfflineId = activeVodItem
    ? activeVodItem.type === 'series'
      ? `vod_${activeVodItem.id}_S${selectedSeason}E${selectedEpisode}`
      : `vod_${activeVodItem.id}`
    : '';

  const existingOfflineItem = useMemo(
    () => offlineItems.find((x) => x.id === currentVodOfflineId) || null,
    [offlineItems, currentVodOfflineId]
  );

  return (
    <div className="space-y-5">
      {/* Top Header Bar */}
      <section className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-xs overflow-hidden">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Clapperboard className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100 tracking-tight truncate">
                Mediatecă — Filme, Seriale & Biblioteca Offline
              </h1>
              <p className="text-xs text-slate-600 dark:text-zinc-400 truncate">
                Catalog Global + Rusia (Audio RU) • Descărcare Locală & Vizionare Offline pe Device
              </p>
            </div>
          </div>

          {/* Mode Switcher Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
            <button
              type="button"
              onClick={() => {
                setActiveTab('movies');
                setActiveVodItem(null);
                setActiveOfflineItem(null);
              }}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'movies'
                  ? 'bg-brand-700 text-white dark:bg-brand-600 shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Film className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Filme</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('series');
                setActiveVodItem(null);
                setActiveOfflineItem(null);
              }}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'series'
                  ? 'bg-brand-700 text-white dark:bg-brand-600 shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Tv className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Seriale</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('russia');
                setActiveVodItem(null);
                setActiveOfflineItem(null);
              }}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'russia'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-200 border border-indigo-200/80 dark:border-indigo-800/70 hover:bg-indigo-100'
              }`}
            >
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Rusia (Filme & Seriale RU)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('offline');
                setActiveVodItem(null);
              }}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'offline'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800/70 hover:bg-emerald-100'
              }`}
            >
              <HardDriveDownload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Descărcate Offline ({offlineItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('saved');
                setActiveVodItem(null);
                setActiveOfflineItem(null);
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
                setActiveOfflineItem(null);
              }}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'lampa'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/70 hover:bg-amber-100'
              }`}
            >
              <Popcorn className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Lampa Smart TV</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('custom');
                setActiveVodItem(null);
                setActiveOfflineItem(null);
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

      {/* ACTIVE OFFLINE VIDEO PLAYER PANEL (100% FĂRĂ INTERNET DIN INDEXEDDB) */}
      {activeOfflineItem && (
        <section className="rounded-2xl sm:rounded-3xl bg-zinc-950 text-zinc-100 border border-emerald-700/60 shadow-2xl overflow-hidden">
          <div className="px-3.5 sm:px-5 py-2.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-zinc-950 text-[10px] sm:text-xs font-extrabold uppercase tracking-wider shrink-0">
                REDARE OFFLINE LOCALĂ
              </span>
              <h2 className="text-sm sm:text-lg font-bold text-white truncate">
                {activeOfflineItem.title}
              </h2>
              {activeOfflineItem.subtitleLabel && (
                <span className="text-xs text-emerald-300 truncate hidden sm:inline">
                  • {activeOfflineItem.subtitleLabel}
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-[11px] font-semibold shrink-0">
                {formatBytes(activeOfflineItem.sizeBytes)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void exportOfflineItemToDeviceFile(activeOfflineItem)}
                title="Salvează fișierul video în folderul Downloads al dispozitivului"
                className="min-h-[30px] px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-emerald-300 text-xs font-semibold inline-flex items-center gap-1"
              >
                <FolderDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Salvează în Telefon/PC</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveOfflineItem(null)}
                className="min-h-[30px] px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Închide</span>
              </button>
            </div>
          </div>

          <div className="relative w-full aspect-video bg-black">
            <VodNativeHlsPlayer
              offlineItem={activeOfflineItem}
              poster={activeOfflineItem.poster}
              subtitleVttUrl={activeSubVttUrl}
              subtitleLabel={activeSubLabel}
              onOpenSubtitleFinder={() => setIsSubFinderOpen(true)}
              onClearSubtitle={() => {
                setActiveSubVttUrl(null);
                setActiveSubLabel('');
              }}
              startAtSeconds={
                (() => {
                  try {
                    const raw = localStorage.getItem('aether_native_video_progress_v1');
                    const map = raw ? JSON.parse(raw) : {};
                    return Number(map[activeOfflineItem.id]) || 0;
                  } catch {
                    return 0;
                  }
                })()
              }
              onTimeUpdate={(cur) => {
                try {
                  const raw = localStorage.getItem('aether_native_video_progress_v1');
                  const map = raw ? JSON.parse(raw) : {};
                  map[activeOfflineItem.id] = cur;
                  localStorage.setItem(
                    'aether_native_video_progress_v1',
                    JSON.stringify(map)
                  );
                } catch {
                  // ignore
                }
              }}
            />
          </div>
        </section>
      )}

      {/* ACTIVE ON-DEMAND MOVIE / SERIES PLAYER PANEL */}
      {activeVodItem && activeItemForEmbed && (
        <section className="rounded-2xl sm:rounded-3xl bg-zinc-950 text-zinc-100 border border-zinc-800 shadow-2xl overflow-hidden">
          {/* Player Top Bar */}
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-zinc-900 border-b border-zinc-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-zinc-950 text-[10px] sm:text-xs font-extrabold uppercase tracking-wider shrink-0">
                  {activeVodItem.type === 'series'
                    ? `S${selectedSeason}:E${selectedEpisode}`
                    : 'FILM'}
                </span>
                <h2 className="text-sm sm:text-lg font-bold text-white truncate">
                  {activeVodItem.name}
                </h2>
                {activeVodItem.imdbRating && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold shrink-0">
                    <Star className="w-3 h-3 fill-current" />
                    {activeVodItem.imdbRating}
                  </span>
                )}
                <span
                  title="Toate reclamele de tip pop-up și redirect sunt blocate automat în player"
                  className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold shrink-0"
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>Anti-Popup Activ</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                {existingOfflineItem ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveOfflineItem(existingOfflineItem);
                        setActiveVodItem(null);
                      }}
                      className="min-h-[30px] px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Redă Offline ({formatBytes(existingOfflineItem.sizeBytes)})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void exportOfflineItemToDeviceFile(existingOfflineItem)
                      }
                      title="Salvează fișierul în memoria telefonului / PC-ului"
                      className="min-h-[30px] px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-emerald-300 text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <FolderDown className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Salvează</span>
                    </button>
                  </>
                ) : resolvedDirectStream?.ok && resolvedDirectStream.hlsUrl ? (
                  <div className="inline-flex items-center gap-1">
                    <select
                      aria-label="Calitate descărcare offline"
                      value={downloadQuality}
                      onChange={(e) =>
                        setDownloadQuality(Number(e.target.value) as 360 | 720)
                      }
                      className="h-[30px] px-2 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-[11px] font-semibold outline-none cursor-pointer"
                    >
                      <option value={360}>SD 360p</option>
                      <option value={720}>HD 720p</option>
                    </select>

                    <button
                      type="button"
                      disabled={Boolean(activeDownloadProgress)}
                      onClick={() => void handleDownloadCurrentVodOffline()}
                      className="min-h-[30px] px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1 shadow-xs transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descarcă Offline</span>
                    </button>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleFullscreenPlayer}
                  className="min-h-[30px] px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Fullscreen</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveVodItem(null)}
                  className="min-h-[30px] px-2.5 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Închide</span>
                </button>
              </div>
            </div>

            {/* Single-line Horizontal Server + Subtitle Switcher */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {VOD_SERVERS.map((srv) => {
                const active = activeServer === srv.id;
                return (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => {
                      setResumeStartSeconds(liveCurrentTime);
                      setActiveServer(srv.id);
                      updateWatchProgress(
                        activeVodItem,
                        selectedSeason,
                        selectedEpisode,
                        liveCurrentTime,
                        liveDuration,
                        srv.id,
                        preferredSubLang
                      );
                    }}
                    title={srv.badge}
                    className={`min-h-[28px] px-2.5 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    <Layers className="w-3 h-3 text-brand-400" />
                    <span>{srv.label}</span>
                  </button>
                );
              })}

              <span className="text-zinc-700 select-none">|</span>

              {SUBTITLE_LANGUAGES.map((sub) => {
                const active = preferredSubLang === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      setResumeStartSeconds(liveCurrentTime);
                      setPreferredSubLang(sub.id);
                      updateWatchProgress(
                        activeVodItem,
                        selectedSeason,
                        selectedEpisode,
                        liveCurrentTime,
                        liveDuration,
                        activeServer,
                        sub.id
                      );
                      // Also auto-fetch OpenSubtitles track for this language if on Native Player
                      if (activeVodItem.id.startsWith('tt')) {
                        void fetchOnlineSubtitlesByImdb({
                          imdbId: activeVodItem.id,
                          type: activeVodItem.type,
                          season: selectedSeason,
                          episode: selectedEpisode,
                        }).then(async (list) => {
                          const match = list.find(
                            (t) => t.langCode2 === sub.id
                          );
                          if (match) {
                            const { vttBlobUrl } =
                              await downloadSubtitleAsVttBlobUrl(match.url);
                            setActiveSubVttUrl(vttBlobUrl);
                            setActiveSubLabel(match.langLabel);
                          }
                        });
                      }
                    }}
                    className={`min-h-[28px] px-2.5 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-emerald-500 text-zinc-950 font-bold shadow-xs'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    <Globe className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span>{sub.id.toUpperCase()}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setIsSubFinderOpen(true)}
                title="Caută și descarcă subtitrări .SRT de pe internet (OpenSubtitles)"
                className="min-h-[28px] px-2.5 py-0.5 rounded-full bg-emerald-950 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <Subtitles className="w-3 h-3 shrink-0" />
                <span>+ Subtitrări Net (.SRT)</span>
              </button>
            </div>
          </div>

          {/* 16:9 VOD Stream Player (with Resume Prompt if watched previously) */}
          <div
            ref={playerContainerRef}
            className="relative w-full aspect-video bg-black"
          >
            {pendingResumePromptSec !== null ? (
              <div className="relative w-full h-full flex items-center justify-center p-4 overflow-hidden">
                {(activeVodItem.background || activeVodItem.poster) && (
                  <img
                    src={activeVodItem.background || activeVodItem.poster}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-25 blur-md scale-105 pointer-events-none"
                  />
                )}
                <div className="relative z-10 max-w-md w-full p-5 sm:p-6 rounded-2xl bg-zinc-900/95 border border-zinc-700/80 shadow-2xl text-center space-y-4 backdrop-blur-md">
                  <div className="w-11 h-11 rounded-2xl bg-brand-600/20 border border-brand-500/40 text-brand-400 flex items-center justify-center mx-auto">
                    <History className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      De unde vrei să pornească redarea?
                    </h3>
                    <p className="text-xs text-zinc-300">
                      {activeVodItem.type === 'series'
                        ? `Sezonul ${selectedSeason}, Episodul ${selectedEpisode} — ai rămas la `
                        : 'Ai rămas la '}
                      <strong className="text-amber-400 font-mono">
                        {formatWatchSeconds(pendingResumePromptSec)}
                      </strong>
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const resumeSec = pendingResumePromptSec;
                        setResumeStartSeconds(resumeSec);
                        setLiveCurrentTime(resumeSec);
                        setPendingResumePromptSec(null);
                      }}
                      className="w-full sm:w-auto min-h-[38px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 shadow-md transition-colors cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        Continuă de la {formatWatchSeconds(pendingResumePromptSec)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResumeStartSeconds(0);
                        setLiveCurrentTime(0);
                        setPendingResumePromptSec(null);
                        updateWatchProgress(
                          activeVodItem,
                          selectedSeason,
                          selectedEpisode,
                          0,
                          liveDuration,
                          activeServer,
                          preferredSubLang
                        );
                      }}
                      className="w-full sm:w-auto min-h-[38px] px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>De la început (00:00)</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : activeServer === 'kinogram_hls' ? (
              isDirectStreamLoading ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-300">
                  <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
                  <span className="text-xs font-semibold">
                    Se conectează la serverul video direct (Audio RU / Original)...
                  </span>
                </div>
              ) : resolvedDirectStream?.ok && resolvedDirectStream.hlsUrl ? (
                <VodNativeHlsPlayer
                  key={`hls_${activeVodItem.id}_${selectedSeason}_${selectedEpisode}`}
                  hlsUrl={resolvedDirectStream.hlsUrl}
                  audioTrackLabels={resolvedDirectStream.audioNames}
                  startAtSeconds={resumeStartSeconds}
                  subtitleVttUrl={activeSubVttUrl}
                  subtitleLabel={activeSubLabel}
                  onOpenSubtitleFinder={() => setIsSubFinderOpen(true)}
                  onClearSubtitle={() => {
                    setActiveSubVttUrl(null);
                    setActiveSubLabel('');
                  }}
                  poster={
                    activeVodItem.background ||
                    activeVodItem.poster ||
                    `https://images.metahub.space/background/medium/${activeVodItem.id}/img`
                  }
                  onTimeUpdate={(cur, dur) => {
                    setLiveCurrentTime(cur);
                    if (dur > 60) setLiveDuration(dur);
                    updateWatchProgress(
                      activeVodItem,
                      selectedSeason,
                      selectedEpisode,
                      cur,
                      dur || liveDuration,
                      activeServer,
                      preferredSubLang
                    );
                  }}
                  onStreamError={() => setActiveServer('kinogram_embed')}
                />
              ) : (
                <iframe
                  ref={vodIframeRef}
                  key={`fallback_${activeVodItem.id}_${selectedSeason}_${selectedEpisode}`}
                  src={buildVodEmbedUrl(
                    activeVodItem.id.startsWith('kp_')
                      ? 'kinogram_embed'
                      : 'vidspark',
                    activeItemForEmbed,
                    selectedSeason,
                    selectedEpisode,
                    preferredSubLang,
                    resumeStartSeconds
                  )}
                  title={activeVodItem.name}
                  className="w-full h-full border-0"
                  referrerPolicy="origin"
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              )
            ) : (
              <iframe
                ref={vodIframeRef}
                key={`${activeServer}_${activeVodItem.id}_${selectedSeason}_${selectedEpisode}_${preferredSubLang}_${resumeStartSeconds}`}
                src={buildVodEmbedUrl(
                  activeServer,
                  activeItemForEmbed,
                  selectedSeason,
                  selectedEpisode,
                  preferredSubLang,
                  resumeStartSeconds
                )}
                title={activeVodItem.name}
                className="w-full h-full border-0"
                referrerPolicy="origin"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
                onLoad={() => {
                  if (resumeStartSeconds > 5) {
                    window.setTimeout(() => {
                      try {
                        vodIframeRef.current?.contentWindow?.postMessage(
                          { action: 'seek', time: resumeStartSeconds },
                          '*'
                        );
                      } catch {
                        // ignore
                      }
                    }, 1200);
                  }
                }}
              />
            )}
          </div>

          {/* Active Offline Download Progress Bar (only visible during download) */}
          {(activeDownloadProgress || downloadError) && (
            <div className="px-3 sm:px-5 py-2.5 bg-zinc-900/95 border-t border-zinc-800 space-y-2 text-xs">
              {activeDownloadProgress && (
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-emerald-700/60 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{activeDownloadProgress.stage}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">
                        {activeDownloadProgress.percent}% •{' '}
                        {formatBytes(activeDownloadProgress.downloadedBytes)}
                      </span>
                      <button
                        type="button"
                        onClick={handleCancelDownload}
                        className="px-2.5 py-0.5 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white text-[11px] font-bold"
                      >
                        Anulează
                      </button>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-200"
                      style={{ width: `${activeDownloadProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {downloadError && (
                <p className="text-rose-400 font-semibold">{downloadError}</p>
              )}
            </div>
          )}

          {/* Series Seasons & Episodes Selector */}
          {activeVodItem.type === 'series' && (
            <div className="p-4 sm:p-5 bg-zinc-900/90 border-t border-zinc-800 space-y-4">
              {isMetaLoading && effectiveVideos.length === 0 ? (
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
                            onClick={() => handleSelectEpisode(seasonNum, 1)}
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
                        const epKey = `S${selectedSeason}E${epNum}`;
                        const epSaved =
                          watchProgressMap[activeVodItem.id]
                            ?.episodeProgressMap?.[epKey];

                        return (
                          <button
                            key={ep.id || `${ep.season}_${epNum}`}
                            type="button"
                            onClick={() =>
                              handleSelectEpisode(selectedSeason, epNum)
                            }
                            className={`p-2.5 rounded-2xl border text-left flex items-start gap-2.5 transition-all ${
                              isCurrentEp
                                ? 'bg-amber-500/20 border-amber-500 text-white'
                                : 'bg-zinc-950/70 hover:bg-zinc-800/80 border-zinc-800 text-zinc-200'
                            }`}
                          >
                            <div className="relative w-20 h-12 rounded-lg overflow-hidden shrink-0 bg-zinc-800 flex items-center justify-center">
                              {ep.thumbnail ? (
                                <img
                                  src={ep.thumbnail}
                                  alt={ep.name}
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Play className="w-4 h-4 text-amber-400 fill-current" />
                              )}
                              {epSaved && epSaved.currentTime > 10 && (
                                <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/85 text-[9px] font-bold text-emerald-400">
                                  {formatWatchSeconds(epSaved.currentTime)}
                                </span>
                              )}
                            </div>
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

      {/* OFFLINE DOWNLOADED VIDEOS LIBRARY TAB ("DESCĂRCATE OFFLINE") */}
      {activeTab === 'offline' && (
        <section className="space-y-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <HardDriveDownload className="w-5 h-5 text-emerald-500" />
                <span>
                  Biblioteca Video Offline pe Dispozitiv ({offlineItems.length})
                </span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
                Filmele și episoadele descărcate aici sunt stocate local în memoria internă a aplicației (IndexedDB) și pot fi privite <strong>100% fără internet</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <input
                ref={localVideoInputRef}
                type="file"
                accept="video/*,.mp4,.mkv,.webm,.mov"
                onChange={(e) => void handleImportLocalVideoToOfflineDb(e)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => localVideoInputRef.current?.click()}
                className="min-h-[38px] px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>+ Adaugă Video de pe Device (.MP4 / .MKV)</span>
              </button>
            </div>
          </div>

          {offlineItems.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-center space-y-3">
              <HardDriveDownload className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-zinc-200">
                Nu ai încă niciun film sau episod descărcat Offline
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
                Deschide orice film sau serial din tab-urile <strong>Filme</strong>, <strong>Seriale</strong> sau <strong>Rusia (RU)</strong> și apasă pe butonul verde <strong>„Descarcă Offline pe Device”</strong> de sub player, sau încarcă un fișier video de pe telefon/PC.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('russia')}
                  className="min-h-[36px] px-4 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                >
                  Explorează Filme & Seriale Rusia
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('movies')}
                  className="min-h-[36px] px-4 py-1.5 rounded-full bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold"
                >
                  Explorează Filme Populare
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {offlineItems.map((item) => {
                const isPlaying = activeOfflineItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border flex gap-3.5 transition-all ${
                      isPlaying
                        ? 'bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/30'
                        : 'bg-white dark:bg-zinc-900 border-slate-200/80 dark:border-zinc-800'
                    }`}
                  >
                    <div
                      onClick={() => {
                        setActiveVodItem(null);
                        setActiveOfflineItem(item);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="relative w-20 h-28 rounded-xl overflow-hidden bg-zinc-800 shrink-0 cursor-pointer flex items-center justify-center group"
                    >
                      {item.poster ? (
                        <img
                          src={item.poster}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Film className="w-7 h-7 text-zinc-500" />
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow">
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                            {item.qualityLabel}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                            {formatBytes(item.sizeBytes)}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate mt-1">
                          {item.title}
                        </h3>
                        {item.subtitleLabel && (
                          <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                            {item.subtitleLabel}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveVodItem(null);
                            setActiveOfflineItem(item);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="min-h-[32px] px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1 transition-colors"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Redă Offline</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void exportOfflineItemToDeviceFile(item)}
                          title="Salvează ca fișier în folderul Downloads al dispozitivului"
                          className="min-h-[32px] px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <FolderDown className="w-3.5 h-3.5" />
                          <span>Salvează</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            if (activeOfflineItem?.id === item.id) {
                              setActiveOfflineItem(null);
                            }
                            await deleteOfflineItem(item.id);
                            await refreshOfflineLibrary();
                          }}
                          title="Șterge din memoria Offline"
                          className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-rose-600 hover:text-white text-slate-500 dark:text-zinc-400 inline-flex items-center justify-center ml-auto transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* CONTINUE WATCHING ("DE UNDE AI RĂMAS") SHELF */}
      {(activeTab === 'movies' ||
        activeTab === 'series' ||
        activeTab === 'russia' ||
        activeTab === 'saved') &&
        continueWatchingList.length > 0 && (
          <section className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Continuă vizionarea — De unde ai rămas ({continueWatchingList.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWatchProgressMap({});
                  saveWatchProgressMap({});
                }}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-slate-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Șterge istoricul
              </button>
            </div>

            <div className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {continueWatchingList.map((entry) => {
                const { item, season, episode, currentTime, duration } = entry;
                const pct = Math.min(
                  96,
                  Math.max(6, Math.round((currentTime / (duration || 5400)) * 100))
                );
                const posterUrl =
                  item.poster ||
                  `https://images.metahub.space/poster/medium/${item.id}/img`;

                return (
                  <div
                    key={`cw_${item.id}`}
                    onClick={() =>
                      handleOpenVodItem(item, season, episode, currentTime)
                    }
                    className="group relative w-44 sm:w-52 shrink-0 rounded-2xl bg-slate-50 dark:bg-zinc-950/80 border border-slate-200/80 dark:border-zinc-800 hover:border-brand-500 p-2 flex items-center gap-2.5 cursor-pointer transition-all"
                  >
                    <div className="relative w-12 h-16 rounded-xl overflow-hidden bg-zinc-900 shrink-0">
                      <img
                        src={posterUrl}
                        alt={item.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center shadow">
                          <Play className="w-3 h-3 fill-current ml-0.5" />
                        </div>
                      </div>
                      <div className="absolute bottom-0 inset-x-0 h-1 bg-zinc-800">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 pr-4">
                      <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400">
                        {item.name}
                      </p>
                      <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5 truncate">
                        {item.type === 'series'
                          ? `S${season}:E${episode} • ${formatWatchSeconds(currentTime)}`
                          : `Min. ${formatWatchSeconds(currentTime)}`}
                      </p>
                      <span className="inline-block mt-1 text-[10px] font-semibold text-brand-700 dark:text-brand-300">
                        ▶ Reluare
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => removeWatchProgress(item.id, e)}
                      aria-label="Elimină din Continuă vizionarea"
                      title="Elimină"
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-200/80 dark:bg-zinc-800 hover:bg-rose-500 hover:text-white text-slate-600 dark:text-zinc-400 flex items-center justify-center transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      {/* MOVIES / SERIES / RUSSIA / SAVED CATALOG */}
      {(activeTab === 'movies' ||
        activeTab === 'series' ||
        activeTab === 'russia' ||
        activeTab === 'saved') && (
        <>
          {activeTab !== 'saved' && (
            <div className="space-y-2">
              {/* Search Bar */}
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === 'russia'
                      ? 'Caută filme și seriale rusești (ex: Бригада, Слово пацана, Мажор, Кухня, Брат)...'
                      : activeTab === 'series'
                        ? 'Caută seriale (ex: Breaking Bad, Game of Thrones, Бригада)...'
                        : 'Caută filme (ex: Dune, Gladiator, Oppenheimer, Брат)...'
                  }
                  className="w-full min-h-[38px] sm:min-h-[42px] pl-9 pr-9 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 transition-shadow"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter Pills for Russia Tab vs Global Movies/Series */}
              {activeTab === 'russia' ? (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                  {[
                    { id: 'all', label: 'Toate (Filme & Seriale RU)' },
                    { id: 'series', label: 'Seriale Rusești (Сериалы)' },
                    { id: 'movie', label: 'Filme Rusești (Кино)' },
                  ].map((f) => {
                    const active = russiaFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() =>
                          setRussiaFilter(f.id as 'all' | 'movie' | 'series')
                        }
                        className={`min-h-[32px] px-3.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                          active
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-800 hover:border-indigo-400'
                        }`}
                      >
                        <span>{f.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                !debouncedQuery && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                    {GENRE_FILTERS.map((g) => {
                      const active = selectedGenre === g.id;
                      const GenreIcon = g.Icon;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setSelectedGenre(g.id)}
                          className={`min-h-[30px] sm:min-h-[36px] px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                            active
                              ? 'bg-brand-700 text-white dark:bg-brand-600 shadow-xs'
                              : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-800 hover:border-brand-400'
                          }`}
                        >
                          <GenreIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{g.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          )}

          {/* Poster Grid */}
          {isLoading &&
          activeTab !== 'saved' &&
          !(activeTab === 'russia' && !debouncedQuery) ? (
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
              {Array.from({ length: 18 }).map((_, idx) => (
                <div
                  key={idx}
                  className="aspect-[2/3] rounded-2xl bg-slate-200/70 dark:bg-zinc-800/60 animate-pulse"
                />
              ))}
            </div>
          ) : displayedItems.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-center space-y-3">
              <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-zinc-200">
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
                className="min-h-[36px] px-4 py-1.5 rounded-full bg-brand-600 text-white text-xs font-semibold"
              >
                Explorează Filmele Populare
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
                {displayedItems.map((item) => {
                  const isSaved = savedItems.some((x) => x.id === item.id);
                  const isPlayingNow = activeVodItem?.id === item.id;
                  const progressEntry = watchProgressMap[item.id];
                  const hasProgress =
                    progressEntry && progressEntry.currentTime >= 10;
                  const progressPct = hasProgress
                    ? Math.min(
                        96,
                        Math.max(
                          6,
                          Math.round(
                            (progressEntry.currentTime /
                              (progressEntry.duration || 5400)) *
                              100
                          )
                        )
                      )
                    : 0;
                  const posterUrl =
                    item.poster ||
                    `https://images.metahub.space/poster/medium/${item.id}/img`;

                  return (
                    <article
                      key={`${item.type}_${item.id}`}
                      onClick={() => handleOpenVodItem(item)}
                      className={`group cursor-pointer rounded-xl sm:rounded-2xl border overflow-hidden flex flex-col justify-between transition-all duration-200 ${
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
                            e.currentTarget.style.display = 'none';
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />

                        {/* Top-Left Rating Badge */}
                        <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex items-center gap-1">
                          {item.imdbRating ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-xs text-amber-400 text-[10px] sm:text-[11px] font-extrabold shadow">
                              <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current" />
                              {item.imdbRating}
                            </span>
                          ) : (
                            <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-black/75 text-white text-[9px] sm:text-[10px] font-bold uppercase">
                              {item.type === 'series' ? 'SERIAL' : 'FILM'}
                            </span>
                          )}
                        </div>

                        {/* Top-Right Save Heart */}
                        <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
                          <button
                            type="button"
                            onClick={(e) => toggleSaveVodItem(item, e)}
                            aria-label="Salvează în Lista Mea"
                            className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center backdrop-blur-xs transition-colors ${
                              isSaved
                                ? 'bg-rose-600 text-white'
                                : 'bg-black/65 text-zinc-200 hover:bg-rose-600 hover:text-white'
                            }`}
                          >
                            <Heart
                              className={`w-3 h-3 sm:w-4 sm:h-4 ${
                                isSaved ? 'fill-current' : ''
                              }`}
                            />
                          </button>
                        </div>

                        {/* Resume Badge at Bottom of Poster */}
                        {hasProgress && (
                          <div className="absolute bottom-2 inset-x-1.5 flex justify-center pointer-events-none">
                            <span className="px-2 py-0.5 rounded-full bg-black/85 backdrop-blur-xs text-emerald-400 text-[9px] sm:text-[10px] font-bold truncate shadow">
                              {item.type === 'series'
                                ? `▶ S${progressEntry.season}:E${progressEntry.episode} • ${formatWatchSeconds(progressEntry.currentTime)}`
                                : `▶ ${formatWatchSeconds(progressEntry.currentTime)}`}
                            </span>
                          </div>
                        )}

                        {/* Progress Bar on Poster Bottom */}
                        {hasProgress && (
                          <div className="absolute bottom-0 inset-x-0 h-1 bg-zinc-800/90">
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        )}

                        {/* Play Overlay on Hover */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center p-2 transition-opacity">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-lg">
                            <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>

                      {/* Card Info */}
                      <div className="p-2 sm:p-3 flex-1 flex flex-col justify-between gap-1">
                        <div>
                          <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100 line-clamp-1 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                            {item.name}
                          </h3>
                          <div className="flex items-center gap-1 mt-0.5 text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 whitespace-nowrap overflow-hidden">
                            <span>{item.type === 'series' ? 'Serial' : 'Film'}</span>
                            {(item.releaseInfo || item.year) && (
                              <>
                                <span>•</span>
                                <span>{item.releaseInfo || item.year}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {item.genres && item.genres.length > 0 && (
                          <p className="hidden sm:block text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                            {item.genres.slice(0, 2).join(' • ')}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Load More Button */}
              {(activeTab === 'movies' || activeTab === 'series') && hasMore && (
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
              sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-orientation-lock allow-pointer-lock"
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
                <strong>Настройки (dreapta-sus) → Расширения (Extensions) → Добавить плагин (Add Plugin)</strong>{' '}
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
                    Redă orice fișier sau link video direct în player cu suport pentru subtitrare <code>.SRT</code> / <code>.VTT</code> și reluare automată.
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

      {/* Online Subtitle Finder Modal (OpenSubtitles .SRT Search & Apply) */}
      <OnlineSubtitleFinderModal
        isOpen={isSubFinderOpen}
        onClose={() => setIsSubFinderOpen(false)}
        initialImdbId={
          activeVodItem?.id.startsWith('tt') ? activeVodItem.id : ''
        }
        initialTitle={
          activeVodItem?.name || activeOfflineItem?.title || ''
        }
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

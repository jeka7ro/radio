import {
  AudioTrackPreference,
} from "../services/subtitleSearchService";
import {
  TvPreferredQuality,
  TvSubFontSize,
} from "../components/tv/VodNativeHlsPlayer";
import {
  loadSharedProfiles,
  saveSharedProfiles,
  saveSharedActiveProfileId,
  isLocalHomeServer,
} from "../services/deviceContinuityService";
import { Station } from "../types/radio";

export type StreamingPlatformId =
  | 'netflix'
  | 'hbo'
  | 'apple'
  | 'disney'
  | 'prime'
  | 'paramount';

export type TvSectionId =
  | 'home'
  | 'movies'
  | 'cartoons'
  | 'series'
  | StreamingPlatformId
  | 'youtube'
  | 'torrents'
  | 'tv'
  | 'radio'
  | 'music'
  | 'catalog'
  | 'filter'
  | 'saved'
  | 'history'
  | 'search';

export type OriginCountryId =
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

export type VodServerId =
  | 'kinogram_hls'
  | 'filelist_torrent'
  | 'kinogram_embed'
  | 'vidspark'
  | 'vidzee'
  | 'nontongo'
  | 'vidsrc_pm';

export type SubtitleLangId = 'ro' | 'ru' | 'en';

export interface CinemetaItem {
  id: string;
  kpId?: string;
  flTorrentId?: number;
  releaseTitle?: string;
  sizeFormatted?: string;
  seeders?: number;
  freeleech?: boolean;
  isRo?: boolean;
  qualityBadge?: string;
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

export interface FileListTorrentInfo {
  id: number;
  flId: string;
  name: string;
  releaseTitle: string;
  year: string;
  type: 'movie' | 'series';
  imdbId: string;
  poster: string;
  category: string;
  quality: string;
  isRo: boolean;
  freeleech: boolean;
  doubleup: boolean;
  sizeBytes: number;
  sizeFormatted: string;
  seeders: number;
  leechers: number;
  uploadDate: string;
  genres: string[];
  provider?: 'filelist' | 'torrentio';
  source?: 'filelist' | 'torrentio';
  tracker?: string;
  infoHash?: string;
  fileIdx?: number;
  audioInfo?: string;
}

export interface ResolvedFileListStream {
  ok: boolean;
  error?: string;
  torrentId?: number;
  selectedTorrent?: FileListTorrentInfo;
  torrents?: FileListTorrentInfo[];
  selectedFileIdx?: number;
  selectedFileName?: string;
  files?: Array<{ index: number; name: string; sizeFormatted: string }>;
  streamUrl?: string;
  durationSec?: number;
  videoCodec?: string;
  audioNames?: string[];
}

export interface SeriesEpisode {
  id: string;
  name: string;
  title?: string;
  season: number;
  episode: number;
  number?: number;
  overview?: string;
  description?: string;
  thumbnail?: string;
  released?: string;
  firstAired?: string;
}

export interface TrailerItem {
  id: string;
  title: string;
  embedUrl: string;
}

export interface DetailedMeta extends CinemetaItem {
  imdbId?: string;
  videos?: SeriesEpisode[];
  cast?: string[];
  director?: string[];
  writer?: string[];
  awards?: string;
  trailers?: Array<{ source?: string; type?: string }>;
  trailerStreams?: Array<{ ytId?: string; title?: string }>;
}

export interface ResolvedDirectVodStream {
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

export interface EpisodeProgress {
  currentTime: number;
  duration: number;
  updatedAt: number;
}

export interface VodWatchProgressEntry {
  item: CinemetaItem;
  season: number;
  episode: number;
  currentTime: number;
  duration: number;
  server: VodServerId;
  subLang: SubtitleLangId;
  updatedAt: number;
  deviceName?: string;
  totalEpisodesInSeason?: number;
  totalSeasons?: number;
  episodeProgressMap?: Record<string, EpisodeProgress>;
}

export const SAVED_VOD_STORAGE_KEY = 'aether_saved_vod_items_v1';
export const WATCH_PROGRESS_STORAGE_KEY = 'aether_vod_watch_progress_v1';
export const TV_PROFILES_STORAGE_KEY = 'aether_smart_tv_profiles_v1';
export const ACTIVE_TV_PROFILE_STORAGE_KEY = 'aether_smart_tv_active_profile_v1';

export type TvUiLang = 'ro' | 'en' | 'ru';

export interface SmartTvProfile {
  id: string;
  name: string;
  avatarEmoji: string;
  avatarUrl?: string;
  avatarBg: string;
  pin?: string;
  isKids?: boolean;
  uiLang?: TvUiLang;
}

export const DEFAULT_TV_PROFILES: SmartTvProfile[] = loadSharedProfiles();

export const PROFILE_AVATAR_PRESETS: Array<{ emoji: string; bg: string }> = [
  { emoji: 'EU', bg: 'from-emerald-500 to-teal-700' },
  { emoji: 'FM', bg: 'from-amber-500 to-orange-700' },
  { emoji: 'DJ', bg: 'from-sky-500 to-blue-700' },
  { emoji: 'JR', bg: 'from-lime-500 to-emerald-700' },
  { emoji: 'EX', bg: 'from-cyan-500 to-teal-700' },
  { emoji: 'GL', bg: 'from-yellow-500 to-amber-700' },
  { emoji: 'PR', bg: 'from-emerald-400 to-green-700' },
  { emoji: 'SQ', bg: 'from-rose-500 to-red-700' },
];

export function loadTvProfiles(): SmartTvProfile[] {
  return loadSharedProfiles();
}

export function saveTvProfiles(profiles: SmartTvProfile[]): void {
  saveSharedProfiles(profiles);
}

export function loadActiveProfileId(): string {
  try {
    return localStorage.getItem(ACTIVE_TV_PROFILE_STORAGE_KEY) || 'p1';
  } catch {
    return 'p1';
  }
}

export function saveActiveProfileId(profileId: string): void {
  saveSharedActiveProfileId(profileId);
}

export const TV_ORIGIN_COUNTRIES: Array<{
  id: OriginCountryId;
  label: string;
  labelEn: string;
  labelRu: string;
  kpCountryId?: number;
}> = [
    { id: 'ALL', label: 'Neselectat (Toate)', labelEn: 'Any Language', labelRu: 'Не выбрано' },
    { id: 'US', label: 'US • Engleză (SUA)', labelEn: 'US • English (US)', labelRu: 'US • Английский (США)', kpCountryId: 1 },
    { id: 'GB', label: 'UK • Engleză (UK)', labelEn: 'UK • English (UK)', labelRu: 'UK • Английский (UK)', kpCountryId: 5 },
    { id: 'RO', label: 'RO • Română (România)', labelEn: 'RO • Romanian', labelRu: 'RO • Румынский (Română)', kpCountryId: 37 },
    { id: 'FR', label: 'FR • Franceză', labelEn: 'FR • French', labelRu: 'FR • Французский', kpCountryId: 3 },
    { id: 'DE', label: 'DE • Germană', labelEn: 'DE • German', labelRu: 'DE • Немецкий', kpCountryId: 9 },
    { id: 'IT', label: 'IT • Italiană', labelEn: 'IT • Italian', labelRu: 'IT • Итальянский', kpCountryId: 10 },
    { id: 'ES', label: 'ES • Spaniolă', labelEn: 'ES • Spanish', labelRu: 'ES • Испанский', kpCountryId: 8 },
    { id: 'TR', label: 'TR • Turcă', labelEn: 'TR • Turkish', labelRu: 'TR • Турецкий', kpCountryId: 44 },
    { id: 'KR', label: 'KR • Coreeană', labelEn: 'KR • Korean', labelRu: 'KR • Корейский', kpCountryId: 49 },
    { id: 'JP', label: 'JP • Japoneză', labelEn: 'JP • Japanese', labelRu: 'JP • Японский', kpCountryId: 16 },
    { id: 'CN', label: 'CN • Chineză', labelEn: 'CN • Chinese', labelRu: 'CN • Китайский', kpCountryId: 21 },
    { id: 'IN', label: 'IN • Hindi (India)', labelEn: 'IN • Hindi (India)', labelRu: 'IN • Хинди (Индия)', kpCountryId: 7 },
    { id: 'RU', label: 'RU • Rusă', labelEn: 'RU • Russian', labelRu: 'RU • Русский', kpCountryId: 34 },
    { id: 'UA', label: 'UA • Ucraineană', labelEn: 'UA • Ukrainian', labelRu: 'UA • Украинский', kpCountryId: 40 },
    { id: 'BY', label: 'BY • Belarusă', labelEn: 'BY • Belarusian', labelRu: 'BY • Белорусский', kpCountryId: 41 },
    { id: 'ZA', label: 'ZA • Afrikaans', labelEn: 'ZA • Afrikaans', labelRu: 'ZA • Африкаанс', kpCountryId: 60 },
    { id: 'AL', label: 'AL • Albaneză', labelEn: 'AL • Albanian', labelRu: 'AL • Албанский', kpCountryId: 61 },
    { id: 'AE', label: 'AE • Arabă', labelEn: 'AE • Arabic', labelRu: 'AE • Арабский', kpCountryId: 62 },
    { id: 'AZ', label: 'AZ • Azeră', labelEn: 'AZ • Azerbaijani', labelRu: 'AZ • Азербайджанский', kpCountryId: 42 },
  ];

export const TV_GENRE_PILLS: Array<{
  id: string;
  label: string;
  labelEn: string;
  labelRu: string;
  kpGenreId?: number;
}> = [
    { id: 'top', label: 'Toate genurile', labelEn: 'All Genres', labelRu: 'Не выбрано' },
    { id: 'Action', label: 'Acțiune', labelEn: 'Action', labelRu: 'Боевик', kpGenreId: 11 },
    { id: 'Adventure', label: 'Aventură', labelEn: 'Adventure', labelRu: 'Приключения', kpGenreId: 7 },
    { id: 'Animation', label: 'Animație / Desene', labelEn: 'Animation', labelRu: 'Мультфильм', kpGenreId: 18 },
    { id: 'Comedy', label: 'Comedie', labelEn: 'Comedy', labelRu: 'Комедия', kpGenreId: 13 },
    { id: 'Crime', label: 'Crimă / Polițist', labelEn: 'Crime', labelRu: 'Криминал', kpGenreId: 3 },
    { id: 'Documentary', label: 'Documentar', labelEn: 'Documentary', labelRu: 'Документальный', kpGenreId: 22 },
    { id: 'Drama', label: 'Dramă', labelEn: 'Drama', labelRu: 'Драма', kpGenreId: 2 },
    { id: 'Family', label: 'Familie', labelEn: 'Family', labelRu: 'Семейный', kpGenreId: 19 },
    { id: 'Fantasy', label: 'Fantezie / Fantasy', labelEn: 'Fantasy', labelRu: 'Фэнтези', kpGenreId: 12 },
    { id: 'History', label: 'Istoric', labelEn: 'History', labelRu: 'История', kpGenreId: 15 },
    { id: 'Horror', label: 'Horror / Groază', labelEn: 'Horror', labelRu: 'Ужасы', kpGenreId: 17 },
    { id: 'Romance', label: 'Romantic / Melodramă', labelEn: 'Romance', labelRu: 'Мелодрама', kpGenreId: 4 },
    { id: 'Mystery', label: 'Mister / Detectiv', labelEn: 'Mystery', labelRu: 'Детектив', kpGenreId: 5 },
    { id: 'Sci-Fi', label: 'SF / Sci-Fi', labelEn: 'Sci-Fi', labelRu: 'Фантастика', kpGenreId: 6 },
    { id: 'Thriller', label: 'Thriller / Suspans', labelEn: 'Thriller', labelRu: 'Триллер', kpGenreId: 1 },
    { id: 'Adult', label: '18+ Adulți (Erotic)', labelEn: '18+ Adult (Erotic)', labelRu: '18+ Для взрослых', kpGenreId: 28 },
  ];

export const LAMPA_FILTER_RATINGS: Array<{
  id: string;
  label: string;
  labelEn: string;
  labelRu: string;
  minRating?: number;
}> = [
    { id: 'any', label: 'Orice notă', labelEn: 'Any Rating', labelRu: 'Не выбрано' },
    { id: '8', label: 'Peste 8.0 ★', labelEn: '8.0 ★ and above', labelRu: 'От 8.0 и выше', minRating: 8 },
    { id: '7', label: 'Peste 7.0 ★', labelEn: '7.0 ★ and above', labelRu: 'От 7.0 и выше', minRating: 7 },
    { id: '6', label: 'Peste 6.0 ★', labelEn: '6.0 ★ and above', labelRu: 'От 6.0 и выше', minRating: 6 },
    { id: '5', label: 'Peste 5.0 ★', labelEn: '5.0 ★ and above', labelRu: 'От 5.0 и выше', minRating: 5 },
  ];

export const LAMPA_FILTER_YEARS: Array<{
  id: string;
  label: string;
  labelEn: string;
  labelRu: string;
  yearFrom?: number;
  yearTo?: number;
}> = [
    { id: 'any', label: 'Orice an', labelEn: 'Any Year', labelRu: 'Не выбрано' },
    { id: '2027', label: '2027', labelEn: '2027', labelRu: '2027', yearFrom: 2027, yearTo: 2027 },
    { id: '2026', label: '2026', labelEn: '2026', labelRu: '2026', yearFrom: 2026, yearTo: 2026 },
    { id: '2025', label: '2025', labelEn: '2025', labelRu: '2025', yearFrom: 2025, yearTo: 2025 },
    { id: '2024', label: '2024', labelEn: '2024', labelRu: '2024', yearFrom: 2024, yearTo: 2024 },
    { id: '2020-2027', label: '2020 - 2027', labelEn: '2020 - 2027', labelRu: '2020 - 2027', yearFrom: 2020, yearTo: 2027 },
    { id: '2010-2019', label: '2010 - 2019', labelEn: '2010 - 2019', labelRu: '2010 - 2019', yearFrom: 2010, yearTo: 2019 },
    { id: '2000-2009', label: '2000 - 2009', labelEn: '2000 - 2009', labelRu: '2000 - 2009', yearFrom: 2000, yearTo: 2009 },
    { id: '1990-1999', label: '1990 - 1999', labelEn: '1990 - 1999', labelRu: '1990 - 1999', yearFrom: 1990, yearTo: 1999 },
  ];

export const TV_LIVE_REGIONS: Array<{
  id: string;
  label: string;
  labelEn: string;
  labelRu: string;
  country: string;
  group?: string;
}> = [
    { id: 'FAV', label: 'Favorite TV', labelEn: 'Favorite TV', labelRu: 'Избранное ТВ', country: 'FAV' },
    { id: 'IEDEM', label: 'iEdem / Playlist M3U', labelEn: 'iEdem / M3U Playlist', labelRu: 'iEdem / Плейлист M3U', country: 'IEDEM' },
    { id: 'ADULT', label: '18+ Adulți', labelEn: '18+ Adult', labelRu: '18+ Для взрослых', country: 'ADULT' },
    { id: 'RO', label: 'RO • România HD', labelEn: 'RO • Romania HD', labelRu: 'RO • Румыния HD', country: 'RO' },
    { id: 'MD', label: 'MD • Moldova HD', labelEn: 'MD • Moldova HD', labelRu: 'MD • Молдова HD', country: 'MD' },
    { id: 'RU', label: 'RU • Rusia', labelEn: 'RU • Russia', labelRu: 'RU • Россия', country: 'RU' },
    { id: 'US', label: 'US • SUA', labelEn: 'US • USA', labelRu: 'US • США', country: 'US' },
    { id: 'GB', label: 'UK • Marea Britanie', labelEn: 'UK • United Kingdom', labelRu: 'UK • Великобритания', country: 'GB' },
    { id: 'DE', label: 'DE • Germania', labelEn: 'DE • Germany', labelRu: 'DE • Германия', country: 'DE' },
    { id: 'FR', label: 'FR • Franța', labelEn: 'FR • France', labelRu: 'FR • Франция', country: 'FR' },
    { id: 'IT', label: 'IT • Italia', labelEn: 'IT • Italy', labelRu: 'IT • Италия', country: 'IT' },
    { id: 'ES', label: 'ES • Spania', labelEn: 'ES • Spain', labelRu: 'ES • Испания', country: 'ES' },
    { id: 'TR', label: 'TR • Turcia', labelEn: 'TR • Turkey', labelRu: 'TR • Турция', country: 'TR' },
    { id: 'UA', label: 'UA • Ucraina', labelEn: 'UA • Ukraine', labelRu: 'UA • Украина', country: 'UA' },
    { id: 'HU', label: 'HU • Ungaria', labelEn: 'HU • Hungary', labelRu: 'HU • Венгрия', country: 'HU' },
    { id: 'BG', label: 'BG • Bulgaria', labelEn: 'BG • Bulgaria', labelRu: 'BG • Болгария', country: 'BG' },
  ];

export const TV_LIVE_CATEGORIES: Array<{
  id: string;
  label: string;
  labelEn: string;
  labelRu: string;
  match: string;
}> = [
    { id: 'ALL', label: 'Toate Canalele', labelEn: 'All Channels', labelRu: 'Все каналы', match: '' },
    { id: 'GENERAL', label: 'Generale', labelEn: 'General', labelRu: 'Общие', match: 'general|national|общ|федерал' },
    { id: 'NEWS', label: 'Știri', labelEn: 'News', labelRu: 'Новости', match: 'news|știr|stiri|инфо|новост' },
    { id: 'MOVIES', label: 'Filme & Seriale', labelEn: 'Movies & Series', labelRu: 'Кино и Сериалы', match: 'movie|film|cinema|series|кино|сериал' },
    { id: 'SPORT', label: 'Sport', labelEn: 'Sports', labelRu: 'Спорт', match: 'sport|спорт' },
    { id: 'MUSIC', label: 'Muzică', labelEn: 'Music', labelRu: 'Музыка', match: 'music|muzic|музык' },
    { id: 'DOC', label: 'Documentare', labelEn: 'Documentary', labelRu: 'Познавательные', match: 'doc|science|history|познав' },
    { id: 'KIDS', label: 'Copii', labelEn: 'Kids', labelRu: 'Детские', match: 'kids|children|детск|anim' },
    { id: 'ADULT', label: '18+ Adulți', labelEn: '18+ Adult', labelRu: '18+ Для взрослых', match: 'adult|xxx|18+|взросл|эротик' },
  ];

export const RADIO_COUNTRIES: Array<{
  code: string;
  label: string;
  labelEn: string;
  labelRu: string;
}> = [
    { code: 'FAV', label: 'Favorite Radio', labelEn: 'Favorite Radio', labelRu: 'Избранное Радио' },
    { code: 'RO', label: 'RO • România', labelEn: 'RO • Romania', labelRu: 'RO • Румыния' },
    { code: 'MD', label: 'MD • Moldova', labelEn: 'MD • Moldova', labelRu: 'MD • Молдова' },
    { code: 'RU', label: 'RU • Rusia', labelEn: 'RU • Russia', labelRu: 'RU • Россия' },
    { code: 'US', label: 'US • SUA', labelEn: 'US • USA', labelRu: 'US • США' },
    { code: 'GB', label: 'UK • Marea Britanie', labelEn: 'UK • United Kingdom', labelRu: 'UK • Великобритания' },
    { code: 'DE', label: 'DE • Germania', labelEn: 'DE • Germany', labelRu: 'DE • Германия' },
    { code: 'FR', label: 'FR • Franța', labelEn: 'FR • France', labelRu: 'FR • Франция' },
    { code: 'IT', label: 'IT • Italia', labelEn: 'IT • Italy', labelRu: 'IT • Италия' },
    { code: 'ES', label: 'ES • Spania', labelEn: 'ES • Spain', labelRu: 'ES • Испания' },
    { code: 'TR', label: 'TR • Turcia', labelEn: 'TR • Turkey', labelRu: 'TR • Турция' },
    { code: 'UA', label: 'UA • Ucraina', labelEn: 'UA • Ukraine', labelRu: 'UA • Украина' },
    { code: 'HU', label: 'HU • Ungaria', labelEn: 'HU • Hungary', labelRu: 'HU • Венгрия' },
    { code: 'NL', label: 'NL • Olanda', labelEn: 'NL • Netherlands', labelRu: 'NL • Нидерланды' },
    { code: 'CH', label: 'CH • Elveția', labelEn: 'CH • Switzerland', labelRu: 'CH • Швейцария' },
  ];

export const VOD_SERVERS: Array<{ id: VodServerId; label: string }> = [
  {
    id: 'kinogram_hls',
    label: 'S1: Player Nativ 1080p Full HD (Original / Multi-Audio)',
  },
  {
    id: 'filelist_torrent',
    label: 'FileList.io Torrents (4K UHD / 1080p BluRay Live)',
  },
  { id: 'vidspark', label: 'S2: VidSpark 1080p / 4K (Sub RO/RU/EN)' },
  { id: 'kinogram_embed', label: 'S3: Kinogram 1080p Multi-Audio' },
  { id: 'vidzee', label: 'S4: VidZee 1080p Multi-Server' },
  { id: 'vidsrc_pm', label: 'S5: VidSrc 1080p OpenSubtitles' },
  { id: 'nontongo', label: 'S6: MultiEmbed 4K / 1080p VIP' },
];

export const ON_SCREEN_KEYS_LATIN = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3',
  '4', '5', '6', '7', '8', '9',
];

export const ON_SCREEN_KEYS_CYRILLIC = [
  'А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'Й',
  'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У',
  'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Ы', 'Э', 'Ю', 'Я',
];

export function formatWatchSeconds(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds || 0));
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const rem = sec % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function getWatchProgressKeyForProfile(profileId = 'p1'): string {
  return !profileId || profileId === 'p1'
    ? WATCH_PROGRESS_STORAGE_KEY
    : `${WATCH_PROGRESS_STORAGE_KEY}_${profileId}`;
}

export function getSavedVodKeyForProfile(profileId = 'p1'): string {
  return !profileId || profileId === 'p1'
    ? SAVED_VOD_STORAGE_KEY
    : `${SAVED_VOD_STORAGE_KEY}_${profileId}`;
}

export function sanitizeDeviceName(name?: string): string {
  if (!name) return '';
  return name.replace(/[^\p{L}\p{N}\s/().•-]/gu, '').replace(/\s+/g, ' ').trim();
}

export function loadWatchProgressMap(
  profileId = 'p1'
): Record<string, VodWatchProgressEntry> {
  try {
    const raw = localStorage.getItem(getWatchProgressKeyForProfile(profileId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    for (const key of Object.keys(parsed)) {
      if (parsed[key]?.deviceName) {
        parsed[key].deviceName = sanitizeDeviceName(parsed[key].deviceName);
      }
    }
    return parsed;
  } catch {
    return {};
  }
}

export function saveWatchProgressMap(
  map: Record<string, VodWatchProgressEntry>,
  profileId = 'p1'
): void {
  try {
    localStorage.setItem(
      getWatchProgressKeyForProfile(profileId),
      JSON.stringify(map)
    );
  } catch {
    // ignore
  }
  if (true) {
    try {
      fetch(`/api/tv-progress?profileId=${encodeURIComponent(profileId || 'p1')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(map),
      }).catch(() => { });
    } catch {
      // ignore
    }
  }
}

export function loadSavedVodItems(profileId = 'p1'): CinemetaItem[] {
  try {
    const raw = localStorage.getItem(getSavedVodKeyForProfile(profileId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSavedVodItems(items: CinemetaItem[], profileId = 'p1'): void {
  try {
    localStorage.setItem(
      getSavedVodKeyForProfile(profileId),
      JSON.stringify(items)
    );
  } catch {
    // ignore
  }
  try {
    fetch(`/api/tv-saved?profileId=${encodeURIComponent(profileId || 'p1')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    }).catch(() => { });
  } catch {
    // ignore
  }
}

export function buildVodEmbedUrl(
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
    case 'filelist_torrent':
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

export const SMART_TV_SETTINGS_STORAGE_KEY = 'aether_smart_tv_settings_v2';

export interface SmartTvSettings {
  uiLang: TvUiLang;
  defaultAudioPref: AudioTrackPreference;
  defaultSubLang: 'ro' | 'ru' | 'en' | 'off';
  defaultSubFontSize: TvSubFontSize;
  defaultVideoQuality: TvPreferredQuality;
  defaultVodServer: 'auto_best' | VodServerId;
  osdAutoHideSec: 0 | 3 | 4 | 6 | 10;
  autoFullscreenOnPlay: boolean;
}

export const DEFAULT_SMART_TV_SETTINGS: SmartTvSettings = {
  uiLang: 'ro',
  defaultAudioPref: 'original',
  defaultSubLang: 'ro',
  defaultSubFontSize: 'large',
  defaultVideoQuality: 'max',
  defaultVodServer: 'auto_best',
  osdAutoHideSec: 6,
  autoFullscreenOnPlay: true,
};

export const SMART_TV_AUDIO_OPTIONS: Array<{
  id: AudioTrackPreference;
  label: string;
  desc: string;
}> = [
    {
      id: 'original',
      label: 'Limba Originală (Eng.Original / Original)',
      desc: 'Selectează automat pista audio originală a filmului',
    },
    {
      id: 'ru',
      label: 'RU • Dublaj Rusă (HDRezka / LostFilm / Дубляж)',
      desc: 'Selectează automat dublajul în limba rusă',
    },
    {
      id: 'uk',
      label: 'UA • Dublaj Ucraineană (Українська)',
      desc: 'Selectează automat pista audio în limba ucraineană',
    },
    {
      id: 'first',
      label: '1 • Prima pistă din listă (Default Server)',
      desc: 'Folosește prima pistă audio furnizată de server',
    },
  ];

export const SMART_TV_SUB_LANG_OPTIONS: Array<{
  id: SmartTvSettings['defaultSubLang'];
  label: string;
  desc: string;
}> = [
    {
      id: 'ro',
      label: 'RO • Română (prioritar RO, fallback RU/EN)',
      desc: 'Caută și încarcă automat subtitrarea în limba română',
    },
    {
      id: 'ru',
      label: 'RU • Русский (prioritar RU, fallback RO/EN)',
      desc: 'Caută și încarcă automat subtitrarea în limba rusă',
    },
    {
      id: 'en',
      label: 'EN • English (prioritar EN, fallback RO/RU)',
      desc: 'Caută și încarcă automat subtitrarea în limba engleză',
    },
    {
      id: 'off',
      label: 'Oprit / Выкл (Fără subtitrare automată)',
      desc: 'Nu activa automat subtitrările la pornirea filmului',
    },
  ];

export const SMART_TV_SUB_SIZE_OPTIONS: Array<{
  id: TvSubFontSize;
  label: string;
}> = [
    { id: 'normal', label: 'Normal (100%)' },
    { id: 'large', label: 'Mare — Smart TV (125%)' },
    { id: 'xlarge', label: 'Foarte Mare — Cinema TV (150%)' },
  ];

export const SMART_TV_QUALITY_OPTIONS: Array<{
  id: TvPreferredQuality;
  label: string;
  desc: string;
}> = [
    {
      id: 'max',
      label: 'Maximă Disponibilă (4K UHD / 1080p Full HD)',
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
      label: 'Auto ABR (Adaptiv după viteza internetului)',
      desc: 'Ajustează dinamic calitatea video fără întreruperi',
    },
  ];

export const SMART_TV_SERVER_OPTIONS: Array<{
  id: SmartTvSettings['defaultVodServer'];
  label: string;
  desc: string;
}> = [
    {
      id: 'auto_best',
      label: 'Automat — Cea mai bună calitate (1080p DASH / 4K)',
      desc: 'Alege automat Playerul Nativ 1080p Full HD (DASH/HLS) sau VidSpark 4K',
    },
    {
      id: 'kinogram_hls',
      label: 'S1: Player Nativ HD (Audio Original / RU + Sub RO)',
      desc: 'Playerul nativ Lampa cu selecție piste audio și subtitrări .SRT',
    },
    {
      id: 'filelist_torrent',
      label: 'FileList.io Torrents (4K UHD / 1080p BluRay Live)',
      desc: 'Streaming live direct din contul FileList.io (jeka7ro) cu subtitrare RO',
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

export const SMART_TV_OSD_OPTIONS: Array<{
  id: SmartTvSettings['osdAutoHideSec'];
  label: string;
}> = [
    { id: 3, label: 'După 3 secunde (Rapid)' },
    { id: 4, label: 'După 4 secunde (Standard TV)' },
    { id: 6, label: 'După 6 secunde' },
    { id: 10, label: 'După 10 secunde' },
    { id: 0, label: 'Nu ascunde automat (Mereu vizibil)' },
  ];

export function getSmartTvSettingsKeyForProfile(profileId = 'p1'): string {
  return !profileId || profileId === 'p1'
    ? SMART_TV_SETTINGS_STORAGE_KEY
    : `${SMART_TV_SETTINGS_STORAGE_KEY}_${profileId}`;
}

export function loadSmartTvSettings(profileId = 'p1'): SmartTvSettings {
  try {
    const raw = localStorage.getItem(
      getSmartTvSettingsKeyForProfile(profileId)
    );
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

export function saveSmartTvSettings(next: SmartTvSettings, profileId = 'p1') {
  try {
    localStorage.setItem(
      getSmartTvSettingsKeyForProfile(profileId),
      JSON.stringify(next)
    );
  } catch {
    // ignore
  }
}

export interface StreamingPlatformDef {
  id: StreamingPlatformId;
  addonCode: 'nfx' | 'hbm' | 'atp' | 'dnp' | 'amp' | 'pmp';
  label: string;
  shortBadge: string;
  badgeClass: string;
  accentGradient: string;
  flagshipSeries: CinemetaItem[];
}

export const STREAMING_PLATFORMS: StreamingPlatformDef[] = [
  {
    id: 'netflix',
    addonCode: 'nfx',
    label: 'Netflix',
    shortBadge: 'N',
    badgeClass: 'bg-[#E50914] text-white',
    accentGradient: 'from-[#E50914]/25 via-[#E50914]/5 to-transparent',
    flagshipSeries: [
      { id: 'tt4574334', name: 'Stranger Things', type: 'series', releaseInfo: '2016–2025', imdbRating: '8.6' },
      { id: 'tt10919420', name: 'Squid Game', type: 'series', releaseInfo: '2021–2025', imdbRating: '8.0' },
      { id: 'tt13443470', name: 'Wednesday', type: 'series', releaseInfo: '2022–', imdbRating: '8.0' },
      { id: 'tt13210838', name: 'The Gentlemen', type: 'series', releaseInfo: '2024–', imdbRating: '8.1' },
      { id: 'tt2085059', name: 'Black Mirror', type: 'series', releaseInfo: '2011–', imdbRating: '8.7' },
      { id: 'tt6468322', name: 'Money Heist (La Casa de Papel)', type: 'series', releaseInfo: '2017–2021', imdbRating: '8.2' },
      { id: 'tt13918776', name: 'The Night Agent', type: 'series', releaseInfo: '2023–', imdbRating: '7.4' },
      { id: 'tt2707408', name: 'Narcos', type: 'series', releaseInfo: '2015–2017', imdbRating: '8.7' },
      { id: 'tt5180504', name: 'The Witcher', type: 'series', releaseInfo: '2019–', imdbRating: '7.9' },
      { id: 'tt2442560', name: 'Peaky Blinders', type: 'series', releaseInfo: '2013–2022', imdbRating: '8.7' },
      { id: 'tt5071412', name: 'Ozark', type: 'series', releaseInfo: '2017–2022', imdbRating: '8.5' },
      { id: 'tt5753856', name: 'Dark', type: 'series', releaseInfo: '2017–2020', imdbRating: '8.7' },
    ],
  },
  {
    id: 'hbo',
    addonCode: 'hbm',
    label: 'HBO Max',
    shortBadge: 'HBO',
    badgeClass: 'bg-purple-600 text-white',
    accentGradient: 'from-purple-600/25 via-purple-600/5 to-transparent',
    flagshipSeries: [
      { id: 'tt3581920', name: 'The Last of Us', type: 'series', releaseInfo: '2023–', imdbRating: '8.7' },
      { id: 'tt11198330', name: 'House of the Dragon', type: 'series', releaseInfo: '2022–', imdbRating: '8.4' },
      { id: 'tt15435876', name: 'The Penguin', type: 'series', releaseInfo: '2024', imdbRating: '8.6' },
      { id: 'tt0944947', name: 'Game of Thrones', type: 'series', releaseInfo: '2011–2019', imdbRating: '9.2' },
      { id: 'tt13406094', name: 'The White Lotus', type: 'series', releaseInfo: '2021–', imdbRating: '8.0' },
      { id: 'tt2356777', name: 'True Detective', type: 'series', releaseInfo: '2014–', imdbRating: '8.9' },
      { id: 'tt7660850', name: 'Succession', type: 'series', releaseInfo: '2018–2023', imdbRating: '8.8' },
      { id: 'tt7366338', name: 'Chernobyl', type: 'series', releaseInfo: '2019', imdbRating: '9.3' },
      { id: 'tt8772296', name: 'Euphoria', type: 'series', releaseInfo: '2019–', imdbRating: '8.3' },
      { id: 'tt0141842', name: 'The Sopranos', type: 'series', releaseInfo: '1999–2007', imdbRating: '9.2' },
      { id: 'tt10466872', name: 'Dune: Prophecy', type: 'series', releaseInfo: '2024–', imdbRating: '7.4' },
      { id: 'tt2017109', name: 'Banshee', type: 'series', releaseInfo: '2013–2016', imdbRating: '8.4' },
    ],
  },
  {
    id: 'apple',
    addonCode: 'atp',
    label: 'Apple TV+',
    shortBadge: 'tv+',
    badgeClass: 'bg-zinc-100 text-zinc-950',
    accentGradient: 'from-zinc-200/20 via-zinc-400/5 to-transparent',
    flagshipSeries: [
      { id: 'tt11280740', name: 'Severance', type: 'series', releaseInfo: '2022–', imdbRating: '8.7' },
      { id: 'tt14688458', name: 'Silo', type: 'series', releaseInfo: '2023–', imdbRating: '8.1' },
      { id: 'tt10986410', name: 'Ted Lasso', type: 'series', releaseInfo: '2020–2023', imdbRating: '8.8' },
      { id: 'tt5875444', name: 'Slow Horses', type: 'series', releaseInfo: '2022–', imdbRating: '8.3' },
      { id: 'tt19231492', name: 'Dark Matter', type: 'series', releaseInfo: '2024–', imdbRating: '7.7' },
      { id: 'tt0804484', name: 'Foundation', type: 'series', releaseInfo: '2021–', imdbRating: '7.6' },
      { id: 'tt7203552', name: 'The Morning Show', type: 'series', releaseInfo: '2019–', imdbRating: '8.1' },
      { id: 'tt17677860', name: 'Presumed Innocent', type: 'series', releaseInfo: '2024–', imdbRating: '7.7' },
      { id: 'tt15677150', name: 'Shrinking', type: 'series', releaseInfo: '2023–', imdbRating: '8.1' },
      { id: 'tt7772588', name: 'For All Mankind', type: 'series', releaseInfo: '2019–', imdbRating: '8.1' },
    ],
  },
  {
    id: 'disney',
    addonCode: 'dnp',
    label: 'Disney+',
    shortBadge: 'D+',
    badgeClass: 'bg-sky-500 text-zinc-950',
    accentGradient: 'from-sky-500/25 via-sky-500/5 to-transparent',
    flagshipSeries: [
      { id: 'tt2788316', name: 'Shōgun', type: 'series', releaseInfo: '2024–', imdbRating: '8.6' },
      { id: 'tt14452776', name: 'The Bear', type: 'series', releaseInfo: '2022–', imdbRating: '8.5' },
      { id: 'tt8111088', name: 'The Mandalorian', type: 'series', releaseInfo: '2019–', imdbRating: '8.6' },
      { id: 'tt9253284', name: 'Andor', type: 'series', releaseInfo: '2022–2025', imdbRating: '8.4' },
      { id: 'tt9140554', name: 'Loki', type: 'series', releaseInfo: '2021–2023', imdbRating: '8.2' },
      { id: 'tt12851524', name: 'Only Murders in the Building', type: 'series', releaseInfo: '2021–', imdbRating: '8.1' },
      { id: 'tt13623632', name: 'Alien: Earth', type: 'series', releaseInfo: '2025–', imdbRating: '7.5' },
    ],
  },
  {
    id: 'prime',
    addonCode: 'amp',
    label: 'Prime Video',
    shortBadge: 'PV',
    badgeClass: 'bg-[#00A8E1] text-zinc-950',
    accentGradient: 'from-[#00A8E1]/25 via-[#00A8E1]/5 to-transparent',
    flagshipSeries: [
      { id: 'tt12637874', name: 'Fallout', type: 'series', releaseInfo: '2024–', imdbRating: '8.3' },
      { id: 'tt1190634', name: 'The Boys', type: 'series', releaseInfo: '2019–', imdbRating: '8.7' },
      { id: 'tt9288030', name: 'Reacher', type: 'series', releaseInfo: '2022–', imdbRating: '8.0' },
      { id: 'tt6741278', name: 'Invincible', type: 'series', releaseInfo: '2021–', imdbRating: '8.7' },
      { id: 'tt7631058', name: 'The Lord of the Rings: The Rings of Power', type: 'series', releaseInfo: '2022–', imdbRating: '6.9' },
      { id: 'tt14044212', name: 'Mr. & Mrs. Smith', type: 'series', releaseInfo: '2024–', imdbRating: '7.0' },
      { id: 'tt11743610', name: 'The Terminal List', type: 'series', releaseInfo: '2022–', imdbRating: '7.9' },
      { id: 'tt5057054', name: 'Tom Clancy’s Jack Ryan', type: 'series', releaseInfo: '2018–2023', imdbRating: '8.0' },
    ],
  },
  {
    id: 'paramount',
    addonCode: 'pmp',
    label: 'SkyShowtime',
    shortBadge: 'SKY',
    badgeClass: 'bg-indigo-500 text-white',
    accentGradient: 'from-indigo-500/25 via-indigo-500/5 to-transparent',
    flagshipSeries: [
      { id: 'tt31510819', name: 'MobLand', type: 'series', releaseInfo: '2025–', imdbRating: '8.3' },
      { id: 'tt14186672', name: 'Landman', type: 'series', releaseInfo: '2024–', imdbRating: '8.2' },
      { id: 'tt16358384', name: 'Tulsa King', type: 'series', releaseInfo: '2022–', imdbRating: '8.0' },
      { id: 'tt4236770', name: 'Yellowstone', type: 'series', releaseInfo: '2018–2024', imdbRating: '8.7' },
      { id: 'tt13111078', name: 'Lioness', type: 'series', releaseInfo: '2023–', imdbRating: '7.8' },
      { id: 'tt11712058', name: 'Mayor of Kingstown', type: 'series', releaseInfo: '2021–', imdbRating: '8.2' },
      { id: 'tt18335752', name: '1923', type: 'series', releaseInfo: '2022–2025', imdbRating: '8.3' },
      { id: 'tt13991232', name: '1883', type: 'series', releaseInfo: '2021–2022', imdbRating: '8.7' },
      { id: 'tt32252772', name: 'Dexter: Original Sin', type: 'series', releaseInfo: '2024–', imdbRating: '8.2' },
      { id: 'tt24053860', name: 'The Day of the Jackal', type: 'series', releaseInfo: '2024–', imdbRating: '8.2' },
      { id: 'tt2934286', name: 'Halo', type: 'series', releaseInfo: '2022–2024', imdbRating: '7.3' },
    ],
  },
];

export function isStreamingPlatformSection(
  sec: TvSectionId
): sec is StreamingPlatformId {
  return (
    sec === 'netflix' ||
    sec === 'hbo' ||
    sec === 'apple' ||
    sec === 'disney' ||
    sec === 'prime' ||
    sec === 'paramount'
  );
}

/**
 * Extracts the production year from a VOD item (`releaseInfo`, `year`, or `released`)
 * so catalogs can be sorted newest-first (2026 -> 2025 -> 2024 -> ...).
 */
export function extractVodProductionYear(item: {
  releaseInfo?: string;
  year?: string | number;
  released?: string;
}): number {
  const raw = String(
    item.releaseInfo || item.year || item.released || ''
  ).trim();
  const matches = raw.match(/\b(19\d{2}|20\d{2})\b/g);
  if (matches && matches.length > 0) {
    return Math.max(...matches.map((m) => parseInt(m, 10)));
  }
  return 0;
}

export const extractProductionYear = extractVodProductionYear;

/**
 * Sorts VOD items strictly by newest production year first, using release date and IMDb rating as tie-breakers.
 */
export function sortVodItemsByProductionYear<
  T extends {
    releaseInfo?: string;
    year?: string | number;
    released?: string;
    imdbRating?: string;
  },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const yearA = extractVodProductionYear(a);
    const yearB = extractVodProductionYear(b);
    if (yearB !== yearA) {
      return yearB - yearA;
    }
    const dateA = a.released ? Date.parse(a.released) || 0 : 0;
    const dateB = b.released ? Date.parse(b.released) || 0 : 0;
    if (dateB !== dateA) {
      return dateB - dateA;
    }
    const ratingA = parseFloat(String(a.imdbRating || '0')) || 0;
    const ratingB = parseFloat(String(b.imdbRating || '0')) || 0;
    return ratingB - ratingA;
  });
}

export interface YouTubeVideoCardItem {
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  durationSec: number;
  views: string;
  published: string;
  thumb: string;
  isLive?: boolean;
}

export interface YouTubeCategoryDef {
  id: string;
  label: string;
  query: string;
}

export const YOUTUBE_CATEGORIES: YouTubeCategoryDef[] = [
  { id: 'trending_ro', label: '🔥 Trending RO', query: 'trending romania 2026 oficial' },
  { id: 'music_ro', label: '🎵 Muzică RO 4K', query: 'muzica romaneasca noua oficial 4k' },
  { id: 'podcasts_ro', label: '🎙️ Podcasturi RO', query: 'podcast romania 2026 episod complet' },
  { id: 'comedy_ro', label: '😂 Stand-Up & Umor', query: 'stand up comedy romania complet' },
  { id: 'movies_ro', label: '🎬 Filme & Documentare', query: 'documentar romania istorie natura hd' },
  { id: 'manele_party', label: '🎉 Petrecere & Hits', query: 'muzica de petrecere top hituri romania' },
  { id: 'hits_intl', label: '🌍 Top Hits Global', query: 'top music videos 4k hits official' },
  { id: 'kids_ro', label: '🧸 Pentru Copii', query: 'desene animate in romana episoade complete' },
];




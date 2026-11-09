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
  loadSharedActiveProfileId,
  saveSharedActiveProfileId,
  isLocalHomeServer,
  isAdminJekaProfile,
  canProfileAccessAdult,
  canProfileAccessIedem,
  getActiveProfileMediaPrefs,
  saveActiveProfileMediaPrefs,
} from "../services/deviceContinuityService";

export { isAdminJekaProfile, canProfileAccessAdult, canProfileAccessIedem };
import {
  DEFAULT_SEED_PROGRESS_BY_PROFILE,
  DEFAULT_SEED_SAVED_BY_PROFILE,
} from "../services/defaultSeedData";
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
  | 'uhd_4k'
  | 'iedem_vod'
  | 'ru_shows'
  | StreamingPlatformId
  | 'youtube'
  | 'torrents'
  | 'tv'
  | 'radio'
  | 'music'
  | 'catalog'
  | 'filter'
  | 'saved'
  | 'downloads'
  | 'calendar'
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

export type SubtitleLangId = 'ro' | 'ru' | 'en' | 'es' | 'fr' | 'de';

export interface CinemetaItem {
  id: string;
  imdbId?: string;
  kpId?: string;
  iedemFid?: number;
  iedemStreamUrl?: string;
  flTorrentId?: number;
  releaseTitle?: string;
  sizeFormatted?: string;
  seeders?: number;
  freeleech?: boolean;
  isRo?: boolean;
  qualityBadge?: string;
  networkBadge?: string;
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
  seasonsCount?: number;
  episodesCount?: number;
  klubnichkaRawId?: string;
  klubnichkaEmbedUrl?: string;
  isAdultKlubnichka?: boolean;
}

export interface SeriesEpisodeStats {
  seasonsCount: number;
  episodesCount: number;
  episodesBySeason?: Record<number, number>;
}

const SERIES_EP_STATS_MEM_CACHE = new Map<string, SeriesEpisodeStats>();
const SERIES_EP_STATS_INFLIGHT = new Map<string, Promise<SeriesEpisodeStats | null>>();

export function getCachedSeriesEpisodeStats(
  itemOrId?: CinemetaItem | string | null
): SeriesEpisodeStats | null {
  if (!itemOrId) return null;
  const id = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
  if (!id) return null;
  const mem = SERIES_EP_STATS_MEM_CACHE.get(id);
  if (mem && mem.episodesCount > 0) return mem;

  if (typeof itemOrId === 'object' && itemOrId) {
    if (itemOrId.episodesCount && itemOrId.episodesCount > 0) {
      return {
        seasonsCount: itemOrId.seasonsCount || 1,
        episodesCount: itemOrId.episodesCount,
      };
    }
    const rawTitle = `${itemOrId.releaseTitle || ''} ${itemOrId.name || ''}`;
    const rangeMatch = rawTitle.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:сери|ep|еп)/i);
    if (rangeMatch && Number(rangeMatch[2]) > 0) {
      return {
        seasonsCount: 1,
        episodesCount: Number(rangeMatch[2]),
      };
    }
    const seMatch = rawTitle.match(/\bS(\d{1,2})[.\s_-]*E(\d{1,3})\b/i);
    if (seMatch && Number(seMatch[2]) > 0) {
      return {
        seasonsCount: Number(seMatch[1]) || 1,
        episodesCount: Number(seMatch[2]),
      };
    }
  }
  return null;
}

export async function resolveSeriesEpisodeStats(
  item: CinemetaItem
): Promise<SeriesEpisodeStats | null> {
  if (!item || item.type !== 'series' || !item.id) return null;
  const cached = SERIES_EP_STATS_MEM_CACHE.get(item.id);
  if (cached && cached.episodesCount > 0) return cached;

  const inflight = SERIES_EP_STATS_INFLIGHT.get(item.id);
  if (inflight) return inflight;

  const task = (async (): Promise<SeriesEpisodeStats | null> => {
    try {
      const rawImdb = String(
        item.imdbId || (item.id.startsWith('tt') ? item.id.split(':')[0] : '')
      ).trim();
      const rawKp = String(
        item.kpId || (item.id.startsWith('kp_') ? item.id.replace(/^kp_/, '') : '')
      ).trim();
      const rawIedem =
        item.iedemFid ||
        (item.id.startsWith('iedem_')
          ? Number(item.id.replace(/^iedem_/, ''))
          : 0);

      // 1. iEdem multistream series
      if (rawIedem > 0) {
        const res = await fetch(
          `/api/iedem-vod?action=item&fid=${encodeURIComponent(String(rawIedem))}`
        );
        if (res.ok) {
          const d = await res.json();
          if (Array.isArray(d?.items) && d.items.length > 0) {
            const seasonMatch = String(item.name || '').match(/Сезон\s*(\d+)/i);
            const sNum = seasonMatch ? Number(seasonMatch[1]) || 1 : 1;
            const stats: SeriesEpisodeStats = {
              seasonsCount: sNum,
              episodesCount: d.items.length,
              episodesBySeason: { [sNum]: d.items.length },
            };
            SERIES_EP_STATS_MEM_CACHE.set(item.id, stats);
            return stats;
          }
        }
      }

      // 2. Cinemeta by IMDb ID (never search Cinemeta by Cyrillic title — avoids false anime matches)
      let targetImdb = rawImdb.startsWith('tt') ? rawImdb : '';
      if (
        !targetImdb &&
        !rawKp &&
        item.name &&
        /[a-zA-Z]/.test(item.name) &&
        !isRussianVodItem(item)
      ) {
        const cleanTitle = item.name
          .replace(/\(\d{4}\)/g, '')
          .replace(/\[.*?\]/g, '')
          .replace(/\bS\d{1,2}.*$/i, '')
          .trim();
        if (cleanTitle.length >= 2) {
          const sRes = await fetch(
            `https://v3-cinemeta.strem.io/catalog/series/top/search=${encodeURIComponent(
              cleanTitle
            )}.json`
          );
          if (sRes.ok) {
            const sData = await sRes.json();
            const firstTt = sData?.metas?.[0]?.id;
            if (typeof firstTt === 'string' && firstTt.startsWith('tt')) {
              targetImdb = firstTt;
            }
          }
        }
      }

      if (targetImdb) {
        const res = await fetch(
          `https://v3-cinemeta.strem.io/meta/series/${targetImdb}.json`
        );
        if (res.ok) {
          const d = await res.json();
          const videos = d?.meta?.videos;
          if (Array.isArray(videos) && videos.length > 0) {
            const episodesBySeason: Record<number, number> = {};
            let totalEps = 0;
            for (const v of videos) {
              const sNum = Number(v?.season);
              const eNum = Number(v?.episode ?? v?.number);
              if (sNum > 0 && eNum > 0) {
                episodesBySeason[sNum] = (episodesBySeason[sNum] || 0) + 1;
                totalEps++;
              }
            }
            const seasonsCount = Object.keys(episodesBySeason).length;
            if (totalEps > 0) {
              const stats: SeriesEpisodeStats = {
                seasonsCount: Math.max(1, seasonsCount),
                episodesCount: totalEps,
                episodesBySeason,
              };
              SERIES_EP_STATS_MEM_CACHE.set(item.id, stats);
              if (targetImdb !== item.id) {
                SERIES_EP_STATS_MEM_CACHE.set(targetImdb, stats);
              }
              return stats;
            }
          }
        }
      }

      // 3. Kinopoisk /seasons endpoint
      if (rawKp) {
        const kpRes = await fetch(
          `https://kinopoiskapiunofficial.tech/api/v2.2/films/${encodeURIComponent(
            rawKp
          )}/seasons`,
          {
            headers: {
              'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
            },
          }
        );
        if (kpRes.ok) {
          const kpSeasons = await kpRes.json();
          if (Array.isArray(kpSeasons?.items) && kpSeasons.items.length > 0) {
            const episodesBySeason: Record<number, number> = {};
            let totalEps = 0;
            for (const sObj of kpSeasons.items) {
              const sNum = Number(sObj?.number) || 1;
              const epLen = Array.isArray(sObj?.episodes)
                ? sObj.episodes.length
                : 0;
              if (sNum > 0 && epLen > 0) {
                episodesBySeason[sNum] = epLen;
                totalEps += epLen;
              }
            }
            if (totalEps > 0) {
              const stats: SeriesEpisodeStats = {
                seasonsCount: Math.max(
                  1,
                  Object.keys(episodesBySeason).length || Number(kpSeasons.total) || 1
                ),
                episodesCount: totalEps,
                episodesBySeason,
              };
              SERIES_EP_STATS_MEM_CACHE.set(item.id, stats);
              return stats;
            }
          }
        }
      }
    } catch {
      // ignore network error
    }
    return getCachedSeriesEpisodeStats(item);
  })();

  SERIES_EP_STATS_INFLIGHT.set(item.id, task);
  try {
    return await task;
  } finally {
    SERIES_EP_STATS_INFLIGHT.delete(item.id);
  }
}

export function formatSeriesCardBadgeText(
  item: CinemetaItem,
  stats: SeriesEpisodeStats | null | undefined,
  tr: (ro: string, en: string, ru: string) => string
): string {
  const eff = stats || getCachedSeriesEpisodeStats(item);
  if (!eff || eff.episodesCount <= 0) {
    return tr('SERIAL', 'SERIES', 'СЕРИАЛ');
  }
  if (eff.seasonsCount > 1) {
    return tr(
      `SERIAL • ${eff.seasonsCount}S ${eff.episodesCount}E`,
      `SERIES • ${eff.seasonsCount}S ${eff.episodesCount}E`,
      `СЕРИАЛ • ${eff.seasonsCount}С ${eff.episodesCount}СЕР`
    );
  }
  return tr(
    `SERIAL • ${eff.episodesCount} EP.`,
    `SERIES • ${eff.episodesCount} EP.`,
    `СЕРИАЛ • ${eff.episodesCount} СЕР.`
  );
}

export function isRussianVodItem(
  item: Partial<CinemetaItem> | null | undefined
): boolean {
  if (!item) return false;
  if (
    item.iedemFid ||
    String(item.id || '').startsWith('iedem_')
  ) {
    return true;
  }
  if (item.country) {
    if (/(Росси|СССР|Russia|USSR|Soviet|Беларус)/i.test(item.country)) {
      return true;
    }
    if (
      /(United States|USA|США|UK|United Kingdom|Великобритани|France|Франци|Germany|Германи|Spain|Испани|Italy|Итали|Canada|Канад|Japan|Япони|Korea|Коре|China|Китай|Turkey|Турци|Romania|România|Australia|Австрали)/i.test(
        item.country
      )
    ) {
      return false;
    }
  }
  const hasCyrillicName = /[а-яёА-ЯЁ]/.test(String(item.name || ''));
  const hasLatinOrig = /[a-zA-Z]/.test(String(item.nameOriginal || ''));
  if (hasCyrillicName && !hasLatinOrig) {
    return true;
  }
  if (String(item.id || '').startsWith('kp_') && !hasLatinOrig) {
    return true;
  }
  return false;
}

export function getVodCardRatingInfo(
  item: Partial<CinemetaItem> | null | undefined
): { source: 'IMDb' | 'KP'; value: string; isRussian: boolean } {
  const isRu = isRussianVodItem(item);
  const rawPrimary = isRu
    ? item?.ratingKinopoisk || item?.imdbRating
    : item?.imdbRating || item?.ratingKinopoisk;
  const parsed = parseFloat(String(rawPrimary || '').replace(',', '.'));
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 10) {
    return {
      source: isRu ? 'KP' : 'IMDb',
      value: parsed.toFixed(1),
      isRussian: isRu,
    };
  }
  const seedKey = String(item?.id || item?.name || 'vod');
  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) {
    hash = (hash * 31 + seedKey.charCodeAt(i)) >>> 0;
  }
  const fallbackVal = (7.4 + (hash % 6) * 0.1).toFixed(1);
  return {
    source: isRu ? 'KP' : 'IMDb',
    value: fallbackVal,
    isRussian: isRu,
  };
}

export function formatSeriesCardSubtitleText(
  item: CinemetaItem,
  stats: SeriesEpisodeStats | null | undefined,
  tr: (ro: string, en: string, ru: string) => string
): string {
  const yearStr = item.releaseInfo || item.year || '2026';
  if (item.type !== 'series') {
    return `${yearStr} • ${tr('Film', 'Movie', 'Фильм')}`;
  }
  const eff = stats || getCachedSeriesEpisodeStats(item);
  if (!eff || eff.episodesCount <= 0) {
    return `${yearStr} • ${tr('Serial', 'TV Series', 'Сериал')}`;
  }
  if (eff.seasonsCount > 1) {
    return `${yearStr} • ${tr(
      `${eff.seasonsCount} Sez. (${eff.episodesCount} Ep.)`,
      `${eff.seasonsCount} Seasons (${eff.episodesCount} Ep.)`,
      `${eff.seasonsCount} Сез. (${eff.episodesCount} Сер.)`
    )}`;
  }
  return `${yearStr} • ${tr(
    `Serial • ${eff.episodesCount} Ep.`,
    `Series • ${eff.episodesCount} Ep.`,
    `Сериал • ${eff.episodesCount} Сер.`
  )}`;
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
  provider?: 'filelist' | 'torrentio' | 'kinozal';
  source?: 'filelist' | 'torrentio' | 'kinozal';
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
  embedUrl?: string;
  title?: string;
  duration?: number;
  audioNames?: string[];
  vkQualities?: Array<{
    id: string;
    height: number;
    label: string;
    url: string;
  }>;
  seasons?: Array<{
    season: number;
    episodes: Array<{
      episode: number;
      title: string;
      thumbnail?: string;
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
  deviceId?: string;
  isPlayingNow?: boolean;
  totalEpisodesInSeason?: number;
  totalSeasons?: number;
  episodeProgressMap?: Record<string, EpisodeProgress>;
  episodesSortDesc?: boolean;
}

export const SERIES_EPISODE_SORT_STORAGE_KEY = 'aether_series_episode_sort_v1';

export function loadSeriesEpisodeSortDesc(
  seriesId?: string | null,
  progressEntry?: VodWatchProgressEntry | null
): boolean {
  if (!seriesId) return false;
  if (typeof progressEntry?.episodesSortDesc === 'boolean') {
    return progressEntry.episodesSortDesc;
  }
  try {
    const raw = localStorage.getItem(SERIES_EPISODE_SORT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string | boolean>;
      if (parsed && typeof parsed === 'object' && seriesId in parsed) {
        return parsed[seriesId] === 'desc' || parsed[seriesId] === true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

export function saveSeriesEpisodeSortDesc(
  seriesId: string,
  desc: boolean
): void {
  if (!seriesId) return;
  try {
    const raw = localStorage.getItem(SERIES_EPISODE_SORT_STORAGE_KEY);
    const parsed: Record<string, 'asc' | 'desc'> = raw ? JSON.parse(raw) : {};
    parsed[seriesId] = desc ? 'desc' : 'asc';
    localStorage.setItem(
      SERIES_EPISODE_SORT_STORAGE_KEY,
      JSON.stringify(parsed)
    );
  } catch {
    // ignore
  }
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
  allowAdultContent?: boolean;
  allowIedemContent?: boolean;
  uiLang?: TvUiLang;
  tvTheme?: 'dark' | 'ambient';
  updatedAt?: number;
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

export function saveTvProfiles(
  profiles: SmartTvProfile[],
  options?: { allowShrink?: boolean }
): void {
  saveSharedProfiles(profiles, options);
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
    { id: 'FAV', label: '★ Favourites', labelEn: '★ Favourites', labelRu: '★ Favourites', country: 'FAV' },
    { id: 'IEDEM', label: 'iEdem / Playlist M3U', labelEn: 'iEdem / M3U Playlist', labelRu: 'iEdem / Плейлист M3U', country: 'IEDEM' },
    { id: 'RO', label: 'RO • România HD', labelEn: 'RO • Romania HD', labelRu: 'RO • Румыния HD', country: 'RO' },
    { id: 'MD', label: 'MD • Moldova HD', labelEn: 'MD • Moldova HD', labelRu: 'MD • Молдова HD', country: 'MD' },
    { id: 'RU', label: 'RU • Rusia', labelEn: 'RU • Russia', labelRu: 'RU • Россия', country: 'RU' },
    { id: 'ADULT', label: '18+ Adulți', labelEn: '18+ Adult', labelRu: '18+ Для взрослых', country: 'ADULT' },
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
    id: 'filelist_torrent',
    label: 'S1: FileList.io & Kinozal VIP (4K UHD / 1080p BluRay)',
  },
  {
    id: 'kinogram_hls',
    label: 'S2: iEdem VIP MediaLibrary (1080p Full HD)',
  },
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
  const seedMap =
    (DEFAULT_SEED_PROGRESS_BY_PROFILE[profileId] as Record<
      string,
      VodWatchProgressEntry
    >) || {};
  try {
    const localFl = isLocalHomeServer();
    const sanitizeMap = (
      m: Record<string, VodWatchProgressEntry>
    ): Record<string, VodWatchProgressEntry> => {
      const out: Record<string, VodWatchProgressEntry> = {};
      for (const [key, val] of Object.entries(m)) {
        if (!val || typeof val !== 'object' || !val.item) continue;
        const nextVal: VodWatchProgressEntry = { ...val };
        if (nextVal.deviceName) {
          nextVal.deviceName = sanitizeDeviceName(nextVal.deviceName);
        }
        if (
          !localFl &&
          (nextVal.server === 'filelist_torrent' ||
            nextVal.server === 'vidspark')
        ) {
          nextVal.server = 'kinogram_hls';
        }
        if (nextVal.episodeProgressMap && typeof nextVal.episodeProgressMap === 'object') {
          const cleanEpMap: typeof nextVal.episodeProgressMap = {};
          let hadCorrupted4500 = false;
          for (const [epK, epV] of Object.entries(nextVal.episodeProgressMap)) {
            if (!epV || typeof epV !== 'object') continue;
            if (epV.duration === 4500 && epV.currentTime >= 2500) {
              hadCorrupted4500 = true;
              continue;
            }
            cleanEpMap[epK] = epV;
          }
          if (
            key === 'tt31510819' &&
            (hadCorrupted4500 ||
              (nextVal.season === 2 &&
                nextVal.episode === 3 &&
                (nextVal.currentTime || 0) < 120))
          ) {
            delete cleanEpMap['S2E1'];
            if ((cleanEpMap['S2E3']?.currentTime || 0) < 120) {
              delete cleanEpMap['S2E3'];
            }
            nextVal.season = 2;
            nextVal.episode = 1;
            nextVal.currentTime = 0;
            if (localFl) {
              nextVal.server = 'filelist_torrent';
            }
          }
          nextVal.episodeProgressMap = cleanEpMap;
        }
        out[key] = nextVal;
      }
      return out;
    };
    const storageKey = getWatchProgressKeyForProfile(profileId);
    const seedAppliedKey = `filmio_seed_progress_v3_${profileId}`;
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : null;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (Object.keys(parsed).length === 0 &&
        Object.keys(seedMap).length > 0 &&
        !localStorage.getItem(seedAppliedKey))
    ) {
      if (Object.keys(seedMap).length > 0) {
        const cloned = sanitizeMap(seedMap);
        localStorage.setItem(storageKey, JSON.stringify(cloned));
        localStorage.setItem(seedAppliedKey, '1');
        return cloned;
      }
      return {};
    }
    let mergedFromSeed = false;
    for (const [k, seedEntry] of Object.entries(seedMap)) {
      if (!seedEntry || typeof seedEntry !== 'object' || !seedEntry.item) continue;
      const existing = parsed[k];
      if (!existing) {
        parsed[k] = { ...seedEntry };
        mergedFromSeed = true;
      } else {
        const existingCleared =
          (existing.currentTime || 0) === 0 &&
          (!existing.episodeProgressMap ||
            Object.keys(existing.episodeProgressMap).length === 0) &&
          (existing.updatedAt || 0) > (seedEntry.updatedAt || 0);
        if (!existingCleared) {
          const mergedEpMap = {
            ...(seedEntry.episodeProgressMap || {}),
            ...(existing.episodeProgressMap || {}),
          };
          if (seedEntry.episodeProgressMap && existing.episodeProgressMap) {
            for (const [epK, epV] of Object.entries(seedEntry.episodeProgressMap)) {
              const curEp = existing.episodeProgressMap[epK];
              if (!curEp || (epV?.updatedAt || 0) > (curEp?.updatedAt || 0)) {
                mergedEpMap[epK] = epV;
              }
            }
          }
          if ((seedEntry.updatedAt || 0) > (existing.updatedAt || 0)) {
            parsed[k] = {
              ...existing,
              ...seedEntry,
              episodeProgressMap: mergedEpMap,
            };
            mergedFromSeed = true;
          } else if (
            Object.keys(mergedEpMap).length >
            Object.keys(existing.episodeProgressMap || {}).length
          ) {
            parsed[k] = {
              ...existing,
              episodeProgressMap: mergedEpMap,
            };
            mergedFromSeed = true;
          }
        }
      }
    }
    if (mergedFromSeed) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(parsed));
      } catch {
        // ignore
      }
    }
    return sanitizeMap(parsed);
  } catch {
    return { ...seedMap };
  }
}

export function saveWatchProgressMap(
  map: Record<string, VodWatchProgressEntry>,
  profileId = 'p1'
): void {
  const cleanProf = encodeURIComponent(profileId || 'p1');
  try {
    localStorage.setItem(
      getWatchProgressKeyForProfile(profileId),
      JSON.stringify(map)
    );
    localStorage.setItem(`filmio_seed_progress_v3_${profileId}`, '1');
  } catch {
    // ignore
  }
  const payload = JSON.stringify(map);
  try {
    fetch(`/api/tv-progress?profileId=${cleanProf}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }).catch(() => {});
  } catch {
    // ignore
  }
  if (isLocalHomeServer()) {
    try {
      fetch(`https://filmio.my/api/tv-progress?profileId=${cleanProf}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      }).catch(() => {});
    } catch {
      // ignore
    }
  }
}

export function loadSavedVodItems(profileId = 'p1'): CinemetaItem[] {
  const seedList =
    (DEFAULT_SEED_SAVED_BY_PROFILE[profileId] as CinemetaItem[]) || [];
  try {
    const storageKey = getSavedVodKeyForProfile(profileId);
    const seedSavedKey = `filmio_seed_saved_v3_${profileId}`;
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed) || (parsed.length === 0 && seedList.length > 0)) {
      if (seedList.length > 0) {
        const cloned = [...seedList];
        localStorage.setItem(storageKey, JSON.stringify(cloned));
        localStorage.setItem(seedSavedKey, '1');
        return cloned;
      }
      return [];
    }
    if (!localStorage.getItem(seedSavedKey) && seedList.length > 0) {
      const seen = new Set(parsed.map((x: CinemetaItem) => x?.id).filter(Boolean));
      const merged = [...parsed];
      let added = false;
      for (const item of seedList) {
        if (item && item.id && !seen.has(item.id)) {
          seen.add(item.id);
          merged.push(item);
          added = true;
        }
      }
      localStorage.setItem(seedSavedKey, '1');
      if (added) {
        localStorage.setItem(storageKey, JSON.stringify(merged));
        return merged;
      }
    }
    return parsed;
  } catch {
    return [...seedList];
  }
}

export function saveSavedVodItems(items: CinemetaItem[], profileId = 'p1'): void {
  const cleanProf = encodeURIComponent(profileId || 'p1');
  try {
    localStorage.setItem(
      getSavedVodKeyForProfile(profileId),
      JSON.stringify(items)
    );
    localStorage.setItem(`filmio_seed_saved_v3_${profileId}`, '1');
  } catch {
    // ignore
  }
  const payload = JSON.stringify(items);
  try {
    fetch(`/api/tv-saved?profileId=${cleanProf}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }).catch(() => {});
  } catch {
    // ignore
  }
  if (isLocalHomeServer()) {
    try {
      fetch(`https://filmio.my/api/tv-saved?profileId=${cleanProf}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      }).catch(() => {});
    } catch {
      // ignore
    }
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
  const rawItemImdb = String(
    (item as { imdbId?: string; imdb_id?: string }).imdbId ||
      (item as { imdbId?: string; imdb_id?: string }).imdb_id ||
      ''
  ).trim();
  const imdbId = item.id.startsWith('tt')
    ? item.id.split(':')[0]
    : rawItemImdb.startsWith('tt')
      ? rawItemImdb.split(':')[0]
      : fallbackImdbId && fallbackImdbId.startsWith('tt')
        ? fallbackImdbId.split(':')[0]
        : '';
  const kpId =
    item.kpId || (item.id.startsWith('kp_') ? item.id.replace(/^kp_/, '') : '');
  const tmdbOrImdbId = item.moviedb_id
    ? String(item.moviedb_id)
    : imdbId || kpId;
  const isSeries = item.type === 'series';
  const start = Math.max(0, Math.floor(startSeconds || 0));

  // If no IMDb ID or TMDB ID is available and only kpId exists, fallback to Kinogram embed
  if (!imdbId && !item.moviedb_id && kpId) {
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
    case 'vidspark':
    case 'vidzee':
    case 'nontongo':
    case 'vidsrc_pm': {
      const params = new URLSearchParams();
      params.set('autoplay', 'true');
      params.set('ds_lang', subLang);
      if (start > 5) {
        params.set('startAt', String(start));
        params.set('t', String(start));
      }
      return isSeries
        ? `https://vidsrc.pm/embed/tv/${imdbId || tmdbOrImdbId}/${season}/${episode}?${params.toString()}`
        : `https://vidsrc.pm/embed/movie/${imdbId || tmdbOrImdbId}?${params.toString()}`;
    }
  }
}

export const SMART_TV_SETTINGS_STORAGE_KEY = 'aether_smart_tv_settings_v2';

export interface SmartTvSettings {
  uiLang: TvUiLang;
  defaultAudioPref: AudioTrackPreference;
  defaultSubLang: 'ro' | 'ru' | 'en' | 'es' | 'fr' | 'de' | 'off';
  defaultSubFontSize: TvSubFontSize;
  defaultSubFontPx?: number;
  defaultVideoQuality: TvPreferredQuality;
  defaultVodServer: 'auto_best' | VodServerId;
  osdAutoHideSec: 0 | 3 | 4 | 6 | 10;
  autoFullscreenOnPlay: boolean;
  tvTheme?: 'dark' | 'ambient';
}

export const DEFAULT_SMART_TV_SETTINGS: SmartTvSettings = {
  uiLang: 'ro',
  defaultAudioPref: 'original',
  defaultSubLang: 'ro',
  defaultSubFontSize: 'large',
  defaultSubFontPx: 24,
  defaultVideoQuality: 'max',
  defaultVodServer: 'auto_best',
  osdAutoHideSec: 6,
  autoFullscreenOnPlay: true,
  tvTheme: 'dark',
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
      id: 'ro',
      label: 'RO • Română (Dublaj / Audio RO când este disponibil)',
      desc: 'Selectează automat pista audio în limba română (sau original dacă nu există)',
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
      id: 'es',
      label: 'ES • Español (prioritar ES)',
      desc: 'Caută și încarcă automat subtitrarea în limba spaniolă',
    },
    {
      id: 'fr',
      label: 'FR • Français (prioritar FR)',
      desc: 'Caută și încarcă automat subtitrarea în limba franceză',
    },
    {
      id: 'de',
      label: 'DE • Deutsch (prioritar DE)',
      desc: 'Caută și încarcă automat subtitrarea în limba germană',
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
      label: 'Automat — FileList.io + Kinozal + iEdem VIP (4K UHD / 1080p)',
      desc: 'Selectează automat cea mai bună sursă plătită (FileList VIP, Kinozal VIP sau iEdem MediaLibrary)',
    },
    {
      id: 'filelist_torrent',
      label: 'S1: FileList.io & Kinozal VIP (4K UHD / 1080p BluRay)',
      desc: 'Streaming direct din conturile VIP FileList.io (jeka7ro) și Kinozal (popescu20210)',
    },
    {
      id: 'kinogram_hls',
      label: 'S2: iEdem VIP MediaLibrary (1080p Full HD)',
      desc: 'Playerul nativ cu flux direct HLS din iEdem MediaLibrary',
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

export function loadSmartTvSettings(profileId?: string): SmartTvSettings {
  const targetPid = profileId || loadSharedActiveProfileId() || 'p1';
  try {
    const profileMedia = getActiveProfileMediaPrefs(targetPid);
    const raw = localStorage.getItem(
      getSmartTvSettingsKeyForProfile(targetPid)
    );
    const parsed: Partial<SmartTvSettings> = raw ? JSON.parse(raw) : {};
    const explicitTheme = localStorage.getItem(`aether_tv_theme_${targetPid}`);
    const resolvedTheme: 'dark' | 'ambient' =
      explicitTheme === 'ambient' || explicitTheme === 'dark'
        ? explicitTheme
        : parsed.tvTheme === 'ambient' || parsed.tvTheme === 'dark'
          ? parsed.tvTheme
          : profileMedia.tvTheme === 'ambient' || profileMedia.tvTheme === 'dark'
            ? profileMedia.tvTheme
            : DEFAULT_SMART_TV_SETTINGS.tvTheme || 'dark';
    const merged: SmartTvSettings = {
      ...DEFAULT_SMART_TV_SETTINGS,
      ...parsed,
      defaultAudioPref: profileMedia.defaultAudioPref || parsed.defaultAudioPref || DEFAULT_SMART_TV_SETTINGS.defaultAudioPref,
      defaultSubLang: profileMedia.defaultSubLang || parsed.defaultSubLang || DEFAULT_SMART_TV_SETTINGS.defaultSubLang,
      defaultSubFontSize: profileMedia.defaultSubFontSize || parsed.defaultSubFontSize || DEFAULT_SMART_TV_SETTINGS.defaultSubFontSize,
      defaultSubFontPx: profileMedia.defaultSubFontPx || parsed.defaultSubFontPx || DEFAULT_SMART_TV_SETTINGS.defaultSubFontPx,
      tvTheme: resolvedTheme,
    };
    if (merged.defaultVodServer === 'filelist_torrent' && !isLocalHomeServer()) {
      merged.defaultVodServer = 'auto_best';
    }
    return merged;
  } catch {
    return DEFAULT_SMART_TV_SETTINGS;
  }
}

export function saveSmartTvSettings(next: SmartTvSettings, profileId?: string) {
  const targetPid = profileId || loadSharedActiveProfileId() || 'p1';
  try {
    const resolvedTheme = next.tvTheme === 'ambient' ? 'ambient' : 'dark';
    const cleanNext: SmartTvSettings = {
      ...next,
      tvTheme: resolvedTheme,
    };
    localStorage.setItem(
      getSmartTvSettingsKeyForProfile(targetPid),
      JSON.stringify(cleanNext)
    );
    localStorage.setItem(`aether_tv_theme_${targetPid}`, resolvedTheme);
    saveActiveProfileMediaPrefs(
      {
        defaultAudioPref: cleanNext.defaultAudioPref,
        defaultSubLang: cleanNext.defaultSubLang,
        defaultSubFontSize: cleanNext.defaultSubFontSize,
        defaultSubFontPx:
          cleanNext.defaultSubFontPx ||
          (cleanNext.defaultSubFontSize === 'normal'
            ? 20
            : cleanNext.defaultSubFontSize === 'xlarge'
              ? 30
              : 24),
        tvTheme: resolvedTheme,
      },
      targetPid
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
    ratingKinopoisk?: string;
  },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const yearA = extractVodProductionYear(a);
    const yearB = extractVodProductionYear(b);
    if (yearB !== yearA) {
      return yearB - yearA;
    }
    const ratingA = parseFloat(String(a.imdbRating || a.ratingKinopoisk || '0')) || 0;
    const ratingB = parseFloat(String(b.imdbRating || b.ratingKinopoisk || '0')) || 0;
    const hasRatingA = ratingA > 0 ? 1 : 0;
    const hasRatingB = ratingB > 0 ? 1 : 0;
    if (hasRatingB !== hasRatingA) {
      return hasRatingB - hasRatingA;
    }
    const dateA = a.released ? Date.parse(a.released) || 0 : 0;
    const dateB = b.released ? Date.parse(b.released) || 0 : 0;
    if (dateB !== dateA) {
      return dateB - dateA;
    }
    return ratingB - ratingA;
  });
}

function normalizeVodTitleKey(raw?: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/\s*\(s\d+[^)]*\)\s*/gi, ' ')
    .replace(/\bs\d{1,2}[.\s_-]*e\d{1,2}\b/gi, ' ')
    .replace(/\b(сезон|season|sezonul)\s*\d+\b/gi, ' ')
    .replace(/\(\d{4}(?:[-–]\d{0,4})?\)/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

export function deduplicateVodItems(
  items: CinemetaItem[],
  searchQuery?: string
): CinemetaItem[] {
  const result: CinemetaItem[] = [];
  const byImdb = new Map<string, number>();
  const byKp = new Map<string, number>();
  const byTitleKey = new Map<string, number>();

  const mergeTwo = (base: CinemetaItem, incoming: CinemetaItem): CinemetaItem => {
    const baseIsImdb = base.id.startsWith('tt');
    const incIsImdb = incoming.id.startsWith('tt');
    const baseRating = parseFloat(String(base.imdbRating || base.ratingKinopoisk || '0')) || 0;
    const incRating = parseFloat(String(incoming.imdbRating || incoming.ratingKinopoisk || '0')) || 0;
    const baseYear = extractVodProductionYear(base);
    const incYear = extractVodProductionYear(incoming);

    const preferIncomingAsPrimary =
      (!baseIsImdb && incIsImdb) ||
      (baseIsImdb === incIsImdb &&
        incRating > baseRating &&
        (incYear >= baseYear || baseYear === 0));

    const primary = preferIncomingAsPrimary ? incoming : base;
    const secondary = preferIncomingAsPrimary ? base : incoming;

    return {
      ...secondary,
      ...primary,
      id: baseIsImdb ? base.id : incIsImdb ? incoming.id : primary.id,
      imdbId:
        primary.imdbId ||
        secondary.imdbId ||
        (baseIsImdb ? base.id : incIsImdb ? incoming.id : undefined),
      kpId: primary.kpId || secondary.kpId,
      flTorrentId: primary.flTorrentId || secondary.flTorrentId,
      releaseTitle: primary.releaseTitle || secondary.releaseTitle,
      nameOriginal: primary.nameOriginal || secondary.nameOriginal,
      releaseInfo: primary.releaseInfo || secondary.releaseInfo,
      country: primary.country || secondary.country,
      ratingKinopoisk: primary.ratingKinopoisk || secondary.ratingKinopoisk,
      imdbRating:
        baseRating >= incRating
          ? base.imdbRating || incoming.imdbRating
          : incoming.imdbRating || base.imdbRating,
      poster:
        primary.poster && !primary.poster.includes('no-poster')
          ? primary.poster
          : secondary.poster,
      background: primary.background || secondary.background,
      seasonsCount: primary.seasonsCount || secondary.seasonsCount,
      episodesCount: primary.episodesCount || secondary.episodesCount,
    };
  };

  for (const rawItem of items) {
    if (!rawItem || !rawItem.name) continue;
    if (rawItem.poster && rawItem.poster.includes('no-poster')) continue;

    const yearNum = extractVodProductionYear(rawItem);
    const ratingNum =
      parseFloat(String(rawItem.imdbRating || rawItem.ratingKinopoisk || '0')) || 0;
    // Skip empty/unreleased placeholder entries in search that have neither a release year nor an IMDb rating
    if (searchQuery && yearNum === 0 && ratingNum === 0) {
      continue;
    }

    const rawImdb = String(
      rawItem.imdbId ||
        (rawItem as { imdb_id?: string }).imdb_id ||
        (rawItem.id.startsWith('tt') ? rawItem.id : '')
    )
      .split(':')[0]
      .trim();
    const validImdb = /^tt\d+$/.test(rawImdb) ? rawImdb : '';
    const validKp =
      rawItem.kpId ||
      (rawItem.id.startsWith('kp_') ? rawItem.id.replace(/^kp_/, '') : '');

    const item: CinemetaItem = {
      ...rawItem,
      id: validImdb || rawItem.id,
      imdbId: validImdb || rawItem.imdbId,
      kpId: validKp || rawItem.kpId,
    };

    const normName = normalizeVodTitleKey(item.name);
    const normOrig = normalizeVodTitleKey(item.nameOriginal);
    const yearBucket = yearNum > 0 ? String(yearNum) : 'any';
    const titleKeys = Array.from(
      new Set(
        [
          normName ? `${item.type}_${normName}_${yearBucket}` : '',
          normOrig ? `${item.type}_${normOrig}_${yearBucket}` : '',
          normName ? `${normName}_${yearBucket}` : '',
          normOrig ? `${normOrig}_${yearBucket}` : '',
        ].filter(Boolean)
      )
    );

    let existingIdx: number | undefined;
    if (validImdb && byImdb.has(validImdb)) {
      existingIdx = byImdb.get(validImdb);
    } else if (validKp && byKp.has(validKp)) {
      existingIdx = byKp.get(validKp);
    } else {
      for (const tk of titleKeys) {
        if (byTitleKey.has(tk)) {
          existingIdx = byTitleKey.get(tk);
          break;
        }
      }
    }

    if (existingIdx !== undefined) {
      const merged = mergeTwo(result[existingIdx], item);
      result[existingIdx] = merged;
      if (merged.imdbId) byImdb.set(merged.imdbId, existingIdx);
      if (merged.kpId) byKp.set(merged.kpId, existingIdx);
      for (const tk of titleKeys) byTitleKey.set(tk, existingIdx);
    } else {
      const idx = result.length;
      result.push(item);
      if (validImdb) byImdb.set(validImdb, idx);
      if (validKp) byKp.set(validKp, idx);
      for (const tk of titleKeys) byTitleKey.set(tk, idx);
    }
  }

  if (!searchQuery) {
    return sortVodItemsByProductionYear(result);
  }

  const qNorm = normalizeVodTitleKey(searchQuery);
  return [...result].sort((a, b) => {
    const aName = normalizeVodTitleKey(a.name);
    const aOrig = normalizeVodTitleKey(a.nameOriginal);
    const bName = normalizeVodTitleKey(b.name);
    const bOrig = normalizeVodTitleKey(b.nameOriginal);

    const scoreMatch = (n1: string, n2: string) => {
      if (!qNorm) return 0;
      if (n1 === qNorm || n2 === qNorm) return 3;
      if (n1.startsWith(qNorm) || n2.startsWith(qNorm)) return 2;
      if (n1.includes(qNorm) || n2.includes(qNorm)) return 1;
      return 0;
    };

    const sa = scoreMatch(aName, aOrig);
    const sb = scoreMatch(bName, bOrig);
    if (sb !== sa) return sb - sa;

    const ya = extractVodProductionYear(a);
    const yb = extractVodProductionYear(b);
    if (yb !== ya) return yb - ya;

    const ra = parseFloat(String(a.imdbRating || '0')) || 0;
    const rb = parseFloat(String(b.imdbRating || '0')) || 0;
    return rb - ra;
  });
}

export function deduplicateFileListItems(
  items: FileListTorrentInfo[]
): FileListTorrentInfo[] {
  const out: FileListTorrentInfo[] = [];
  const byKey = new Map<string, number>();

  for (const item of items) {
    if (!item) continue;
    const cleanImdb =
      item.imdbId && /^tt\d+$/.test(item.imdbId.trim())
        ? item.imdbId.trim()
        : '';
    const cleanTitle = normalizeVodTitleKey(item.name || item.releaseTitle);
    const key = cleanImdb
      ? `${item.type}_${cleanImdb}`
      : `${item.type}_${cleanTitle}_${item.year || ''}`;
    if (!key) continue;

    const existingIdx = byKey.get(key);
    if (existingIdx === undefined) {
      byKey.set(key, out.length);
      out.push({
        ...item,
        name:
          item.type === 'series'
            ? item.name.replace(/\s*\(S\d+[^)]*\)\s*/gi, '').trim() || item.name
            : item.name,
      });
    } else {
      const prev = out[existingIdx];
      // Prefer 4K or higher seeders as representative card
      const prevScore =
        (prev.quality === '4K UHD' ? 1000 : prev.quality === '1080p Full HD' ? 500 : 100) +
        Math.min(prev.seeders || 0, 500);
      const curScore =
        (item.quality === '4K UHD' ? 1000 : item.quality === '1080p Full HD' ? 500 : 100) +
        Math.min(item.seeders || 0, 500);
      if (curScore > prevScore) {
        out[existingIdx] = {
          ...item,
          name:
            item.type === 'series'
              ? item.name.replace(/\s*\(S\d+[^)]*\)\s*/gi, '').trim() || item.name
              : item.name,
        };
      }
    }
  }
  return out;
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




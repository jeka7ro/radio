export interface GenericEpisodeProgress {
  currentTime?: number;
  duration?: number;
  isWatched?: boolean;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface GenericVodItem {
  id?: string;
  type?: string;
  name?: string;
  title?: string;
  nameOriginal?: string;
  imdbId?: string;
  imdb_id?: string;
  kpId?: string;
  flTorrentId?: number;
  releaseTitle?: string;
  poster?: string;
  background?: string;
  description?: string;
  genres?: string[];
  isAdult18?: boolean;
  isAdultKlubnichka?: boolean;
  [key: string]: unknown;
}

export interface GenericWatchProgressEntry {
  item?: GenericVodItem;
  season?: number;
  episode?: number;
  currentTime?: number;
  duration?: number;
  isWatched?: boolean;
  totalEpisodesInSeason?: number;
  totalSeasons?: number;
  episodeProgressMap?: Record<string, GenericEpisodeProgress>;
  updatedAt?: number;
  [key: string]: unknown;
}

export function isAdult18VodItem(item?: GenericVodItem | null): boolean;
export function compactProgressItem<T extends GenericVodItem>(item: T): T;
export function areVodItemsSame(
  a?: GenericVodItem | null,
  b?: GenericVodItem | null
): boolean;
export function getVodCanonicalKey(
  itemOrEntry?: GenericVodItem | GenericWatchProgressEntry | null
): string | null;
export function isProgressEntryCleared(
  entry?: GenericWatchProgressEntry | null
): boolean;
export function mergeEpisodeProgressMaps<T extends GenericEpisodeProgress>(
  baseEpMap?: Record<string, T> | null,
  incomingEpMap?: Record<string, T> | null
): Record<string, T>;
export function mergeTwoProgressEntries<T extends GenericWatchProgressEntry>(
  base: T,
  incoming: T
): T;
export function deduplicateProgressMap<T extends GenericWatchProgressEntry>(
  map: Record<string, T>,
  options?: { compact?: boolean }
): Record<string, T>;
export function dedupeAndMergeProgressMaps<T extends GenericWatchProgressEntry>(
  baseMap: Record<string, T>,
  incomingMap: Record<string, T>
): Record<string, T>;
export function mergeTwoProfileRecords<T extends Record<string, unknown>>(
  a: T,
  b: T
): T;
export function normalizeProfileUniqueName(name?: string | null): string;
export function mergeProfileListsWithTombstones<T extends Record<string, unknown>>(
  lists: Array<T[] | null | undefined>,
  deletedMap?: Record<string, number>
): T[];
export function dedupeAndMergeSavedLists<T extends { id?: string }>(
  lists: Array<T[] | null | undefined>
): T[];

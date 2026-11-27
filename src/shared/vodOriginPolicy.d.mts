export interface VodOriginItemInput {
  id?: string;
  imdbId?: string;
  query?: string;
  name?: string;
  nameOriginal?: string;
  releaseTitle?: string;
  country?: string;
  flTorrentId?: number;
}

export const RO_EXCLUSIVE_IMDB_IDS: Set<string>;
export const RO_SHOW_OR_BROADCAST_REGEX: RegExp;
export const RO_COUNTRY_REGEX: RegExp;

export function normalizeDiacriticsForOrigin(text?: string | null): string;
export function isRomanianVodTitleOrImdb(
  input?: VodOriginItemInput | null
): boolean;
export function isFileListExclusiveRomanianVodItem(
  item?: VodOriginItemInput | null
): boolean;
export function isRomanianVodItemShared(
  item?: VodOriginItemInput | null
): boolean;

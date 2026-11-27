/**
 * Canonical cross-runtime VOD origin classifier (Romanian / FileList-exclusive).
 *
 * Single source of truth shared between:
 *   - Client (`src/services/deviceContinuityService.ts`, `src/views/smartTvLampaHelpers.ts`)
 *   - QNAP/Node Server (`src/server/filelistServer.ts`)
 *
 * Eliminates the 3-way drift between client (18 IMDb IDs), helpers (10 IDs),
 * and server (10 IDs without diacritic normalization).
 */

export const RO_EXCLUSIVE_IMDB_IDS = new Set([
  // Reality / TV Shows & Romanian Series (merged superset of all 22 IDs)
  'tt10295772',
  'tt26254014',
  'tt26745180',
  'tt28504410',
  'tt8690918',
  'tt35405683',
  'tt31185469',
  'tt13093364',
  'tt6226256',
  'tt1745739',
  'tt2226317',
  'tt2299807',
  'tt21747100',
  'tt11640352',
  'tt22048376',
  'tt33050045',
  'tt33364262',
  'tt28658272',
  'tt21603982',
  'tt33088572',
  'tt34192055',
  'tt28803286',
]);

export const RO_SHOW_OR_BROADCAST_REGEX =
  /\b(asia[.\s_-]*express|america[.\s_-]*express|power[.\s_-]*couple|insula[.\s_-]*iubirii|chefi[.\s_-]*la[.\s_-]*cutite|las[.\s_-]*fierbinti|survivor[.\s_-]*romania|clanul|tatutu|tatuajul|camera[.\s_-]*609|scara[.\s_-]*b|burlacul|vocea[.\s_-]*romaniei|romanii[.\s_-]*au[.\s_-]*talent|te[.\s_-]*cunosc[.\s_-]*de[.\s_-]*undeva|bravo[.\s_-]*ai[.\s_-]*stil|sunt[.\s_-]*celebru|visuri[.\s_-]*la[.\s_-]*cheie|iubire[.\s_-]*cu[.\s_-]*parfum[.\s_-]*de[.\s_-]*lavanda|poftiti[.\s_-]*pe[.\s_-]*la[.\s_-]*noi|jocul[.\s_-]*cuvintelor|antp\.web-?dl|protv\.web-?dl|voyo\.web-?dl)\b/i;

export const RO_COUNTRY_REGEX = /(Romania|Rom[aâ]nia|Румыния)/i;

export function normalizeDiacriticsForOrigin(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ăâ]/gi, 'a')
    .replace(/[î]/gi, 'i')
    .replace(/[șş]/gi, 's')
    .replace(/[țţ]/gi, 't')
    .toLowerCase();
}

function extractCanonicalImdb(imdbId, id) {
  const explicit = String(imdbId || '').trim();
  if (explicit.startsWith('tt')) return explicit.split(':')[0];
  const rawId = String(id || '').trim();
  if (rawId.startsWith('tt')) return rawId.split(':')[0];
  return '';
}

/**
 * Server/client unified check: matches any Romanian IMDb ID or diacritic-normalized
 * Romanian show / TV network WEB-DL release title.
 */
export function isRomanianVodTitleOrImdb(input) {
  if (!input || typeof input !== 'object') return false;
  const imdb = extractCanonicalImdb(input.imdbId, input.id);
  if (imdb && RO_EXCLUSIVE_IMDB_IDS.has(imdb)) return true;

  const combined = normalizeDiacriticsForOrigin(
    `${input.query || ''} ${input.name || ''} ${input.nameOriginal || ''} ${input.releaseTitle || ''}`
  );
  if (combined.trim() && RO_SHOW_OR_BROADCAST_REGEX.test(combined)) {
    return true;
  }
  return false;
}

/**
 * Matches titles that are exclusively hosted on FileList.io Romania (not on Russian trackers).
 */
export function isFileListExclusiveRomanianVodItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (isRomanianVodTitleOrImdb(item)) return true;
  if (
    item.flTorrentId &&
    Number(item.flTorrentId) > 0 &&
    RO_COUNTRY_REGEX.test(String(item.country || ''))
  ) {
    return true;
  }
  return false;
}

/**
 * Broad Romanian VOD classifier used for routing (includes country === Romania / România / Румыния).
 */
export function isRomanianVodItemShared(item) {
  if (!item || typeof item !== 'object') return false;
  if (isRomanianVodTitleOrImdb(item)) return true;
  if (item.country && RO_COUNTRY_REGEX.test(String(item.country))) {
    return true;
  }
  return false;
}

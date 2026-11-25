/**
 * Lightweight, zero-dependency Smart Search engine:
 * - Diacritic folding (RO/EU: ăâîșțéü -> aaisteu, ё -> е)
 * - Bidirectional Cyrillic <-> Latin phonetic transliteration
 *   (e.g. "kukushkin" <-> "Кукушкин", "shou voli" <-> "Шоу Воли", "pervyi" <-> "Первый")
 * - Bounded Damerau-Levenshtein typo tolerance (1 edit for 4-6 char words, 2 edits for 7+ chars)
 */

const CYR_TO_LAT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  і: 'i',
  ї: 'yi',
  є: 'ye',
  ґ: 'g',
};

const LAT_MULTI_TO_CYR: Array<[string, string]> = [
  ['shch', 'щ'],
  ['sch', 'щ'],
  ['zh', 'ж'],
  ['ch', 'ч'],
  ['sh', 'ш'],
  ['kh', 'х'],
  ['ts', 'ц'],
  ['tc', 'ц'],
  ['tz', 'ц'],
  ['yu', 'ю'],
  ['ju', 'ю'],
  ['ya', 'я'],
  ['ja', 'я'],
  ['yo', 'е'],
  ['jo', 'е'],
  ['ye', 'е'],
  ['je', 'е'],
  ['iy', 'ий'],
  ['yi', 'ый'],
];

const LAT_SINGLE_TO_CYR: Record<string, string> = {
  a: 'а',
  b: 'б',
  c: 'к',
  d: 'д',
  e: 'е',
  f: 'ф',
  g: 'г',
  h: 'х',
  i: 'и',
  j: 'й',
  k: 'к',
  l: 'л',
  m: 'м',
  n: 'н',
  o: 'о',
  p: 'п',
  q: 'к',
  r: 'р',
  s: 'с',
  t: 'т',
  u: 'у',
  v: 'в',
  w: 'в',
  x: 'кс',
  y: 'ы',
  z: 'з',
};

export function normalizeSearchFold(raw?: string | null): string {
  if (!raw) return '';
  let s = String(raw).toLowerCase().replace(/ё/g, 'е');
  try {
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch {
    // fallback for older engines
  }
  return s
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't')
    .replace(/[ăâ]/g, 'a')
    .replace(/[î]/g, 'i')
    .replace(/[^a-z0-9а-я]+/g, ' ')
    .trim();
}

export function transliterateCyrillicToLatin(raw?: string | null): string {
  const folded = normalizeSearchFold(raw);
  if (!folded || !/[а-я]/.test(folded)) return folded;
  let out = '';
  for (let i = 0; i < folded.length; i++) {
    const ch = folded[i];
    out += CYR_TO_LAT[ch] !== undefined ? CYR_TO_LAT[ch] : ch;
  }
  return out.replace(/\s+/g, ' ').trim();
}

export function transliterateLatinToCyrillic(raw?: string | null): string {
  const folded = normalizeSearchFold(raw);
  if (!folded || !/[a-z]/.test(folded)) return folded;
  let out = '';
  let i = 0;
  while (i < folded.length) {
    let matched = false;
    for (let m = 0; m < LAT_MULTI_TO_CYR.length; m++) {
      const pair = LAT_MULTI_TO_CYR[m];
      if (folded.startsWith(pair[0], i)) {
        out += pair[1];
        i += pair[0].length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const ch = folded[i];
    out += LAT_SINGLE_TO_CYR[ch] !== undefined ? LAT_SINGLE_TO_CYR[ch] : ch;
    i++;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Bounded Damerau-Levenshtein edit distance (supports adjacent transpositions).
 * Returns maxDist + 1 early whenever distance exceeds maxDist.
 */
export function boundedDamerauDistance(
  a: string,
  b: string,
  maxDist: number
): number {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > maxDist) return maxDist + 1;
  if (a === b) return 0;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const prev2 = new Int32Array(lb + 1);
  const prev1 = new Int32Array(lb + 1);
  const curr = new Int32Array(lb + 1);

  for (let j = 0; j <= lb; j++) prev1[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cb = b.charCodeAt(j - 1);
      const cost = ca === cb ? 0 : 1;
      let val = Math.min(prev1[j] + 1, curr[j - 1] + 1, prev1[j - 1] + cost);
      if (
        i > 1 &&
        j > 1 &&
        ca === b.charCodeAt(j - 2) &&
        a.charCodeAt(i - 2) === cb
      ) {
        const trans = prev2[j - 2] + 1;
        if (trans < val) val = trans;
      }
      curr[j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxDist) return maxDist + 1;
    for (let j = 0; j <= lb; j++) {
      prev2[j] = prev1[j];
      prev1[j] = curr[j];
    }
  }
  return prev1[lb];
}

function tokenFuzzyMatchesWord(qTok: string, word: string): boolean {
  if (!qTok || !word) return false;
  if (word.includes(qTok)) return true;
  const qLen = qTok.length;
  if (qLen < 4) return false;
  const maxDist = qLen >= 7 ? 2 : 1;
  // Require first character match (or transposition of first two chars) for short 4-char tokens to avoid noise
  if (
    qLen === 4 &&
    qTok[0] !== word[0] &&
    !(qTok[0] === word[1] && qTok[1] === word[0])
  ) {
    return false;
  }
  if (boundedDamerauDistance(qTok, word, maxDist) <= maxDist) {
    return true;
  }
  // Allow fuzzy prefix match against longer haystack words (e.g. "kukuskin" vs "kukushkin", "gentlmen" vs "gentlemen")
  if (word.length > qLen) {
    const prefix = word.slice(0, Math.min(word.length, qLen + 1));
    if (boundedDamerauDistance(qTok, prefix, maxDist) <= maxDist) {
      return true;
    }
  }
  return false;
}

/**
 * Scores how well `haystackRaw` matches `queryRaw` (0 = no match, 1..5 = weak..exact).
 * Handles exact, prefix, space-compact, Cyrillic<->Latin transliteration, and typos.
 */
export function scoreSmartSearchMatch(
  haystackRaw?: string | null,
  queryRaw?: string | null
): number {
  const qFold = normalizeSearchFold(queryRaw);
  if (!qFold) return 1;
  const hFold = normalizeSearchFold(haystackRaw);
  if (!hFold) return 0;

  const qLat = transliterateCyrillicToLatin(qFold);
  const hLat = transliterateCyrillicToLatin(hFold);

  // Tier 5: Exact match (native or transliterated or space-compact)
  if (hFold === qFold || hLat === qLat) return 5;
  const qCompact = qLat.replace(/\s+/g, '');
  const hCompact = hLat.replace(/\s+/g, '');
  if (qCompact.length >= 2 && hCompact === qCompact) return 5;

  // Tier 4: Prefix match
  if (hFold.startsWith(qFold) || hLat.startsWith(qLat)) return 4;

  // Tier 3: Substring / compact substring match
  if (
    hFold.includes(qFold) ||
    hLat.includes(qLat) ||
    (qCompact.length >= 3 && hCompact.includes(qCompact))
  ) {
    return 3;
  }

  // Tier 2 / 1: Multi-token match (exact word/prefix or typo-tolerant)
  const qTokens = qLat.split(' ').filter(Boolean);
  const hWords = hLat.split(' ').filter(Boolean);
  if (qTokens.length === 0 || hWords.length === 0) return 0;

  let allExactPrefix = true;
  for (let i = 0; i < qTokens.length; i++) {
    const qt = qTokens[i];
    const hasExactOrPrefix = hWords.some((w) => w.startsWith(qt) || w.includes(qt));
    if (hasExactOrPrefix) continue;
    allExactPrefix = false;
    const hasFuzzy =
      hWords.some((w) => tokenFuzzyMatchesWord(qt, w)) ||
      (qTokens.length === 1 && tokenFuzzyMatchesWord(qt, hCompact));
    if (!hasFuzzy) return 0;
  }

  return allExactPrefix ? 2 : 1;
}

export function matchesSmartSearch(
  haystackRaw?: string | null,
  queryRaw?: string | null
): boolean {
  return scoreSmartSearchMatch(haystackRaw, queryRaw) > 0;
}

export interface OnlineSubtitleTrack {
  id: string;
  url: string;
  langCode3: string; // e.g. 'ron', 'rum', 'rus', 'eng'
  langCode2: string; // e.g. 'ro', 'ru', 'en'
  langLabel: string; // e.g. 'Română', 'Русский', 'English'
  fileName: string;
  releaseName: string;
  encoding?: string;
}

export interface SubtitleMediaCandidate {
  imdbId: string;
  name: string;
  year?: string;
  type: 'movie' | 'series';
  poster?: string;
}

const LANG_MAP: Record<string, { code2: string; label: string }> = {
  ron: { code2: 'ro', label: 'Română' },
  rum: { code2: 'ro', label: 'Română' },
  mol: { code2: 'ro', label: 'Română' },
  rus: { code2: 'ru', label: 'Русский' },
  eng: { code2: 'en', label: 'English' },
  spa: { code2: 'es', label: 'Español' },
  spl: { code2: 'es', label: 'Español (LA)' },
  fre: { code2: 'fr', label: 'Français' },
  fra: { code2: 'fr', label: 'Français' },
  ger: { code2: 'de', label: 'Deutsch' },
  deu: { code2: 'de', label: 'Deutsch' },
  ita: { code2: 'it', label: 'Italiano' },
  ukr: { code2: 'uk', label: 'Українська' },
  tur: { code2: 'tr', label: 'Türkçe' },
  hun: { code2: 'hu', label: 'Magyar' },
  bul: { code2: 'bg', label: 'Български' },
  srp: { code2: 'sr', label: 'Srpski' },
  hrv: { code2: 'hr', label: 'Hrvatski' },
  pol: { code2: 'pl', label: 'Polski' },
  por: { code2: 'pt', label: 'Português' },
  pob: { code2: 'pt', label: 'Português (BR)' },
  ell: { code2: 'el', label: 'Ελληνικά' },
  gre: { code2: 'el', label: 'Ελληνικά' },
  nld: { code2: 'nl', label: 'Nederlands' },
  dut: { code2: 'nl', label: 'Nederlands' },
  cze: { code2: 'cs', label: 'Čeština' },
  ces: { code2: 'cs', label: 'Čeština' },
  ara: { code2: 'ar', label: 'العربية' },
};

const PRIORITY_LANGS = ['ro', 'ru', 'en', 'es', 'fr', 'de', 'it', 'uk', 'tr', 'hu'];

export function mapSubtitleLang(code3: string): { code2: string; label: string } {
  const clean = (code3 || '').toLowerCase().trim();
  if (LANG_MAP[clean]) return LANG_MAP[clean];
  return {
    code2: clean.slice(0, 2) || 'xx',
    label: clean.toUpperCase() || 'Necunoscut',
  };
}

/**
 * Search Cinemeta by title to find matching IMDb IDs for movies or series.
 */
export async function searchMediaForSubtitles(
  query: string,
  mediaType: 'movie' | 'series' = 'movie'
): Promise<SubtitleMediaCandidate[]> {
  const clean = query.trim();
  if (!clean) return [];

  try {
    const res = await fetch(
      `https://v3-cinemeta.strem.io/catalog/${mediaType}/top/search=${encodeURIComponent(
        clean
      )}.json`
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      metas?: Array<{
        id: string;
        imdb_id?: string;
        name: string;
        releaseInfo?: string;
        year?: string;
        poster?: string;
      }>;
    };

    return (data.metas || [])
      .filter((m) => (m.imdb_id || m.id || '').startsWith('tt'))
      .slice(0, 12)
      .map((m) => ({
        imdbId: m.imdb_id || m.id,
        name: m.name,
        year: m.releaseInfo || m.year,
        type: mediaType,
        poster: m.poster,
      }));
  } catch {
    return [];
  }
}

/**
 * Fetch available `.srt` subtitles from OpenSubtitles v3 API by IMDb ID.
 */
export async function fetchOnlineSubtitlesByImdb(params: {
  imdbId: string;
  type: 'movie' | 'series';
  season?: number;
  episode?: number;
}): Promise<OnlineSubtitleTrack[]> {
  const cleanImdb = (params.imdbId || '').trim();
  if (!cleanImdb.startsWith('tt')) return [];

  const path =
    params.type === 'series'
      ? `series/${cleanImdb}:${params.season || 1}:${params.episode || 1}`
      : `movie/${cleanImdb}`;

  try {
    const res = await fetch(
      `https://opensubtitles-v3.strem.io/subtitles/${path}.json`
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      subtitles?: Array<{
        id: string;
        url: string;
        lang: string;
        SubEncoding?: string;
        subtitleFileName?: string;
        movieReleaseName?: string;
      }>;
    };

    const rawList = data.subtitles || [];
    const langCounter: Record<string, number> = {};

    const mapped: OnlineSubtitleTrack[] = rawList
      .filter((s) => s && s.url && s.lang)
      .map((s, idx) => {
        const mappedLang = mapSubtitleLang(s.lang);
        langCounter[mappedLang.code2] = (langCounter[mappedLang.code2] || 0) + 1;
        const versionNum = langCounter[mappedLang.code2];

        const fileName =
          s.subtitleFileName ||
          `${cleanImdb}_${mappedLang.code2}_v${versionNum}.srt`;
        const releaseName =
          s.movieReleaseName ||
          s.subtitleFileName?.replace(/\.srt$/i, '') ||
          `OpenSubtitles #${versionNum}`;

        return {
          id: `${s.id || idx}_${s.lang}`,
          url: s.url,
          langCode3: s.lang.toLowerCase(),
          langCode2: mappedLang.code2,
          langLabel: `${mappedLang.label} #${versionNum}`,
          fileName,
          releaseName,
          encoding: s.SubEncoding,
        };
      });

    // Sort so RO, RU, EN, ES, FR, DE appear at the top
    return mapped.sort((a, b) => {
      const idxA = PRIORITY_LANGS.indexOf(a.langCode2);
      const idxB = PRIORITY_LANGS.indexOf(b.langCode2);
      const rankA = idxA >= 0 ? idxA : 999;
      const rankB = idxB >= 0 ? idxB : 999;
      if (rankA !== rankB) return rankA - rankB;
      return a.langLabel.localeCompare(b.langLabel);
    });
  } catch {
    return [];
  }
}

/**
 * Convert raw SRT or VTT text into a valid WebVTT string with optional time shift (seconds).
 */
export function convertSrtToWebVtt(rawText: string, offsetSeconds = 0): string {
  const cleaned = rawText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

  const shiftTimestamp = (ts: string): string => {
    const normalized = ts.trim().replace(',', '.');
    const parts = normalized.split(':');
    if (parts.length < 3) return normalized;
    const h = Number(parts[0]) || 0;
    const m = Number(parts[1]) || 0;
    const s = Number(parts[2]) || 0;
    const total = Math.max(0, h * 3600 + m * 60 + s + offsetSeconds);
    const nh = Math.floor(total / 3600);
    const nm = Math.floor((total % 3600) / 60);
    const ns = (total % 60).toFixed(3);
    const [secPart, msPart] = ns.split('.');
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(
      2,
      '0'
    )}:${String(secPart).padStart(2, '0')}.${msPart || '000'}`;
  };

  if (cleaned.trimStart().startsWith('WEBVTT')) {
    if (offsetSeconds === 0) return cleaned;
  }

  const lines = cleaned.split('\n');
  const out: string[] = ['WEBVTT', ''];

  const timeRegex =
    /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})(.*)/;

  for (const line of lines) {
    if (line.trim() === 'WEBVTT') continue;
    const m = line.match(timeRegex);
    if (m) {
      const start = shiftTimestamp(m[1]);
      const end = shiftTimestamp(m[2]);
      out.push(`${start} --> ${end}${m[3] || ''}`);
    } else {
      out.push(line);
    }
  }

  return out.join('\n');
}

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

/**
 * Parse raw SRT or WebVTT text into an array of timed SubtitleCue objects.
 */
export function parseSrtToCues(
  rawText: string,
  offsetSeconds = 0
): SubtitleCue[] {
  const cleaned = rawText
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const parseTimestamp = (ts: string): number => {
    const normalized = ts.trim().replace(',', '.');
    const parts = normalized.split(':');
    if (parts.length === 3) {
      return (
        (Number(parts[0]) || 0) * 3600 +
        (Number(parts[1]) || 0) * 60 +
        (Number(parts[2]) || 0)
      );
    }
    if (parts.length === 2) {
      return (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0);
    }
    return 0;
  };

  const blocks = cleaned.split(/\n{2,}/);
  const cues: SubtitleCue[] = [];
  const timeRegex =
    /(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{2}:\d{2}[,.]\d{1,3})/;

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    let timeLineIdx = -1;
    let match: RegExpMatchArray | null = null;
    for (let i = 0; i < Math.min(lines.length, 3); i++) {
      const m = lines[i].match(timeRegex);
      if (m) {
        timeLineIdx = i;
        match = m;
        break;
      }
    }

    if (timeLineIdx >= 0 && match) {
      const start = Math.max(0, parseTimestamp(match[1]) + offsetSeconds);
      const end = Math.max(0, parseTimestamp(match[2]) + offsetSeconds);
      const textLines = lines
        .slice(timeLineIdx + 1)
        .map((l) =>
          l
            .replace(/<[^>]+>/g, '')
            .replace(/\{[^}]+\}/g, '')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&quot;/gi, '"')
            .replace(/&#0?39;|&apos;/gi, "'")
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&#(\d+);/g, (_, n) => {
              const code = Number(n);
              return Number.isFinite(code) && code > 0 && code < 0x10ffff
                ? String.fromCodePoint(code)
                : '';
            })
            .trim()
        )
        .filter(Boolean);

      if (textLines.length > 0 && end > start) {
        cues.push({
          start,
          end,
          text: textLines.join('\n'),
        });
      }
    }
  }

  return cues;
}

function decodeSubtitleBytes(buf: ArrayBuffer, langHint = ''): string {
  const bytes = new Uint8Array(buf);
  let text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (text.includes('\uFFFD')) {
    const preferCyrillic = /\b(ru|rus|uk|ukr|bg|bul|sr|srp)\b/i.test(langHint);
    const encodings = preferCyrillic
      ? ['windows-1251', 'windows-1250', 'iso-8859-2']
      : ['windows-1250', 'windows-1251', 'iso-8859-2'];
    for (const enc of encodings) {
      try {
        const decoded = new TextDecoder(enc, { fatal: false }).decode(bytes);
        if (!decoded.includes('\uFFFD')) {
          text = decoded;
          break;
        }
      } catch {
        // encoding not supported on legacy TV browser
      }
    }
  }
  return text;
}

/**
 * Download an online subtitle track and return both raw SRT text and a WebVTT Blob URL for `<track>`.
 */
export async function downloadSubtitleAsVttBlobUrl(
  subUrl: string,
  offsetSeconds = 0,
  langHint = ''
): Promise<{ vttBlobUrl: string; rawSrt: string; cues: SubtitleCue[] }> {
  const res = await fetch(subUrl);
  if (!res.ok) {
    throw new Error(`Nu am putut descărca subtitrarea (${res.status})`);
  }
  const buf = await res.arrayBuffer();
  const rawSrt = decodeSubtitleBytes(buf, langHint);
  const vttText = convertSrtToWebVtt(rawSrt, offsetSeconds);
  const cues = parseSrtToCues(rawSrt, offsetSeconds);
  const blob = new Blob([vttText], { type: 'text/vtt;charset=utf-8' });
  const vttBlobUrl = URL.createObjectURL(blob);
  return { vttBlobUrl, rawSrt, cues };
}

/**
 * Save a subtitle track directly to the user's device as a `.srt` file.
 */
export async function saveSubtitleFileToDevice(
  track: OnlineSubtitleTrack
): Promise<void> {
  const res = await fetch(track.url);
  if (!res.ok) {
    throw new Error(`Eroare la descărcarea fișierului .SRT (${res.status})`);
  }
  const text = await res.text();
  const blob = new Blob([text], { type: 'application/x-subrip;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = track.fileName.endsWith('.srt')
    ? track.fileName
    : `${track.fileName}.srt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
}

export type AudioTrackPreference = 'original' | 'ro' | 'ru' | 'uk' | 'first';

/**
 * Infers the AudioTrackPreference from a selected audio track label/lang.
 */
export function inferAudioPrefFromTrackName(nameOrLang: string): AudioTrackPreference {
  const s = String(nameOrLang || '').trim().toLowerCase();
  if (!s) return 'original';
  if (/\b(ro|ron|rum|română|romana|romanian)\b|румынск/i.test(s)) {
    return 'ro';
  }
  if (/укр|ukr|\bua\b|ukrainian|postmodern|dnipro|так треба|дубльован/i.test(s)) {
    return 'uk';
  }
  if (
    (/\b(orig|original|v\.?o\.?)\b|ориг|eng\.?\s*orig/i.test(s) &&
      !/\boriginal\s*•\s*(ru|rus|uk|ukr)\b|iEdem\s+VIP/i.test(s)) ||
    /\b(en|eng|english|fr|fra|fre|french|es|spa|esp|spanish|de|deu|ger|german|it|ita|italian|pt|por|portuguese|ko|kor|korean|ja|jpn|jap|japanese|tr|tur|turkish|zh|chi|zho|chinese|pl|pol|polish|sv|swe|swedish|da|dan|danish|no|nor|norwegian|fi|fin|finnish|nl|nld|dut|dutch|cs|ces|cze|czech|hu|hun|hungarian|el|ell|gre|greek|hi|hin|hindi|ar|ara|arabic|th|tha|thai)\b|английск|англ|француз|испанск|немецк|итальян|португал|корейск|японск|турецк|китайск|польск|шведск|датск|норвеж|хинди|арабск|субт|subt/i.test(
      s
    )
  ) {
    return 'original';
  }
  if (
    /\b(ru|rus|russian)\b|рус|дубл|hdrezka|lostfilm|red head|jaskier|кубик|winmedia|moviedalen|tvshows|newcomers|viruseproject|[а-яё]{3,}/i.test(
      s
    )
  ) {
    return 'ru';
  }
  return 'original';
}

/**
 * Find the explicit index of an Original / non-Russian foreign audio track
 * (English, French, Spanish, Korean, Japanese, German, Italian, Romanian, etc.).
 * Returns -1 if NO original or non-Russian foreign track exists in `labels`.
 */
export function findExplicitOriginalAudioTrackIndex(labels: string[]): number {
  if (!Array.isArray(labels) || labels.length === 0) return -1;

  // Priority 1: Explicit Original / Оригинал / V.O. marker (excluding Russian-only iEdem or mislabeled RUS dub)
  const explicitOrigIdx = labels.findIndex((raw) => {
    const s = String(raw || '');
    return (
      /\borig(?:inal)?\b|ориг(?:инал)?|eng\.?\s*orig|\bv\.?o\.?\b/i.test(s) &&
      !/\boriginal\s*•\s*(?:ru|rus|uk|ukr)\b/i.test(s) &&
      !/русский\s*\/\s*original/i.test(s) &&
      !/iEdem\s*VIP/i.test(s) &&
      !(
        labels.length > 1 &&
        /русский.*оригинал/i.test(s)
      )
    );
  });
  if (explicitOrigIdx >= 0) return explicitOrigIdx;

  // Priority 2: Explicit English audio track
  const engIdx = labels.findIndex((raw) =>
    /\b(en|eng|english)\b|eng\d*\b|английск|англ/i.test(String(raw || ''))
  );
  if (engIdx >= 0) return engIdx;

  // Priority 3: Any other non-Russian / non-Ukrainian original world language (FR, ES, DE, IT, KO, JA, RO, TR, PT, ZH, PL, SV, DA, NO, NL, CS, HU, EL, HI, AR, TH...)
  const worldOrigIdx = labels.findIndex((raw) => {
    const s = String(raw || '');
    if (/дубл|hdrezka|lostfilm|red\s*head|jaskier|кубик|tvshows|укр|ukr|так\s*треба/i.test(s)) {
      return false;
    }
    return /\b(ro|ron|rum|română|romana|romanian|fr|fra|fre|french|es|spa|esp|spanish|de|deu|ger|german|it|ita|italian|pt|por|portuguese|ko|kor|korean|ja|jpn|jap|japanese|tr|tur|turkish|zh|chi|zho|cmn|chinese|pl|pol|polish|sv|swe|swedish|da|dan|danish|no|nor|norwegian|fi|fin|finnish|nl|nld|dut|dutch|cs|ces|cze|czech|hu|hun|hungarian|el|ell|gre|greek|hi|hin|hindi|ar|ara|arabic|th|tha|thai|vi|vie|id|ind)\b|(?:fra|fre|spa|deu|ger|ita|por|kor|jpn|tur|ron|rum)\d*\b|француз|испанск|немецк|итальян|португал|корейск|японск|турецк|румынск|китайск|польск|шведск|датск|норвеж|хинди|арабск/i.test(
      s
    );
  });
  if (worldOrigIdx >= 0) return worldOrigIdx;

  // Priority 4: "Субтитры" / "Subtitles" audio track (in Kinogram/Alloha/HDRezka this is Original Audio)
  const subTrackIdx = labels.findIndex((raw) =>
    /субт|subt/i.test(String(raw || ''))
  );
  if (subTrackIdx >= 0) return subTrackIdx;

  // Priority 5: Any non-Russian/non-Ukrainian audio track when mixed with Russian dubbed tracks
  const nonRuIdx = labels.findIndex((raw) => {
    const s = String(raw || '');
    return !/\b(ru|rus|russian|uk|ukr|ua)\b|рус|дубл|hdrezka|lostfilm|red\s*head|jaskier|кубик|tvshows|укр|так\s*треба/i.test(
      s
    );
  });
  if (nonRuIdx >= 0) return nonRuIdx;

  return -1;
}

/**
 * Find the index of the Original Language audio track (e.g. "Eng.Original", "Fra.Original", "English", "KOR", "Original")
 * from an array of audio track names. Defaults to 0 if no explicit original track is detected.
 */
export function findPreferredOriginalAudioTrackIndex(labels: string[]): number {
  if (!Array.isArray(labels) || labels.length === 0) return 0;
  const explicitIdx = findExplicitOriginalAudioTrackIndex(labels);
  return explicitIdx >= 0 ? explicitIdx : 0;
}

/**
 * Resolve audio track index based on user's configured Smart TV audio preference.
 */
export function resolveAudioTrackIndexByPreference(
  labels: string[],
  pref: AudioTrackPreference = 'original'
): number {
  if (!Array.isArray(labels) || labels.length === 0) return 0;

  if (pref === 'first') return 0;

  if (pref === 'ro') {
    const roIdx = labels.findIndex((name) =>
      /\b(ro|ron|rum|română|romana|romanian)\b/i.test(String(name || ''))
    );
    if (roIdx >= 0) return roIdx;
    return findPreferredOriginalAudioTrackIndex(labels);
  }

  if (pref === 'original') {
    return findPreferredOriginalAudioTrackIndex(labels);
  }

  if (pref === 'uk') {
    const ukIdx = labels.findIndex((name) =>
      /укр|ukr|ua\b|ukrainian|postmodern|dnipro|так треба/i.test(String(name || ''))
    );
    return ukIdx >= 0 ? ukIdx : 0;
  }

  if (pref === 'ru') {
    // Prefer Dublaj (Дубляж / Дубл. / HDRezka / LostFilm) or first Russian track (excluding Original & Ukrainian)
    const dubIdx = labels.findIndex(
      (name) =>
        /дубл|hdrezka|lostfilm|red head|jaskier|кубик|winmedia|moviedalen|tvshows/i.test(
          String(name || '')
        ) && !/укр|ukr|orig|ориг/i.test(String(name || ''))
    );
    if (dubIdx >= 0) return dubIdx;

    const ruIdx = labels.findIndex(
      (name) =>
        /\b(ru|rus|russian)\b|рус|[а-яё]{2,}/i.test(String(name || '')) &&
        !/orig|ориг|eng|english|укр|ukr/i.test(String(name || ''))
    );
    if (ruIdx >= 0) return ruIdx;

    const fallbackRuIdx = labels.findIndex(
      (name) => !/orig|ориг|eng|english|укр|ukr|\b(ro|ron|rum)\b/i.test(String(name || ''))
    );
    return fallbackRuIdx >= 0 ? fallbackRuIdx : 0;
  }

  return findPreferredOriginalAudioTrackIndex(labels);
}

/**
 * Returns true if an audio track label is a Russian/Ukrainian dubbing studio or RU track
 * (and NOT an English/Romanian/Original track). Used to hide leaked RU dubs on foreign content.
 */
export function isRussianAudioDubLabel(label: string): boolean {
  const s = String(label || '').trim();
  if (!s) return false;
  if (
    /\b(orig|original|eng|english|ro|ron|rum|română|romana|romanian)\b|ориг/i.test(
      s
    )
  ) {
    return false;
  }
  return /[а-яёіїєґА-ЯЁІЇЄҐ]|\b(moviedalen|alexfilm|jaskier|lostfilm|hdrezka|rezka|red\s*head|tvshows|baibako|newstudio|kubik|coldfilm|ultradox|viruseproject|omskbird|pazl|ru\s*dub|rus\d*)\b/i.test(
    s
  );
}

/**
 * Filter audio options for foreign VOD so Russian/Ukrainian dub tracks stay hidden
 * whenever at least one Original / non-Russian audio track exists, keeping original indices intact.
 */
export function filterDisplayAudioItems<T>(
  items: T[],
  getLabel: (item: T) => string,
  isForeign: boolean
): T[] {
  if (!isForeign || items.length === 0) return items;
  const nonRu = items.filter((it) => !isRussianAudioDubLabel(getLabel(it)));
  return nonRu.length > 0 ? nonRu : items;
}

/**
 * Automatically resolve IMDb ID (if missing) and fetch + download the best subtitle according to preferredLang.
 */
export async function autoResolveAndFetchBestRoRuSubtitle(params: {
  imdbId?: string;
  title?: string;
  nameOriginal?: string;
  type: 'movie' | 'series';
  season?: number;
  episode?: number;
  preferredLang?: string;
}): Promise<{
  resolvedImdbId: string;
  track: OnlineSubtitleTrack;
  vttBlobUrl: string;
  cues: SubtitleCue[];
} | null> {
  if (params.preferredLang === 'off') return null;

  let cleanImdb = (params.imdbId || '').trim();

  if (!cleanImdb.startsWith('tt')) {
    const query = (params.nameOriginal || params.title || '').trim();
    // Never search Cinemeta with a pure Cyrillic title (Cinemeta is English-only and returns random anime/fuzzy matches)
    const hasLatin = /[a-zA-Z]/.test(query);
    if (query.length >= 2 && hasLatin) {
      const candidates = await searchMediaForSubtitles(query, params.type);
      const normQ = query
        .toLowerCase()
        .replace(/\(\d{4}\)/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, '');
      const exactMatch =
        candidates.find((c) => {
          const normC = (c.name || '')
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]+/gu, '');
          return Boolean(normC && (normC === normQ || normC.includes(normQ) || normQ.includes(normC)));
        }) || candidates[0];
      if (exactMatch?.imdbId) {
        cleanImdb = exactMatch.imdbId;
      }
    }
  }

  if (!cleanImdb.startsWith('tt')) return null;

  const tracks = await fetchOnlineSubtitlesByImdb({
    imdbId: cleanImdb,
    type: params.type,
    season: params.season || 1,
    episode: params.episode || 1,
  });

  if (tracks.length === 0) return null;

  // Priority order based on user's preferredLang ('ro' | 'ru' | 'en' | 'es' | 'fr' | 'de')
  const requestedLang = (params.preferredLang || 'ro').toLowerCase().trim();
  const baseOrder =
    requestedLang === 'ru'
      ? ['ru', 'ro', 'en']
      : requestedLang === 'en'
        ? ['en', 'ro', 'ru']
        : ['ro', 'en', 'ru'];
  const pref = [
    requestedLang,
    ...baseOrder.filter((c) => c !== requestedLang),
  ];
  const candidateTracks: OnlineSubtitleTrack[] = [];
  const seenUrls = new Set<string>();
  for (const code of pref) {
    for (const t of tracks) {
      if (t.langCode2 === code && t.url && !seenUrls.has(t.url)) {
        seenUrls.add(t.url);
        candidateTracks.push(t);
        if (candidateTracks.length >= 4) break;
      }
    }
    if (candidateTracks.length >= 4) break;
  }

  for (const chosen of candidateTracks) {
    try {
      const { vttBlobUrl, cues } = await downloadSubtitleAsVttBlobUrl(
        chosen.url,
        0,
        chosen.langCode2
      );
      if (cues && cues.length > 0) {
        return {
          resolvedImdbId: cleanImdb,
          track: chosen,
          vttBlobUrl,
          cues,
        };
      }
      URL.revokeObjectURL(vttBlobUrl);
    } catch {
      // try next subtitle candidate if upstream returned 404/empty
    }
  }

  return null;
}



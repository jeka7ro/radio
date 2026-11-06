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

/**
 * Download an online subtitle track and return both raw SRT text and a WebVTT Blob URL for `<track>`.
 */
export async function downloadSubtitleAsVttBlobUrl(
  subUrl: string,
  offsetSeconds = 0
): Promise<{ vttBlobUrl: string; rawSrt: string; cues: SubtitleCue[] }> {
  const res = await fetch(subUrl);
  if (!res.ok) {
    throw new Error(`Nu am putut descărca subtitrarea (${res.status})`);
  }
  const rawSrt = await res.text();
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
  if (/\b(ro|ron|rum|română|romana|romanian)\b/i.test(s)) {
    return 'ro';
  }
  if (/укр|ukr|\bua\b|ukrainian|postmodern|dnipro|так треба/i.test(s)) {
    return 'uk';
  }
  if (
    /orig|ориг|eng\.?\s*orig|\b(en|eng|english)\b|английск|англ|v\.?o\.?\b|субт|subt/i.test(
      s
    )
  ) {
    return 'original';
  }
  if (
    /\b(ru|rus|russian)\b|рус|дубл|hdrezka|lostfilm|red head|jaskier|кубик|winmedia|moviedalen|tvshows|[а-яё]{3,}/i.test(
      s
    )
  ) {
    return 'ru';
  }
  return 'original';
}

/**
 * Find the index of the Original Language audio track (e.g. "Eng.Original", "Оригинал", "English", "Original")
 * from an array of audio track names. Defaults to 0 if no original track is detected.
 */
export function findPreferredOriginalAudioTrackIndex(labels: string[]): number {
  if (!Array.isArray(labels) || labels.length === 0) return 0;

  // Priority 1: Explicit Original / English / Оригинал track
  const origIdx = labels.findIndex((name) =>
    /orig|ориг|eng\.?\s*orig|english|\beng\b|английск|англ|v\.?o\.?\b/i.test(
      String(name || '')
    )
  );
  if (origIdx >= 0) return origIdx;

  // Priority 2: "Субтитры" / "Subtitles" audio track (in Kinogram/Alloha this is Original Audio)
  const subTrackIdx = labels.findIndex((name) =>
    /субт|subt/i.test(String(name || ''))
  );
  if (subTrackIdx >= 0) return subTrackIdx;

  return 0;
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
    if (query.length >= 2) {
      const candidates = await searchMediaForSubtitles(query, params.type);
      if (candidates[0]?.imdbId) {
        cleanImdb = candidates[0].imdbId;
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
  let chosen: OnlineSubtitleTrack | undefined;
  for (const code of pref) {
    chosen = tracks.find((t) => t.langCode2 === code);
    if (chosen) break;
  }

  if (!chosen) return null;

  const { vttBlobUrl, cues } = await downloadSubtitleAsVttBlobUrl(chosen.url);
  if (!cues || cues.length === 0) return null;

  return {
    resolvedImdbId: cleanImdb,
    track: chosen,
    vttBlobUrl,
    cues,
  };
}



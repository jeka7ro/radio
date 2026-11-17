import { translateTextToLang } from './actorService';

export interface MusicEncyclopediaData {
  artistName: string;
  artistTagline?: string;
  artistBio?: string;
  artistOrigin?: string;
  artistActiveYears?: string;
  artistTypeLabel?: string;
  artistStyles: string[];
  songStory?: string;
  songStoryTitle?: string;
  albumStory?: string;
  sourceLang?: string;
}

export interface MusicEncyclopediaParams {
  artist: string;
  title?: string;
  album?: string;
  genre?: string;
  year?: number;
  lang: 'ro' | 'en' | 'ru';
}

interface WikiCandidatePage {
  title: string;
  description: string;
  extract: string;
  lang: 'ro' | 'en' | 'it' | 'ru';
}

interface MusicBrainzArtistMeta {
  name?: string;
  type?: string;
  origin?: string;
  activeYears?: string;
  disambiguation?: string;
  styles: string[];
}

const CACHE_STORAGE_KEY = 'aether_music_encyclopedia_v1';
const MAX_LOCAL_CACHE_ENTRIES = 80;
const memoryCache = new Map<string, MusicEncyclopediaData>();
const inFlightCache = new Map<string, Promise<MusicEncyclopediaData>>();

const MUSIC_ARTIST_KEYWORDS_RE =
  /\b(singer|musician|songwriter|rapper|band|vocalist|composer|producer|discography|album|single|record|music|rock|pop|jazz|blues|hip[- ]hop|electronic|dj|duo|trio|guitarist|pianist|cântăreț|cântăreață|muzician|formație|trupă|compozitor|interpret|melodie|formație|cantante|cantautore|musicista|gruppo musicale|brano|певец|певица|музыкант|группа|рэпер|композитор|исполнитель|альбом|песня)\b/i;

const NON_MUSIC_BLACKLIST_RE =
  /\b(ocean liner|cruise ship|passenger ship|pachebot|motonave|merchant ship|battleship|warship|footballer|Politician și armator)\b/i;

const SONG_KEYWORDS_RE =
  /\b(song|single|track|ballad|recording|hit single|duet|piesă|melodie|single de|cântec|brano|singolo|canzone|песня|сингл|композиция|трек)\b/i;

const ALBUM_KEYWORDS_RE =
  /\b(album|studio album|live album|compilation|soundtrack|extended play|discografie|album de studio|альбом|студийный альбом)\b/i;

function normalizeCompare(raw?: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9а-яёăâîșț]/gi, '')
    .trim();
}

export function cleanPrimaryArtistName(rawArtist: string): string {
  const clean = String(rawArtist || '').trim();
  if (!clean) return '';
  const firstPart = clean
    .split(/\s*(?:feat\.?|ft\.?|featuring|&|,|×|;|\bwith\b)\s*/i)[0]
    .trim();
  return firstPart || clean;
}

function getLangPriority(lang: 'ro' | 'en' | 'ru'): Array<'ro' | 'en' | 'it' | 'ru'> {
  if (lang === 'ru') return ['ru', 'en', 'ro'];
  if (lang === 'en') return ['en', 'ro', 'it', 'ru'];
  return ['ro', 'en', 'it', 'ru'];
}

function readLocalCache(key: string): MusicEncyclopediaData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<
      string,
      { savedAt?: number; data?: MusicEncyclopediaData }
    >;
    const entry = parsed?.[key];
    if (entry?.data?.artistName) return entry.data;
  } catch {
    // ignore storage errors
  }
  return null;
}

function writeLocalCache(key: string, data: MusicEncyclopediaData): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
    const parsed: Record<string, { savedAt: number; data: MusicEncyclopediaData }> =
      raw ? JSON.parse(raw) : {};
    parsed[key] = { savedAt: Date.now(), data };
    const keys = Object.keys(parsed);
    if (keys.length > MAX_LOCAL_CACHE_ENTRIES) {
      keys
        .sort((a, b) => (parsed[a]?.savedAt || 0) - (parsed[b]?.savedAt || 0))
        .slice(0, keys.length - MAX_LOCAL_CACHE_ENTRIES)
        .forEach((oldKey) => {
          delete parsed[oldKey];
        });
    }
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore quota errors
  }
}

async function fetchJsonWithTimeout(
  url: string,
  timeoutMs = 5500,
  headers?: Record<string, string>
): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function queryWikipediaSearch(
  wikiLang: 'ro' | 'en' | 'it' | 'ru',
  searchQuery: string
): Promise<WikiCandidatePage[]> {
  const q = searchQuery.trim();
  if (!q) return [];
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: q,
    gsrlimit: '6',
    prop: 'extracts|description|pageprops',
    exintro: '0',
    explaintext: '1',
    exchars: '2800',
    redirects: '1',
    format: 'json',
    origin: '*',
  });
  const data = await fetchJsonWithTimeout(
    `https://${wikiLang}.wikipedia.org/w/api.php?${params.toString()}`
  );
  const pagesObj = data?.query?.pages;
  if (!pagesObj || typeof pagesObj !== 'object') return [];
  return Object.values(pagesObj)
    .map((p: any) => ({
      title: String(p?.title || '').trim(),
      description: String(p?.description || '').trim(),
      extract: String(p?.extract || '').trim(),
      lang: wikiLang,
    }))
    .filter((p) => p.title && p.extract.length >= 60);
}

function cleanWikiParagraphs(rawExtract: string, maxChars = 1800, maxParas = 4): string {
  const cleaned = String(rawExtract || '')
    .replace(/^={2,}\s*[^=\n]+\s*={2,}$/gm, '')
    .replace(/\[[0-9]+\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const rawParas = cleaned
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 35 && !/^(notes|references|external links|see also|note|vezi și|referințe|примечания|ссылки)\b/i.test(p));

  const picked: string[] = [];
  let total = 0;
  for (const para of rawParas) {
    if (picked.length >= maxParas) break;
    if (total > 0 && total + para.length > maxChars) break;
    picked.push(para);
    total += para.length;
  }

  const joined = picked.join('\n\n').trim();
  if (!joined) return cleaned.slice(0, maxChars).trim();
  if (joined.length <= maxChars) return joined;
  const cut = joined.slice(0, maxChars);
  const lastDot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (lastDot > 180 ? cut.slice(0, lastDot + 1) : `${cut.trim()}...`).trim();
}

async function translateParagraphs(
  text: string,
  sourceLang: string,
  targetLang: 'ro' | 'en' | 'ru'
): Promise<string> {
  const clean = cleanWikiParagraphs(text);
  if (!clean || sourceLang === targetLang) return clean;
  const parts = clean.split(/\n{2,}/).filter(Boolean);
  if (parts.length === 0) return clean;
  const translated = await Promise.all(
    parts.map((para) => translateTextToLang(para, targetLang))
  );
  return translated.filter(Boolean).join('\n\n');
}

function scoreArtistCandidate(
  page: WikiCandidatePage,
  artistName: string,
  titleHint?: string,
  albumHint?: string
): number {
  const head = `${page.title} ${page.description} ${page.extract.slice(0, 900)}`;
  if (NON_MUSIC_BLACKLIST_RE.test(head)) return -100;
  if (!MUSIC_ARTIST_KEYWORDS_RE.test(head)) return -50;

  const targetNorm = normalizeCompare(artistName);
  const pageTitleNorm = normalizeCompare(page.title);
  let score = 10;

  if (pageTitleNorm === targetNorm) score += 45;
  else if (pageTitleNorm.startsWith(targetNorm) || targetNorm.startsWith(pageTitleNorm)) score += 22;
  else if (normalizeCompare(page.extract.slice(0, 180)).includes(targetNorm)) score += 12;

  if (/\((cântăreț|cântăreață|muzician|singer|musician|rapper|band|group|formație|trupă|cantante|певец|группа)/i.test(page.title)) {
    score += 25;
  }
  if (/\b(singer|musician|band|rapper|composer|cântăreț|muzician|formație|cantante|певец|группа)\b/i.test(page.description)) {
    score += 20;
  }
  const extractLower = page.extract.toLowerCase();
  if (titleHint && titleHint.length >= 3 && extractLower.includes(titleHint.toLowerCase())) {
    score += 18;
  }
  if (albumHint && albumHint.length >= 3 && extractLower.includes(albumHint.toLowerCase())) {
    score += 14;
  }
  return score;
}

async function resolveArtistWikipediaBio(
  artistName: string,
  langPriority: Array<'ro' | 'en' | 'it' | 'ru'>,
  titleHint?: string,
  albumHint?: string
): Promise<WikiCandidatePage | null> {
  const primary = cleanPrimaryArtistName(artistName);
  if (!primary) return null;

  for (const wLang of langPriority) {
    const querySuffix =
      wLang === 'ro'
        ? 'cântăreț OR muzician OR formație'
        : wLang === 'it'
          ? 'cantante OR musicista OR gruppo'
          : wLang === 'ru'
            ? 'певец OR музыкант OR группа'
            : 'singer OR musician OR band';
    const [directPages, qualifiedPages] = await Promise.all([
      queryWikipediaSearch(wLang, primary),
      queryWikipediaSearch(wLang, `${primary} ${querySuffix}`),
    ]);

    const mergedMap = new Map<string, WikiCandidatePage>();
    for (const p of [...qualifiedPages, ...directPages]) {
      if (!mergedMap.has(p.title)) mergedMap.set(p.title, p);
    }

    let best: WikiCandidatePage | null = null;
    let bestScore = 0;
    for (const candidate of mergedMap.values()) {
      const score = scoreArtistCandidate(candidate, primary, titleHint, albumHint);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    if (best && bestScore >= 20) {
      return best;
    }
  }
  return null;
}

async function resolveEntityStoryFromWikipedia(
  entityTitle: string,
  artistName: string,
  kind: 'song' | 'album',
  langPriority: Array<'ro' | 'en' | 'it' | 'ru'>
): Promise<WikiCandidatePage | null> {
  const cleanEntity = String(entityTitle || '')
    .replace(/\s*\((feat\.|ft\.|remaster|deluxe|single version|radio edit)[^)]*\)/gi, '')
    .trim();
  const primaryArtist = cleanPrimaryArtistName(artistName);
  if (!cleanEntity || cleanEntity.length < 2 || !primaryArtist) return null;
  if (kind === 'album' && /^single$/i.test(cleanEntity)) return null;

  const artistNorm = normalizeCompare(primaryArtist);
  const entityNorm = normalizeCompare(cleanEntity);

  for (const wLang of langPriority) {
    const kwHint = kind === 'song' ? 'song single' : 'album';
    const pages = await queryWikipediaSearch(wLang, `"${cleanEntity}" "${primaryArtist}" ${kwHint}`);
    let best: WikiCandidatePage | null = null;
    let bestScore = 0;

    for (const page of pages) {
      const head = `${page.title} ${page.description} ${page.extract.slice(0, 750)}`;
      if (NON_MUSIC_BLACKLIST_RE.test(head)) continue;
      const isMusicMatch =
        kind === 'song' ? SONG_KEYWORDS_RE.test(head) : ALBUM_KEYWORDS_RE.test(head);
      if (!isMusicMatch) continue;

      const extractNorm = normalizeCompare(page.extract);
      if (!extractNorm.includes(artistNorm) && !normalizeCompare(page.description).includes(artistNorm)) {
        continue;
      }

      let score = 20;
      const pageTitleNorm = normalizeCompare(page.title);
      if (pageTitleNorm === entityNorm || pageTitleNorm.startsWith(entityNorm)) score += 35;
      if (kind === 'song' && /\((song|cântec|melodie|singolo|brano|песня)/i.test(page.title)) score += 20;
      if (kind === 'album' && /\((album|альбом)/i.test(page.title)) score += 20;

      if (score > bestScore) {
        bestScore = score;
        best = page;
      }
    }
    if (best && bestScore >= 35) return best;
  }
  return null;
}

async function fetchMusicBrainzArtistMeta(artistName: string): Promise<MusicBrainzArtistMeta> {
  const primary = cleanPrimaryArtistName(artistName);
  if (!primary) return { styles: [] };

  const url = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(
    `artist:"${primary.replace(/"/g, '')}"`
  )}&limit=3&fmt=json`;
  const data = await fetchJsonWithTimeout(url, 4800, {
    Accept: 'application/json',
  });
  const artists = Array.isArray(data?.artists) ? data.artists : [];
  if (artists.length === 0) return { styles: [] };

  const targetNorm = normalizeCompare(primary);
  const chosen =
    artists.find((a: any) => normalizeCompare(a?.name) === targetNorm) || artists[0];

  const beginArea = chosen?.['begin-area']?.name;
  const area = chosen?.area?.name || chosen?.country;
  const originParts = [beginArea, area].filter(Boolean);
  const origin = Array.from(new Set(originParts)).join(', ');

  const beginYear = chosen?.['life-span']?.begin
    ? String(chosen['life-span'].begin).slice(0, 4)
    : '';
  const endYear = chosen?.['life-span']?.end
    ? String(chosen['life-span'].end).slice(0, 4)
    : '';
  const ended = Boolean(chosen?.['life-span']?.ended);

  let activeYears = '';
  if (beginYear) {
    if (chosen?.type === 'Person') {
      activeYears = endYear ? `${beginYear}–${endYear}` : beginYear;
    } else {
      activeYears = endYear
        ? `${beginYear}–${endYear}`
        : ended
          ? beginYear
          : `${beginYear}–prezent`;
    }
  }

  const tags = Array.isArray(chosen?.tags)
    ? chosen.tags
        .slice()
        .sort((a: any, b: any) => (b?.count || 0) - (a?.count || 0))
        .map((t: any) => String(t?.name || '').trim())
        .filter((t: string) => t && t.length <= 28)
        .slice(0, 4)
    : [];

  return {
    name: chosen?.name ? String(chosen.name) : primary,
    type: chosen?.type ? String(chosen.type) : undefined,
    origin: origin || undefined,
    activeYears: activeYears || undefined,
    disambiguation: chosen?.disambiguation ? String(chosen.disambiguation) : undefined,
    styles: tags,
  };
}

function buildFallbackBio(
  params: MusicEncyclopediaParams,
  mbMeta: MusicBrainzArtistMeta
): string {
  const artist = cleanPrimaryArtistName(params.artist) || params.artist;
  const genreText = params.genre || mbMeta.styles[0] || '';
  const originText = mbMeta.origin ? ` (${mbMeta.origin})` : '';
  const albumText = params.album && params.album !== params.title ? params.album : '';
  const yearText = params.year ? String(params.year) : '';

  if (params.lang === 'en') {
    return `${artist}${originText} performs${genreText ? ` in the ${genreText} style` : ' modern recordings'}${
      albumText ? `, featured on the release "${albumText}"` : ''
    }${yearText ? ` (${yearText})` : ''}. Explore the top tracks, discography, and curated radio mix directly in Filmio Music.`;
  }
  if (params.lang === 'ru') {
    return `${artist}${originText} — исполнитель${genreText ? ` в стиле ${genreText}` : ''}${
      albumText ? `, известный по релизу «${albumText}»` : ''
    }${yearText ? ` (${yearText} г.)` : ''}. Откройте полную дискографию, популярные треки и персональное радио в Filmio Music.`;
  }
  return `${artist}${originText} este prezent în catalogul muzical cu piese${
    genreText ? ` din zona ${genreText}` : ''
  }${albumText ? `, incluzând materialul „${albumText}”` : ''}${
    yearText ? ` (${yearText})` : ''
  }. Explorează profilul complet, discografia și postul radio dedicat direct în Filmio Muzică.`;
}

function localizeArtistType(
  rawType: string | undefined,
  lang: 'ro' | 'en' | 'ru'
): string | undefined {
  if (!rawType) return undefined;
  const low = rawType.toLowerCase();
  if (low === 'group') {
    return lang === 'ro' ? 'Formație / Grup' : lang === 'ru' ? 'Группа' : 'Band / Group';
  }
  if (low === 'person') {
    return lang === 'ro' ? 'Artist Solo' : lang === 'ru' ? 'Сольный артист' : 'Solo Artist';
  }
  return rawType;
}

export async function loadMusicEncyclopedia(
  params: MusicEncyclopediaParams
): Promise<MusicEncyclopediaData> {
  const cleanArtist = String(params.artist || '').trim();
  const cleanTitle = String(params.title || '').trim();
  const cleanAlbum = String(params.album || '').trim();
  const lang = params.lang || 'ro';

  const cacheKey = `${lang}::${normalizeCompare(cleanPrimaryArtistName(cleanArtist))}::${normalizeCompare(
    cleanTitle
  )}::${normalizeCompare(cleanAlbum)}`;

  const memHit = memoryCache.get(cacheKey);
  if (memHit) return memHit;

  const localHit = readLocalCache(cacheKey);
  if (localHit) {
    memoryCache.set(cacheKey, localHit);
    return localHit;
  }

  const inflight = inFlightCache.get(cacheKey);
  if (inflight) return inflight;

  const job = (async (): Promise<MusicEncyclopediaData> => {
    const langPriority = getLangPriority(lang);

    const [mbMeta, artistWiki, songWiki, albumWikiRaw] = await Promise.all([
      fetchMusicBrainzArtistMeta(cleanArtist).catch(() => ({ styles: [] } as MusicBrainzArtistMeta)),
      resolveArtistWikipediaBio(cleanArtist, langPriority, cleanTitle, cleanAlbum).catch(() => null),
      cleanTitle
        ? resolveEntityStoryFromWikipedia(cleanTitle, cleanArtist, 'song', langPriority).catch(
            () => null
          )
        : Promise.resolve(null),
      cleanAlbum && normalizeCompare(cleanAlbum) !== normalizeCompare(cleanTitle)
        ? resolveEntityStoryFromWikipedia(cleanAlbum, cleanArtist, 'album', langPriority).catch(
            () => null
          )
        : Promise.resolve(null),
    ]);

    const albumWiki =
      albumWikiRaw && songWiki && albumWikiRaw.title === songWiki.title
        ? null
        : albumWikiRaw;

    const [artistBioTr, artistTaglineTr, songStoryTr, albumStoryTr] = await Promise.all([
      artistWiki
        ? translateParagraphs(artistWiki.extract, artistWiki.lang, lang)
        : Promise.resolve(buildFallbackBio(params, mbMeta)),
      artistWiki?.description
        ? artistWiki.lang === lang
          ? Promise.resolve(artistWiki.description)
          : translateTextToLang(artistWiki.description, lang)
        : mbMeta.disambiguation
          ? translateTextToLang(mbMeta.disambiguation, lang)
          : Promise.resolve(''),
      songWiki ? translateParagraphs(songWiki.extract, songWiki.lang, lang) : Promise.resolve(''),
      albumWiki ? translateParagraphs(albumWiki.extract, albumWiki.lang, lang) : Promise.resolve(''),
    ]);

    const styles = Array.from(
      new Set([params.genre, ...mbMeta.styles].filter((s): s is string => Boolean(s && s.trim())))
    ).slice(0, 4);

    let activeYears = mbMeta.activeYears;
    if (activeYears && activeYears.endsWith('–prezent') && lang !== 'ro') {
      activeYears = activeYears.replace(
        '–prezent',
        lang === 'ru' ? '–наст. время' : '–present'
      );
    }

    const result: MusicEncyclopediaData = {
      artistName: cleanPrimaryArtistName(cleanArtist) || cleanArtist,
      artistTagline: artistTaglineTr || params.genre || undefined,
      artistBio: artistBioTr || buildFallbackBio(params, mbMeta),
      artistOrigin: mbMeta.origin,
      artistActiveYears: activeYears,
      artistTypeLabel: localizeArtistType(mbMeta.type, lang),
      artistStyles: styles,
      songStory: songStoryTr || undefined,
      songStoryTitle: songWiki?.title || undefined,
      albumStory: albumStoryTr || undefined,
      sourceLang: artistWiki?.lang || songWiki?.lang || albumWiki?.lang,
    };

    memoryCache.set(cacheKey, result);
    writeLocalCache(cacheKey, result);
    return result;
  })();

  inFlightCache.set(cacheKey, job);
  try {
    return await job;
  } finally {
    inFlightCache.delete(cacheKey);
  }
}

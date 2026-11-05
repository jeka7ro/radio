const KP_API_KEY = '8c8e1a50-6322-4135-8875-5d40a5420d86';

export interface CastMemberCard {
  staffId?: number;
  name: string;
  nameEn?: string;
  nameRu?: string;
  role?: string;
  professionKey: 'ACTOR' | 'DIRECTOR';
  photoUrl?: string;
  shortBio?: string;
  birthInfo?: string;
}

export interface ActorFilmographyItem {
  id: string; // 'tt...' or 'kp_...'
  kpId?: string;
  type: 'movie' | 'series';
  name: string;
  nameOriginal?: string;
  releaseInfo?: string;
  imdbRating?: string;
  poster?: string;
  fallbackPoster?: string;
  role?: string;
  description?: string;
  general?: boolean;
}

export interface ActorFullProfile {
  staffId?: number;
  name: string;
  nameEn?: string;
  nameRu?: string;
  photoUrl?: string;
  birthday?: string;
  age?: number;
  birthplace?: string;
  growth?: number;
  profession?: string;
  biography: string;
  facts: string[];
  movies: ActorFilmographyItem[];
  series: ActorFilmographyItem[];
}

interface WikiSummaryResult {
  extract?: string;
  description?: string;
  photoUrl?: string;
}

const castListCache = new Map<string, CastMemberCard[]>();
const wikiSummaryCache = new Map<string, WikiSummaryResult>();
const actorProfileCache = new Map<string, ActorFullProfile>();
const translationCache = new Map<string, string>();
const kpFilmTypeCache = new Map<
  number,
  {
    isSeries: boolean;
    imdbId?: string;
    nameOriginal?: string;
    year?: string;
    rating?: string;
  }
>();

function normalizeTitleKey(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '')
    .trim();
}

export async function translateTextToLang(
  text: string,
  targetLang: 'ro' | 'en' | 'ru'
): Promise<string> {
  const clean = (text || '').trim();
  if (!clean) return '';

  // Quick check: if target is 'en' and text has no Cyrillic and no Romanian diacritics, return as-is
  if (
    targetLang === 'en' &&
    !/[а-яА-ЯёЁăâîșțĂÂÎȘȚ]/.test(clean)
  ) {
    return clean;
  }
  // If target is 'ru' and text is already predominantly Cyrillic, return as-is
  if (targetLang === 'ru' && /[а-яА-ЯёЁ]{4,}/.test(clean)) {
    return clean;
  }

  const cacheKey = `${targetLang}:${clean}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
      targetLang
    )}&dt=t&q=${encodeURIComponent(clean)}`;
    const res = await fetch(url);
    if (!res.ok) return clean;
    const data = await res.json();
    if (Array.isArray(data?.[0])) {
      const translated = data[0]
        .map((part: unknown) => (Array.isArray(part) ? String(part[0] || '') : ''))
        .join('')
        .trim();
      if (translated) {
        translationCache.set(cacheKey, translated);
        return translated;
      }
    }
  } catch {
    // fallback to original text
  }
  return clean;
}

function cleanRoleText(rawRole: string | null | undefined, lang: 'ro' | 'en' | 'ru'): string | undefined {
  if (!rawRole) return undefined;
  let s = rawRole.trim();
  if (!s) return undefined;

  if (lang === 'ru') {
    return s.replace(/~озвучка~/gi, '(озвучка)');
  }

  const voiceLabel = lang === 'ro' ? '(voce)' : '(voice)';
  const uncreditedLabel = lang === 'ro' ? '(necreditat)' : '(uncredited)';
  const narratorLabel = lang === 'ro' ? 'Narator' : 'Narrator';

  s = s
    .replace(/,\s*~?озвучка~?/gi, ` ${voiceLabel}`)
    .replace(/~?озвучка~?/gi, voiceLabel)
    .replace(/,\s*в титрах не указан[а]?/gi, ` ${uncreditedLabel}`)
    .replace(/в титрах не указан[а]?/gi, uncreditedLabel)
    .replace(/рассказчик/gi, narratorLabel)
    .replace(/\s+/g, ' ')
    .trim();

  // Strip any leftover Cyrillic annotations when UI is RO or EN
  if (/[а-яА-ЯёЁ]/.test(s)) {
    const latinOnly = s.replace(/[а-яА-ЯёЁ,()~]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (latinOnly.length >= 2) {
      return latinOnly;
    }
    return undefined;
  }

  return s || undefined;
}

function localizeProfession(rawProf: string | null | undefined, lang: 'ro' | 'en' | 'ru'): string | undefined {
  if (!rawProf) return undefined;
  if (lang === 'ru') return rawProf;
  const parts = rawProf.split(',').map((p) => p.trim().toLowerCase());
  const mapped: string[] = [];
  for (const p of parts) {
    if (p.includes('актер') || p.includes('актриса') || p.includes('actor')) {
      mapped.push(lang === 'ro' ? 'Actor' : 'Actor');
    } else if (p.includes('продюсер') || p.includes('producer')) {
      mapped.push(lang === 'ro' ? 'Producător' : 'Producer');
    } else if (p.includes('режиссер') || p.includes('director')) {
      mapped.push(lang === 'ro' ? 'Regizor' : 'Director');
    } else if (p.includes('сценарист') || p.includes('writer')) {
      mapped.push(lang === 'ro' ? 'Scenarist' : 'Writer');
    } else if (p.includes('композитор') || p.includes('composer')) {
      mapped.push(lang === 'ro' ? 'Compozitor' : 'Composer');
    }
  }
  return mapped.length > 0 ? mapped.join(', ') : undefined;
}

export async function fetchWikiActorSummary(
  name: string,
  lang: 'ro' | 'en' | 'ru' = 'ro'
): Promise<WikiSummaryResult> {
  const cleanName = (name || '').trim();
  if (!cleanName) return {};

  const cacheKey = `${lang}:${cleanName.toLowerCase()}`;
  const cached = wikiSummaryCache.get(cacheKey);
  if (cached) return cached;

  const langsOrder: Array<'ro' | 'en' | 'ru'> =
    lang === 'ro'
      ? ['ro', 'en', 'ru']
      : lang === 'ru'
        ? ['ru', 'en', 'ro']
        : ['en', 'ro', 'ru'];

  for (const l of langsOrder) {
    try {
      const slug = encodeURIComponent(cleanName.replace(/\s+/g, '_'));
      const res = await fetch(
        `https://${l}.wikipedia.org/api/rest_v1/page/summary/${slug}`
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        type?: string;
        extract?: string;
        description?: string;
        thumbnail?: { source?: string };
        originalimage?: { source?: string };
      };
      if (data.type === 'disambiguation' || !data.extract) continue;

      let extractText = data.extract;
      let descText = data.description || '';

      // If the found Wikipedia article is in a different language than requested (e.g. EN instead of RO), translate it!
      if (l !== lang) {
        const [trExtract, trDesc] = await Promise.all([
          translateTextToLang(extractText, lang),
          descText ? translateTextToLang(descText, lang) : Promise.resolve(''),
        ]);
        extractText = trExtract;
        descText = trDesc;
      }

      const result: WikiSummaryResult = {
        extract: extractText,
        description: descText || undefined,
        photoUrl: data.thumbnail?.source || data.originalimage?.source,
      };
      wikiSummaryCache.set(cacheKey, result);
      return result;
    } catch {
      // try next language
    }
  }

  wikiSummaryCache.set(cacheKey, {});
  return {};
}

export async function resolveKinopoiskFilmIdByImdb(
  imdbId: string
): Promise<string> {
  if (!imdbId || !imdbId.startsWith('tt')) return '';
  try {
    const res = await fetch(
      `https://kinopoiskapiunofficial.tech/api/v2.2/films?imdbId=${encodeURIComponent(imdbId)}`,
      {
        headers: { 'X-API-KEY': KP_API_KEY },
      }
    );
    if (!res.ok) return '';
    const data = (await res.json()) as {
      items?: Array<{ kinopoiskId?: number }>;
    };
    const first = data.items?.[0]?.kinopoiskId;
    return first ? String(first) : '';
  } catch {
    return '';
  }
}

export async function fetchCastForVodItem(params: {
  imdbId?: string;
  kpId?: string;
  fallbackCast?: string[];
  fallbackDirectors?: string[];
  lang?: 'ro' | 'en' | 'ru';
}): Promise<CastMemberCard[]> {
  const {
    imdbId = '',
    kpId = '',
    fallbackCast = [],
    fallbackDirectors = [],
    lang = 'ro',
  } = params;

  const cacheKey = `${lang}:${imdbId}:${kpId}:${fallbackCast.slice(0, 5).join(',')}`;
  const cached = castListCache.get(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }

  let effectiveKpId = kpId.replace(/^kp_/, '').trim();
  if (!effectiveKpId && imdbId.startsWith('tt')) {
    effectiveKpId = await resolveKinopoiskFilmIdByImdb(imdbId);
  }

  const members: CastMemberCard[] = [];

  if (effectiveKpId) {
    try {
      const res = await fetch(
        `https://kinopoiskapiunofficial.tech/api/v1/staff?filmId=${encodeURIComponent(effectiveKpId)}`,
        {
          headers: { 'X-API-KEY': KP_API_KEY },
        }
      );
      if (res.ok) {
        const staffList = (await res.json()) as Array<{
          staffId: number;
          nameRu?: string | null;
          nameEn?: string | null;
          description?: string | null;
          posterUrl?: string | null;
          professionKey?: string;
        }>;

        if (Array.isArray(staffList)) {
          const directors = staffList
            .filter((s) => s.professionKey === 'DIRECTOR')
            .slice(0, 2);
          const actors = staffList
            .filter((s) => s.professionKey === 'ACTOR')
            .slice(0, 14);

          const combined = [...directors, ...actors];
          const seenIds = new Set<number>();

          for (const item of combined) {
            if (!item.staffId || seenIds.has(item.staffId)) continue;
            seenIds.add(item.staffId);
            const displayName =
              lang === 'ru'
                ? item.nameRu || item.nameEn || 'Актёр'
                : item.nameEn || item.nameRu || 'Actor';

            const cleanedRole = cleanRoleText(item.description, lang);

            members.push({
              staffId: item.staffId,
              name: displayName,
              nameEn: item.nameEn || undefined,
              nameRu: lang === 'ru' ? item.nameRu || undefined : undefined,
              role:
                cleanedRole ||
                (item.professionKey === 'DIRECTOR'
                  ? lang === 'ru'
                    ? 'Режиссёр'
                    : lang === 'en'
                      ? 'Director'
                      : 'Regizor'
                  : undefined),
              professionKey:
                item.professionKey === 'DIRECTOR' ? 'DIRECTOR' : 'ACTOR',
              photoUrl: item.posterUrl || undefined,
            });
          }
        }
      }
    } catch {
      // fallback below
    }
  }

  // Fallback to Cinemeta cast / director names if Kinopoisk staff was unavailable
  if (members.length === 0) {
    for (const dirName of fallbackDirectors.slice(0, 2)) {
      if (!dirName) continue;
      members.push({
        name: dirName,
        nameEn: dirName,
        role:
          lang === 'ru' ? 'Режиссёр' : lang === 'en' ? 'Director' : 'Regizor',
        professionKey: 'DIRECTOR',
      });
    }
    for (const actName of fallbackCast.slice(0, 12)) {
      if (!actName) continue;
      members.push({
        name: actName,
        nameEn: actName,
        professionKey: 'ACTOR',
      });
    }
  }

  // Enrich the top 10 cast cards with localized Wikipedia short bio & high-res photo in parallel
  await Promise.all(
    members.slice(0, 10).map(async (m) => {
      const lookupName = m.nameEn || m.name || '';
      if (!lookupName) return;
      const wiki = await fetchWikiActorSummary(lookupName, lang);
      if (wiki.extract) {
        m.shortBio = wiki.extract;
      }
      if (wiki.description) {
        m.birthInfo = wiki.description;
      }
      if (
        wiki.photoUrl &&
        (!m.photoUrl || m.photoUrl.includes('no-poster'))
      ) {
        m.photoUrl = wiki.photoUrl;
      }
    })
  );

  if (members.length > 0) {
    castListCache.set(cacheKey, members);
  }
  return members;
}

export async function fetchActorFullProfile(
  actor: CastMemberCard,
  lang: 'ro' | 'en' | 'ru' = 'ro'
): Promise<ActorFullProfile> {
  const cacheKey = `v3:${lang}:${actor.staffId || ''}:${actor.nameEn || actor.name}`;
  const cached = actorProfileCache.get(cacheKey);
  if (cached) return cached;

  let staffId = actor.staffId;
  const searchName = (actor.nameEn || actor.name || actor.nameRu || '').trim();

  // 1. If we don't have staffId yet, search Kinopoisk persons by name
  if (!staffId && searchName) {
    try {
      const pRes = await fetch(
        `https://kinopoiskapiunofficial.tech/api/v1/persons?name=${encodeURIComponent(searchName)}`,
        {
          headers: { 'X-API-KEY': KP_API_KEY },
        }
      );
      if (pRes.ok) {
        const pData = (await pRes.json()) as {
          items?: Array<{ kinopoiskId?: number }>;
        };
        if (pData.items?.[0]?.kinopoiskId) {
          staffId = pData.items[0].kinopoiskId;
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Fetch Wikipedia summary and Kinopoisk staff profile in parallel first
  const [wikiData, kpStaffData] = await Promise.all([
    fetchWikiActorSummary(searchName, lang),
    staffId
      ? fetch(
          `https://kinopoiskapiunofficial.tech/api/v1/staff/${encodeURIComponent(String(staffId))}`,
          {
            headers: { 'X-API-KEY': KP_API_KEY },
          }
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  const birthYearMatch = String(kpStaffData?.birthday || '').match(
    /\b(19\d{2}|20\d{2})\b/
  );
  const actorBirthYear = birthYearMatch ? parseInt(birthYearMatch[1], 10) : 0;

  // 2B. Fetch TVMaze series credits ONLY if we have a verified Latin name and exact person match (and matching birthday if known)
  const latinSearchName = (
    kpStaffData?.nameEn ||
    actor.nameEn ||
    (!/[а-яА-ЯёЁ]/.test(searchName) ? searchName : '')
  ).trim();

  const tvMazeSeries: ActorFilmographyItem[] = await (async () => {
    if (!latinSearchName || /[а-яА-ЯёЁ]/.test(latinSearchName)) return [];
    try {
      const qRes = await fetch(
        `https://api.tvmaze.com/search/people?q=${encodeURIComponent(latinSearchName)}`
      );
      if (!qRes.ok) return [];
      const people = (await qRes.json()) as Array<{
        person?: { id?: number; name?: string; birthday?: string | null };
      }>;
      const targetKey = normalizeTitleKey(latinSearchName);
      const matchedPerson = (people || []).find((entry) => {
        const p = entry?.person;
        if (!p?.id || !p?.name) return false;
        if (normalizeTitleKey(p.name) !== targetKey) return false;
        if (kpStaffData?.birthday && p.birthday) {
          return p.birthday === kpStaffData.birthday;
        }
        if (actorBirthYear >= 1995 && !p.birthday) {
          return false;
        }
        return true;
      })?.person;

      const personId = matchedPerson?.id;
      if (!personId) return [];

      const [credRes, guestRes] = await Promise.all([
        fetch(
          `https://api.tvmaze.com/people/${personId}/castcredits?embed=show`
        ).catch(() => null),
        fetch(
          `https://api.tvmaze.com/people/${personId}/guestcastcredits?embed=show`
        ).catch(() => null),
      ]);

      const mainCredits = credRes && credRes.ok ? await credRes.json() : [];
      const guestCredits =
        guestRes && guestRes.ok ? await guestRes.json() : [];
      const allCredits = [
        ...(Array.isArray(mainCredits) ? mainCredits : []),
        ...(Array.isArray(guestCredits) ? guestCredits : []),
      ] as Array<{
        _embedded?: {
          show?: {
            id?: number;
            name?: string;
            type?: string;
            premiered?: string;
            rating?: { average?: number | null };
            externals?: { imdb?: string | null };
            image?: { medium?: string; original?: string };
            summary?: string;
          };
        };
      }>;

      const out: ActorFilmographyItem[] = [];
      const seenShowIds = new Set<string>();

      for (const c of allCredits) {
        const show = c._embedded?.show;
        if (!show || !show.name) continue;
        if (/Talk Show|Variety|News|Game Show/i.test(show.type || '')) {
          continue;
        }
        const premieredYear = show.premiered
          ? parseInt(show.premiered.slice(0, 4), 10) || 0
          : 0;
        if (
          actorBirthYear > 1900 &&
          premieredYear > 0 &&
          premieredYear < actorBirthYear
        ) {
          continue;
        }
        const imdbId = show.externals?.imdb || '';
        const itemId = imdbId || `tvmaze_${show.id}`;
        if (!imdbId || seenShowIds.has(itemId)) continue;
        seenShowIds.add(itemId);

        out.push({
          id: imdbId,
          type: 'series',
          name: show.name,
          nameOriginal: show.name,
          releaseInfo: show.premiered ? show.premiered.slice(0, 4) : undefined,
          imdbRating: show.rating?.average
            ? String(show.rating.average)
            : undefined,
          poster:
            show.image?.medium ||
            show.image?.original ||
            `https://images.metahub.space/poster/medium/${imdbId}/img`,
          description: show.summary
            ? show.summary.replace(/<[^>]+>/g, '').trim()
            : undefined,
          general: true,
        });
      }
      return out;
    } catch {
      return [];
    }
  })();

  const seriesMap = new Map<string, ActorFilmographyItem>();
  const seriesTitleKeys = new Set<string>();

  for (const s of tvMazeSeries) {
    seriesMap.set(s.id, s);
    seriesTitleKeys.add(normalizeTitleKey(s.name));
  }

  const moviesList: ActorFilmographyItem[] = [];

  if (kpStaffData && Array.isArray(kpStaffData.films)) {
    interface KpStaffFilm {
      filmId: number;
      nameRu?: string | null;
      nameEn?: string | null;
      rating?: string | null;
      year?: string | null;
      general?: boolean;
      description?: string | null;
      professionKey?: string;
    }

    const rawFilms = kpStaffData.films as KpStaffFilm[];

    // Identify filmIds that have episode/series markers in any of their entries
    const seriesFilmIds = new Set<number>();
    for (const f of rawFilms) {
      const combinedText = `${f.nameRu || ''} ${f.nameEn || ''} ${f.description || ''}`;
      if (
        /сериал|эпизод|сезон|мини-сериал|series|season|episode/i.test(
          combinedText
        )
      ) {
        seriesFilmIds.add(f.filmId);
      }
      const keyEn = normalizeTitleKey(f.nameEn || '');
      const keyRu = normalizeTitleKey(f.nameRu || '');
      if (
        (keyEn && seriesTitleKeys.has(keyEn)) ||
        (keyRu && seriesTitleKeys.has(keyRu))
      ) {
        seriesFilmIds.add(f.filmId);
      }
    }

    // Deduplicate films by filmId, keeping ACTOR / DIRECTOR entries and excluding "Self / сам себя" and chronologically impossible years
    const dedupedByFilmId = new Map<number, KpStaffFilm>();
    for (const f of rawFilms) {
      if (!f.filmId) continue;
      if (
        f.professionKey !== 'ACTOR' &&
        f.professionKey !== 'DIRECTOR'
      ) {
        continue;
      }
      const filmYear = parseInt(String(f.year || '').slice(0, 4), 10) || 0;
      if (
        actorBirthYear > 1900 &&
        filmYear > 0 &&
        filmYear < actorBirthYear
      ) {
        continue;
      }
      const desc = (f.description || '').trim();
      if (
        /сам себя|саму себя|играет самого себя|играет саму себя|^self$|^himself$|^herself$|хроника|в титрах не указан/i.test(
          desc
        )
      ) {
        continue;
      }
      const titleCheck = `${f.nameEn || ''} ${f.nameRu || ''}`;
      if (
        /Discussion with|Making of|Behind the Scenes|Наука «|Одиссея|История создания/i.test(
          titleCheck
        )
      ) {
        continue;
      }

      const existing = dedupedByFilmId.get(f.filmId);
      if (!existing || (f.general && !existing.general)) {
        dedupedByFilmId.set(f.filmId, f);
      }
    }

    // Sort candidates: general=true and rated items first, then by rating and year
    const sortedCandidates = Array.from(dedupedByFilmId.values())
      .filter((f) => Boolean(f.nameEn || f.nameRu))
      .sort((a, b) => {
        const aRated = a.rating && parseFloat(a.rating) > 0 ? 1 : 0;
        const bRated = b.rating && parseFloat(b.rating) > 0 ? 1 : 0;
        if (aRated !== bRated) return bRated - aRated;
        if (Boolean(a.general) !== Boolean(b.general)) {
          return a.general ? -1 : 1;
        }
        const rA = parseFloat(a.rating || '0') || 0;
        const rB = parseFloat(b.rating || '0') || 0;
        if (Math.abs(rB - rA) >= 0.4) return rB - rA;
        const yA = parseInt(a.year || '0', 10) || 0;
        const yB = parseInt(b.year || '0', 10) || 0;
        return yB - yA;
      })
      .slice(0, 32);

    // Check top 24 candidates against /api/v2.2/films/{id} so we have imdbId (for original English posters!) and exact series vs movie flag
    await Promise.all(
      sortedCandidates.slice(0, 24).map(async (f) => {
        if (kpFilmTypeCache.has(f.filmId)) {
          if (kpFilmTypeCache.get(f.filmId)?.isSeries) {
            seriesFilmIds.add(f.filmId);
          }
          return;
        }
        try {
          const r = await fetch(
            `https://kinopoiskapiunofficial.tech/api/v2.2/films/${f.filmId}`,
            { headers: { 'X-API-KEY': KP_API_KEY } }
          );
          if (!r.ok) return;
          const d = (await r.json()) as {
            type?: string;
            serial?: boolean;
            imdbId?: string | null;
            nameOriginal?: string | null;
            nameEn?: string | null;
            year?: number | string | null;
            ratingImdb?: number | null;
            ratingKinopoisk?: number | null;
          };
          const isSer =
            Boolean(d.serial) ||
            d.type === 'TV_SERIES' ||
            d.type === 'MINI_SERIES' ||
            d.type === 'TV_SHOW';
          kpFilmTypeCache.set(f.filmId, {
            isSeries: isSer,
            imdbId:
              typeof d.imdbId === 'string' && d.imdbId.startsWith('tt')
                ? d.imdbId
                : undefined,
            nameOriginal: d.nameOriginal || d.nameEn || undefined,
            year: d.year ? String(d.year) : undefined,
            rating: d.ratingImdb
              ? String(d.ratingImdb)
              : d.ratingKinopoisk
                ? String(d.ratingKinopoisk)
                : undefined,
          });
          if (isSer) {
            seriesFilmIds.add(f.filmId);
          }
        } catch {
          // ignore
        }
      })
    );

    for (const f of sortedCandidates) {
      const cachedMeta = kpFilmTypeCache.get(f.filmId);
      const effectiveYear =
        parseInt(String(f.year || cachedMeta?.year || '').slice(0, 4), 10) || 0;
      if (
        actorBirthYear > 1900 &&
        effectiveYear > 0 &&
        effectiveYear < actorBirthYear
      ) {
        continue;
      }

      const isSer = seriesFilmIds.has(f.filmId) || Boolean(cachedMeta?.isSeries);
      const origTitle =
        f.nameEn || cachedMeta?.nameOriginal || f.nameRu || '';

      const displayTitle =
        lang === 'ru'
          ? f.nameRu || origTitle
          : origTitle || f.nameRu || '';
      if (!displayTitle) continue;

      const resolvedImdb = cachedMeta?.imdbId;
      const kpPoster = `https://kinopoiskapiunofficial.tech/images/posters/kp_small/${f.filmId}.jpg`;
      // When UI is RO or EN and we have an IMDb ID, use the Original International Poster (with kpPoster as fallback)
      const primaryPoster =
        lang !== 'ru' && resolvedImdb
          ? `https://images.metahub.space/poster/medium/${resolvedImdb}/img`
          : kpPoster;

      const cleanedRole = cleanRoleText(f.description, lang);

      const itemObj: ActorFilmographyItem = {
        id: resolvedImdb || `kp_${f.filmId}`,
        kpId: String(f.filmId),
        type: isSer ? 'series' : 'movie',
        name: displayTitle,
        nameOriginal: origTitle || displayTitle,
        releaseInfo: f.year || cachedMeta?.year || undefined,
        imdbRating: cachedMeta?.rating || f.rating || undefined,
        poster: primaryPoster,
        fallbackPoster: kpPoster,
        role: cleanedRole,
        general: f.general,
      };

      if (isSer) {
        const titleKey = normalizeTitleKey(origTitle || f.nameRu || '');
        if (!titleKey || !seriesTitleKeys.has(titleKey)) {
          seriesMap.set(itemObj.id, itemObj);
          if (titleKey) seriesTitleKeys.add(titleKey);
        } else {
          // Enrich existing TVMaze series with role/kpId if matched
          for (const existingSeries of seriesMap.values()) {
            if (normalizeTitleKey(existingSeries.name) === titleKey) {
              if (!existingSeries.kpId) existingSeries.kpId = String(f.filmId);
              if (!existingSeries.role && cleanedRole) {
                existingSeries.role = cleanedRole;
              }
              if (!existingSeries.imdbRating && itemObj.imdbRating) {
                existingSeries.imdbRating = itemObj.imdbRating;
              }
            }
          }
        }
      } else {
        moviesList.push(itemObj);
      }
    }
  }

  const rawFacts: string[] = Array.isArray(kpStaffData?.facts)
    ? kpStaffData.facts
        .map((fc: string) => fc.replace(/<[^>]+>/g, '').trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  // Translate facts & birthplace into the active UI language (RO / EN / RU)
  const [translatedFacts, localizedBirthplace] = await Promise.all([
    lang === 'ru'
      ? Promise.resolve(rawFacts)
      : Promise.all(rawFacts.map((f) => translateTextToLang(f, lang))),
    kpStaffData?.birthplace
      ? lang === 'ru'
        ? Promise.resolve(String(kpStaffData.birthplace))
        : translateTextToLang(String(kpStaffData.birthplace), lang)
      : Promise.resolve(wikiData.description || undefined),
  ]);

  const rawBio =
    wikiData.extract ||
    actor.shortBio ||
    translatedFacts.slice(0, 3).join(' ') ||
    (lang === 'ru'
      ? `${actor.name} — актёр кино и телевидения.`
      : lang === 'en'
        ? `${actor.name} is a film and television actor.`
        : `${actor.name} este un actor de film și televiziune.`);

  const bioText = await translateTextToLang(rawBio, lang);

  const profile: ActorFullProfile = {
    staffId,
    name:
      lang === 'ru'
        ? kpStaffData?.nameRu || actor.nameRu || actor.name
        : kpStaffData?.nameEn || actor.nameEn || actor.name,
    nameEn: kpStaffData?.nameEn || actor.nameEn || actor.name,
    nameRu: lang === 'ru' ? kpStaffData?.nameRu || actor.nameRu : undefined,
    photoUrl:
      kpStaffData?.posterUrl ||
      actor.photoUrl ||
      wikiData.photoUrl ||
      undefined,
    birthday: kpStaffData?.birthday || undefined,
    age:
      typeof kpStaffData?.age === 'number' && kpStaffData.age > 0
        ? kpStaffData.age
        : undefined,
    birthplace: localizedBirthplace || undefined,
    growth:
      typeof kpStaffData?.growth === 'number' && kpStaffData.growth > 0
        ? kpStaffData.growth
        : undefined,
    profession: localizeProfession(kpStaffData?.profession, lang),
    biography: bioText,
    facts: translatedFacts,
    movies: moviesList.slice(0, 30),
    series: Array.from(seriesMap.values()).slice(0, 30),
  };

  actorProfileCache.set(cacheKey, profile);
  return profile;
}

export interface RelatedVodSuggestionItem {
  id: string;
  kpId?: string;
  type: 'movie' | 'series';
  name: string;
  nameOriginal?: string;
  releaseInfo?: string;
  imdbRating?: string;
  poster?: string;
  fallbackPoster?: string;
  relationKind: 'SEQUEL' | 'PREQUEL' | 'FRANCHISE' | 'SIMILAR';
}

const relatedSuggestionsCache = new Map<string, RelatedVodSuggestionItem[]>();

const SHARED_UNIVERSE_GROUPS: string[][] = [
  ['1883', '1923', 'Yellowstone', 'Lawmen: Bass Reeves', 'Landman', 'Mayor of Kingstown', 'Tulsa King', 'Lioness'],
  ['Breaking Bad', 'Better Call Saul', 'El Camino: A Breaking Bad Movie'],
  ['Game of Thrones', 'House of the Dragon', 'A Knight of the Seven Kingdoms'],
  ['Sons of Anarchy', 'Mayans M.C.', 'The Shield', 'Banshee'],
  ['Peaky Blinders', 'The Gentlemen', 'MobLand', 'Taboo', 'Boardwalk Empire', 'Gangs of London'],
  ['The Boys', 'Gen V', 'Invincible'],
  ['The Walking Dead', 'The Walking Dead: Daryl Dixon', 'The Walking Dead: Dead City', 'The Walking Dead: The Ones Who Live', 'Fear the Walking Dead'],
  ['Dexter', 'Dexter: New Blood', 'Dexter: Original Sin'],
  ['Vikings', 'Vikings: Valhalla', 'The Last Kingdom', 'Shogun'],
  ['Narcos', 'Narcos: Mexico', 'Griselda', 'ZeroZeroZero', 'Ozark'],
  ['Money Heist', 'La Casa de Papel', 'Berlin', 'Lupin'],
  ['The Witcher', 'The Witcher: Blood Origin', 'The Witcher: Sirens of the Deep'],
  ['Bridgerton', 'Queen Charlotte: A Bridgerton Story'],
  ['The Batman', 'The Penguin', 'The Dark Knight', 'Batman Begins', 'The Dark Knight Rises', 'Joker'],
  ['Dune', 'Dune: Part Two', 'Dune: Prophecy'],
  ['The Lord of the Rings: The Fellowship of the Ring', 'The Lord of the Rings: The Two Towers', 'The Lord of the Rings: The Return of the King', 'The Hobbit: An Unexpected Journey', 'The Hobbit: The Desolation of Smaug', 'The Hobbit: The Battle of the Five Armies', 'The Lord of the Rings: The Rings of Power'],
  ['The Matrix', 'The Matrix Reloaded', 'The Matrix Revolutions', 'The Matrix Resurrections'],
  ['John Wick', 'John Wick: Chapter 2', 'John Wick: Chapter 3 - Parabellum', 'John Wick: Chapter 4', 'The Continental: From the World of John Wick'],
  ['Gladiator', 'Gladiator II', 'Spartacus', 'Rome', 'Those About to Die'],
  ['Alien', 'Aliens', 'Alien: Romulus', 'Prometheus', 'Alien: Covenant', 'Prey', 'Predator'],
  ['Mad Max: Fury Road', 'Furiosa: A Mad Max Saga', 'Mad Max', 'Mad Max 2'],
  ['Avatar', 'Avatar: The Way of Water'],
  ['Spider-Man: No Way Home', 'Spider-Man: Far From Home', 'Spider-Man: Homecoming', 'Spider-Man: Across the Spider-Verse', 'Spider-Man: Into the Spider-Verse'],
  ['Slow Horses', 'The Day of the Jackal', 'The Agency', 'Black Doves', 'The Night Manager', 'Homeland'],
  ['Severance', 'Silo', 'Dark Matter', 'Dark', 'Black Mirror', '3 Body Problem', 'Foundation', 'From'],
  ['The Mandalorian', 'Andor', 'Ahsoka', 'Obi-Wan Kenobi', 'The Book of Boba Fett', 'Star Wars: Episode III - Revenge of the Sith', 'Rogue One: A Star Wars Story'],
];

function extractBaseFranchiseQuery(title: string): string {
  const clean = (title || '')
    .replace(/\s*\(\d{4}[^)]*\)\s*/g, ' ')
    .replace(/\s*\(S\d+[^)]*\)\s*/gi, ' ')
    .trim();
  if (!clean) return '';

  const colonSplit = clean.split(/\s*[:–—-]\s*/)[0].trim();
  const strippedNum = colonSplit
    .replace(/\s+(?:Part|Chapter|Vol\.?|Volume|Book|Episode|Episodul|Часть|Глава)\s*(?:[0-9]+|[IVX]+)$/i, '')
    .replace(/\s+(?:[2-9]|1[0-5]|[I]{2,3}|IV|V|VI|VII|VIII|IX|X)$/i, '')
    .trim();

  if (strippedNum.length >= 3) return strippedNum;
  return colonSplit.length >= 3 ? colonSplit : clean;
}

function extractYearNumber(releaseInfo?: string): number {
  const m = String(releaseInfo || '').match(/\b(19\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : 0;
}

export async function fetchRelatedVodSuggestions(params: {
  id: string;
  kpId?: string;
  type: 'movie' | 'series';
  name: string;
  nameOriginal?: string;
  genres?: string[];
  director?: string[];
  cast?: string[];
  lang?: 'ro' | 'en' | 'ru';
}): Promise<RelatedVodSuggestionItem[]> {
  const {
    id,
    kpId = '',
    type,
    name,
    nameOriginal = '',
    genres = [],
    director = [],
    cast = [],
    lang = 'ro',
  } = params;

  const cacheKey = `v3:${lang}:${type}:${id}:${kpId}:${nameOriginal || name}`;
  const cached = relatedSuggestionsCache.get(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }

  const currentImdb = id.startsWith('tt') ? id : '';
  const currentNormTitle = normalizeTitleKey(nameOriginal || name);
  const currentNormAlt = normalizeTitleKey(name);

  let effectiveKpId = kpId.replace(/^kp_/, '').trim();
  if (!effectiveKpId && id.startsWith('kp_')) {
    effectiveKpId = id.replace(/^kp_/, '').trim();
  }
  if (!effectiveKpId && currentImdb) {
    effectiveKpId = await resolveKinopoiskFilmIdByImdb(currentImdb);
  }

  const franchiseItems: RelatedVodSuggestionItem[] = [];
  const similarItems: RelatedVodSuggestionItem[] = [];
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();

  if (currentImdb) seenIds.add(currentImdb);
  if (effectiveKpId) seenIds.add(`kp_${effectiveKpId}`);
  if (currentNormTitle) seenTitles.add(`${type}:${currentNormTitle}`);
  if (currentNormAlt) seenTitles.add(`${type}:${currentNormAlt}`);

  const addCandidate = (
    item: RelatedVodSuggestionItem,
    targetList: RelatedVodSuggestionItem[]
  ) => {
    if (!item.poster || item.poster.includes('no-poster')) return;
    const tKey = normalizeTitleKey(item.nameOriginal || item.name);
    const tAlt = normalizeTitleKey(item.name);
    const typedKey = tKey ? `${item.type}:${tKey}` : '';
    const typedAlt = tAlt ? `${item.type}:${tAlt}` : '';
    if (!item.id || seenIds.has(item.id)) return;
    if (item.kpId && seenIds.has(`kp_${item.kpId}`)) return;
    if ((typedKey && seenTitles.has(typedKey)) || (typedAlt && seenTitles.has(typedAlt))) return;

    seenIds.add(item.id);
    if (item.kpId) seenIds.add(`kp_${item.kpId}`);
    if (typedKey) seenTitles.add(typedKey);
    if (typedAlt) seenTitles.add(typedAlt);
    targetList.push(item);
  };

  // 1. Kinopoisk Sequels & Prequels + Similars in parallel
  const kpSequelsPromise = effectiveKpId
    ? fetch(
        `https://kinopoiskapiunofficial.tech/api/v2.1/films/${encodeURIComponent(effectiveKpId)}/sequels_and_prequels`,
        { headers: { 'X-API-KEY': KP_API_KEY } }
      )
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => [])
    : Promise.resolve([]);

  const kpSimilarsPromise = effectiveKpId
    ? fetch(
        `https://kinopoiskapiunofficial.tech/api/v2.2/films/${encodeURIComponent(effectiveKpId)}/similars`,
        { headers: { 'X-API-KEY': KP_API_KEY } }
      )
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => (Array.isArray(d?.items) ? d.items : []))
        .catch(() => [])
    : Promise.resolve([]);

  // 2. Franchise Prefix + Shared Universe Queries on Cinemeta
  const primaryTitle = (nameOriginal || name || '').trim();
  const baseFranchise = extractBaseFranchiseQuery(primaryTitle);

  const matchedUniverseGroup = SHARED_UNIVERSE_GROUPS.find((group) =>
    group.some((gTitle) => {
      const gKey = normalizeTitleKey(gTitle);
      return (
        gKey === currentNormTitle ||
        gKey === currentNormAlt ||
        (baseFranchise.length >= 4 && gKey === normalizeTitleKey(baseFranchise))
      );
    })
  );

  const cinemetaFranchisePromise = (async () => {
    const found: RelatedVodSuggestionItem[] = [];
    const queries = new Set<string>();
    if (baseFranchise && baseFranchise.length >= 3) {
      queries.add(baseFranchise);
    }
    if (matchedUniverseGroup) {
      for (const uTitle of matchedUniverseGroup.slice(0, 6)) {
        if (normalizeTitleKey(uTitle) !== currentNormTitle) {
          queries.add(uTitle);
        }
      }
    }

    const queryList = Array.from(queries).slice(0, 6);
    const searchPromises: Array<
      Promise<{ metas?: Array<Record<string, unknown>>; mediaType: 'movie' | 'series' }>
    > = [];

    for (const q of queryList) {
      searchPromises.push(
        fetch(
          `https://v3-cinemeta.strem.io/catalog/${type}/top/search=${encodeURIComponent(q)}.json`
        )
          .then((r) => (r.ok ? r.json() : { metas: [] }))
          .then((d) => ({ metas: d?.metas || [], mediaType: type }))
          .catch(() => ({ metas: [], mediaType: type }))
      );
      const otherType: 'movie' | 'series' = type === 'series' ? 'movie' : 'series';
      if (q === baseFranchise || matchedUniverseGroup) {
        searchPromises.push(
          fetch(
            `https://v3-cinemeta.strem.io/catalog/${otherType}/top/search=${encodeURIComponent(q)}.json`
          )
            .then((r) => (r.ok ? r.json() : { metas: [] }))
            .then((d) => ({ metas: d?.metas || [], mediaType: otherType }))
            .catch(() => ({ metas: [], mediaType: otherType }))
        );
      }
    }

    const results = await Promise.all(searchPromises);
    const baseNorm = normalizeTitleKey(baseFranchise);
    const universeNormSet = new Set(
      (matchedUniverseGroup || []).map((u) => normalizeTitleKey(u))
    );

    for (const { metas, mediaType } of results) {
      for (const m of (metas || []).slice(0, 8)) {
        const mId = String(m?.id || '');
        const mName = String(m?.name || '').trim();
        const rawPoster = typeof m.poster === 'string' ? m.poster.trim() : '';
        if (!mId.startsWith('tt') || !mName || !rawPoster.startsWith('http')) {
          continue;
        }
        if (mId === currentImdb) continue;

        const mNorm = normalizeTitleKey(mName);
        if (
          mediaType === type &&
          (mNorm === currentNormTitle || mNorm === currentNormAlt)
        ) {
          continue;
        }

        const ratingNum = parseFloat(String(m.imdbRating || '0')) || 0;
        const isUniverseExact = universeNormSet.has(mNorm);
        const isCounterpartFormat =
          mediaType !== type &&
          (mNorm === currentNormTitle ||
            mNorm === currentNormAlt ||
            (baseNorm.length >= 4 && mNorm === baseNorm));
        const isWordBoundaryPrefix =
          baseNorm.length >= 4 &&
          ratingNum >= 5.5 &&
          (mNorm.startsWith(`${baseNorm} `) ||
            baseNorm.startsWith(`${mNorm} `));

        if (isUniverseExact || isCounterpartFormat || isWordBoundaryPrefix) {
          found.push({
            id: mId,
            type: mediaType,
            name: mName,
            nameOriginal: mName,
            releaseInfo: m.releaseInfo ? String(m.releaseInfo) : undefined,
            imdbRating: m.imdbRating ? String(m.imdbRating) : undefined,
            poster: rawPoster,
            fallbackPoster: `https://images.metahub.space/poster/medium/${mId}/img`,
            relationKind: 'FRANCHISE',
          });
        }
      }
    }
    return found;
  })();

  const [kpSequelsRaw, kpSimilarsRaw, cinemetaFranchiseList] = await Promise.all([
    kpSequelsPromise,
    kpSimilarsPromise,
    cinemetaFranchisePromise,
  ]);

  // Enrich Kinopoisk Sequels & Similars with /api/v2.2/films/{id} for IMDb ID, year, rating & movie/series type
  const kpIdsToEnrich = new Set<number>();
  for (const item of kpSequelsRaw.slice(0, 12)) {
    const fId = Number(item?.filmId);
    if (fId > 0) kpIdsToEnrich.add(fId);
  }
  for (const item of kpSimilarsRaw.slice(0, 14)) {
    const fId = Number(item?.filmId);
    if (fId > 0) kpIdsToEnrich.add(fId);
  }

  await Promise.all(
    Array.from(kpIdsToEnrich).map(async (fId) => {
      if (kpFilmTypeCache.has(fId)) return;
      try {
        const r = await fetch(
          `https://kinopoiskapiunofficial.tech/api/v2.2/films/${fId}`,
          { headers: { 'X-API-KEY': KP_API_KEY } }
        );
        if (!r.ok) return;
        const d = (await r.json()) as {
          type?: string;
          serial?: boolean;
          imdbId?: string | null;
          nameOriginal?: string | null;
          nameEn?: string | null;
          year?: number | string | null;
          ratingImdb?: number | null;
          ratingKinopoisk?: number | null;
        };
        const isSer =
          Boolean(d.serial) ||
          d.type === 'TV_SERIES' ||
          d.type === 'MINI_SERIES' ||
          d.type === 'TV_SHOW';
        kpFilmTypeCache.set(fId, {
          isSeries: isSer,
          imdbId:
            typeof d.imdbId === 'string' && d.imdbId.startsWith('tt')
              ? d.imdbId
              : undefined,
          nameOriginal: d.nameOriginal || d.nameEn || undefined,
          year: d.year ? String(d.year) : undefined,
          rating: d.ratingImdb
            ? String(d.ratingImdb)
            : d.ratingKinopoisk
              ? String(d.ratingKinopoisk)
              : undefined,
        });
      } catch {
        // ignore
      }
    })
  );

  const mapKpEntry = (
    raw: {
      filmId?: number;
      nameRu?: string | null;
      nameEn?: string | null;
      nameOriginal?: string | null;
      posterUrl?: string | null;
      posterUrlPreview?: string | null;
      relationType?: string | null;
    },
    defaultRelation: RelatedVodSuggestionItem['relationKind']
  ): RelatedVodSuggestionItem | null => {
    const fId = Number(raw?.filmId);
    if (!fId) return null;
    const cachedMeta = kpFilmTypeCache.get(fId);
    const origTitle =
      raw.nameOriginal ||
      raw.nameEn ||
      cachedMeta?.nameOriginal ||
      raw.nameRu ||
      '';
    const displayTitle =
      lang === 'ru' ? raw.nameRu || origTitle : origTitle || raw.nameRu || '';
    if (!displayTitle) return null;
    if (
      lang !== 'ru' &&
      !raw.nameOriginal &&
      !raw.nameEn &&
      !cachedMeta?.nameOriginal &&
      /[а-яА-ЯёЁ]/.test(displayTitle)
    ) {
      return null;
    }

    const resolvedImdb = cachedMeta?.imdbId;
    const kpPoster =
      raw.posterUrlPreview ||
      raw.posterUrl ||
      `https://kinopoiskapiunofficial.tech/images/posters/kp_small/${fId}.jpg`;
    const primaryPoster =
      lang !== 'ru' && resolvedImdb
        ? `https://images.metahub.space/poster/medium/${resolvedImdb}/img`
        : kpPoster;

    const relUpper = String(raw.relationType || '').toUpperCase();
    const relationKind: RelatedVodSuggestionItem['relationKind'] =
      relUpper === 'SEQUEL'
        ? 'SEQUEL'
        : relUpper === 'PREQUEL'
          ? 'PREQUEL'
          : defaultRelation;

    return {
      id: resolvedImdb || `kp_${fId}`,
      kpId: String(fId),
      type: cachedMeta ? (cachedMeta.isSeries ? 'series' : 'movie') : type,
      name: displayTitle,
      nameOriginal: origTitle || displayTitle,
      releaseInfo: cachedMeta?.year,
      imdbRating: cachedMeta?.rating,
      poster: primaryPoster,
      fallbackPoster: kpPoster,
      relationKind,
    };
  };

  for (const seq of kpSequelsRaw) {
    const mapped = mapKpEntry(seq, 'FRANCHISE');
    if (mapped) addCandidate(mapped, franchiseItems);
  }

  for (const cf of cinemetaFranchiseList) {
    addCandidate(cf, franchiseItems);
  }

  // Sort franchise/trilogy items logically (chronologically by release year if part of a trilogy, or newest)
  franchiseItems.sort((a, b) => {
    const yA = extractYearNumber(a.releaseInfo);
    const yB = extractYearNumber(b.releaseInfo);
    if (yA > 0 && yB > 0 && yA !== yB) return yA - yB;
    return 0;
  });

  for (const sim of kpSimilarsRaw) {
    const mapped = mapKpEntry(sim, 'SIMILAR');
    if (mapped) addCandidate(mapped, similarItems);
  }

  // 3. If we need more similar items to fill a rich shelf (at least 12 total), query Cinemeta by Director/Cast or Primary Genre
  if (franchiseItems.length + similarItems.length < 12) {
    const extraQueries: Array<Promise<{ metas?: Array<Record<string, unknown>> }>> = [];
    const leadPerson = director[0] || cast[0] || '';
    if (leadPerson) {
      extraQueries.push(
        fetch(
          `https://v3-cinemeta.strem.io/catalog/${type}/top/search=${encodeURIComponent(leadPerson)}.json`
        )
          .then((r) => (r.ok ? r.json() : { metas: [] }))
          .catch(() => ({ metas: [] }))
      );
    }

    const englishGenreMap: Record<string, string> = {
      драма: 'Drama',
      боевик: 'Action',
      комедия: 'Comedy',
      триллер: 'Thriller',
      фантастика: 'Sci-Fi',
      ужасы: 'Horror',
      приключения: 'Adventure',
      криминал: 'Crime',
      детектив: 'Mystery',
      вестерн: 'Western',
      фэнтези: 'Fantasy',
      мелодрама: 'Romance',
      мультфильм: 'Animation',
      военный: 'War',
      история: 'History',
      биография: 'Biography',
    };
    const rawPrimaryGenre = (genres[0] || '').trim();
    const mappedGenre =
      englishGenreMap[rawPrimaryGenre.toLowerCase()] || rawPrimaryGenre;

    if (mappedGenre && /^[a-zA-Z-]+$/.test(mappedGenre)) {
      extraQueries.push(
        fetch(
          `https://v3-cinemeta.strem.io/catalog/${type}/top/genre=${encodeURIComponent(mappedGenre)}.json`
        )
          .then((r) => (r.ok ? r.json() : { metas: [] }))
          .catch(() => ({ metas: [] }))
      );
    }

    const extraResults = await Promise.all(extraQueries);
    const genreCandidates: RelatedVodSuggestionItem[] = [];
    for (const res of extraResults) {
      for (const m of (res?.metas || []).slice(0, 24)) {
        const mId = String(m?.id || '');
        const mName = String(m?.name || '').trim();
        const rawPoster = typeof m.poster === 'string' ? m.poster.trim() : '';
        if (!mId.startsWith('tt') || !mName || !rawPoster.startsWith('http')) {
          continue;
        }
        genreCandidates.push({
          id: mId,
          type,
          name: mName,
          nameOriginal: mName,
          releaseInfo: m.releaseInfo ? String(m.releaseInfo) : undefined,
          imdbRating: m.imdbRating ? String(m.imdbRating) : undefined,
          poster: rawPoster,
          fallbackPoster: `https://images.metahub.space/poster/medium/${mId}/img`,
          relationKind: 'SIMILAR',
        });
      }
    }

    // Sort genre candidates by newest production year first, then IMDb rating
    genreCandidates.sort((a, b) => {
      const yDiff =
        extractYearNumber(b.releaseInfo) - extractYearNumber(a.releaseInfo);
      if (yDiff !== 0) return yDiff;
      return (
        (parseFloat(b.imdbRating || '0') || 0) -
        (parseFloat(a.imdbRating || '0') || 0)
      );
    });

    for (const gc of genreCandidates) {
      if (franchiseItems.length + similarItems.length >= 18) break;
      addCandidate(gc, similarItems);
    }
  }

  const combined = [...franchiseItems, ...similarItems].slice(0, 18);
  relatedSuggestionsCache.set(cacheKey, combined);
  return combined;
}

import React, { useState } from 'react';
import {
  StreamingPlatformId,
  STREAMING_PLATFORMS,
} from '../../views/smartTvLampaHelpers';

export type PlatformLogoId = StreamingPlatformId | 'youtube';

interface StreamingPlatformLogoProps {
  platformId: PlatformLogoId;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Renders the authentic original vector logo & brand tile for each streaming platform:
 * - Netflix: Official red "N" ribbon emblem
 * - HBO Max: Official HBO emblem (with the target dot inside the O) on purple-blue gradient
 * - Apple TV+: Official Apple  emblem + tv+ typography
 * - Disney+: Official Disney+ shooting-star arch + D+ emblem on Disney royal blue
 * - Prime Video: Official "prime" + Amazon smile arrow on Prime cyan
 * - SkyShowtime: Official glossy "sky" emblem on indigo-violet gradient
 * - YouTube Premium: Official YouTube Red Play icon + YT
 */
export const StreamingPlatformLogo: React.FC<StreamingPlatformLogoProps> = ({
  platformId,
  size = 'sm',
  className = '',
}) => {
  const sizeClasses =
    size === 'xs'
      ? 'h-5 min-w-[32px] px-1.5 rounded-md'
      : size === 'sm'
        ? 'h-7 min-w-[44px] px-2 rounded-lg'
        : size === 'md'
          ? 'h-8 min-w-[52px] px-2.5 rounded-xl'
          : 'h-11 min-w-[68px] px-3.5 rounded-2xl';

  switch (platformId) {
    case 'netflix':
      return (
        <span
          className={`inline-flex items-center justify-center bg-[#111111] border border-[#E50914]/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] shrink-0 ${sizeClasses} ${className}`}
        >
          <svg
            viewBox="0 0 24 24"
            className={
              size === 'xs'
                ? 'w-3.5 h-3.5'
                : size === 'sm'
                  ? 'w-4 h-4'
                  : size === 'md'
                    ? 'w-5 h-5'
                    : 'w-6 h-6'
            }
            aria-label="Netflix"
          >
            <path
              fill="#B1060F"
              d="M5 2h4.2v20L5 21.5V2zm9.8 0H19v20l-4.2-.5V2z"
            />
            <path fill="#E50914" d="M5 2h4.3l9.7 20h-4.3L5 2z" />
          </svg>
        </span>
      );

    case 'hbo':
      return (
        <span
          className={`inline-flex items-center justify-center bg-gradient-to-br from-[#5b18eb] via-[#3b12b5] to-[#190960] border border-purple-400/50 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] shrink-0 ${sizeClasses} ${className}`}
        >
          <svg
            viewBox="0 0 64 24"
            className={
              size === 'xs'
                ? 'h-3 w-auto'
                : size === 'sm'
                  ? 'h-3.5 w-auto'
                  : size === 'md'
                    ? 'h-4 w-auto'
                    : 'h-5 w-auto'
            }
            aria-label="HBO Max"
          >
            {/* H */}
            <path
              fill="#FFFFFF"
              d="M2 4h5v6h5V4h5v16h-5v-6H7v6H2V4z"
            />
            {/* B */}
            <path
              fill="#FFFFFF"
              d="M19 4h9.5c2.8 0 4.8 1.5 4.8 3.9 0 1.6-.9 2.9-2.3 3.5 1.8.6 2.8 2 2.8 3.9 0 2.9-2.2 4.7-5.5 4.7H19V4zm5 6.3h3.2c1 0 1.6-.6 1.6-1.4 0-.9-.6-1.4-1.6-1.4H24v2.8zm0 6.2h3.6c1.1 0 1.8-.6 1.8-1.5 0-1-.7-1.5-1.8-1.5H24v3z"
            />
            {/* O with inner circle */}
            <path
              fill="#FFFFFF"
              fillRule="evenodd"
              d="M48.5 3.6C54.6 3.6 59 7.2 59 12s-4.4 8.4-10.5 8.4S38 16.8 38 12s4.4-8.4 10.5-8.4zm0 4.2c-2.6 0-4.5 1.8-4.5 4.2s1.9 4.2 4.5 4.2 4.5-1.8 4.5-4.2-1.9-4.2-4.5-4.2z"
            />
            <circle cx="48.5" cy="12" r="2.1" fill="#FFFFFF" />
          </svg>
        </span>
      );

    case 'apple':
      return (
        <span
          className={`inline-flex items-center justify-center bg-gradient-to-b from-white to-zinc-200 border border-white text-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] shrink-0 ${sizeClasses} ${className}`}
        >
          <svg
            viewBox="0 0 62 24"
            className={
              size === 'xs'
                ? 'h-3 w-auto'
                : size === 'sm'
                  ? 'h-3.5 w-auto'
                  : size === 'md'
                    ? 'h-4 w-auto'
                    : 'h-5 w-auto'
            }
            aria-label="Apple TV+"
          >
            {/* Apple silhouette */}
            <path
              fill="#09090B"
              d="M14.6 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.2.8-.7 0-1.7-.8-2.8-.7-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7 1.3 0 1.7.7 2.8.7 1.2 0 1.9-1 2.6-2.1.8-1.2 1.2-2.4 1.2-2.5-.1 0-2.5-1-2.5-3.4zM12.4 6.4c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.3-.5.6-1 1.6-.9 2.6 1 .1 2-.5 2.6-1.2z"
            />
            {/* tv+ */}
            <text
              x="21"
              y="18.2"
              fill="#09090B"
              fontFamily="-apple-system, BlinkMacSystemFont, Inter, sans-serif"
              fontWeight="900"
              fontSize="15.5"
              letterSpacing="-0.6"
            >
              tv+
            </text>
          </svg>
        </span>
      );

    case 'disney':
      return (
        <span
          className={`inline-flex items-center justify-center bg-gradient-to-br from-[#061539] via-[#0a2463] to-[#0052cc] border border-sky-400/50 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] shrink-0 ${sizeClasses} ${className}`}
        >
          <svg
            viewBox="0 0 64 26"
            className={
              size === 'xs'
                ? 'h-3.5 w-auto'
                : size === 'sm'
                  ? 'h-4 w-auto'
                  : size === 'md'
                    ? 'h-4.5 w-auto'
                    : 'h-5.5 w-auto'
            }
            aria-label="Disney+"
          >
            {/* Glowing shooting star arch */}
            <path
              d="M8 10C18 2.5 39 2.5 51 11"
              fill="none"
              stroke="#38BDF8"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <text
              x="6"
              y="21"
              fill="#FFFFFF"
              fontFamily="Georgia, serif"
              fontWeight="900"
              fontSize="15"
              letterSpacing="-0.3"
            >
              Disney
            </text>
            <path
              d="M54 10v8M50 14h8"
              stroke="#38BDF8"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
      );

    case 'prime':
      return (
        <span
          className={`inline-flex items-center justify-center bg-gradient-to-br from-[#00A8E1] to-[#0073a8] border border-cyan-300/60 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] shrink-0 ${sizeClasses} ${className}`}
        >
          <svg
            viewBox="0 0 64 26"
            className={
              size === 'xs'
                ? 'h-3.5 w-auto'
                : size === 'sm'
                  ? 'h-4 w-auto'
                  : size === 'md'
                    ? 'h-4.5 w-auto'
                    : 'h-5.5 w-auto'
            }
            aria-label="Prime Video"
          >
            <text
              x="6"
              y="15.5"
              fill="#FFFFFF"
              fontFamily="Inter, system-ui, sans-serif"
              fontWeight="900"
              fontSize="14.5"
              letterSpacing="-0.4"
            >
              prime
            </text>
            {/* Iconic Prime smile arrow */}
            <path
              d="M12 19.2c9.5 4.2 25 4.2 36.5-.4"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M44.5 17.2l4.8 1.3-2 4.2"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      );

    case 'paramount':
      return (
        <span
          className={`inline-flex items-center justify-center bg-gradient-to-br from-[#4338ca] via-[#6366f1] to-[#1e1b4b] border border-indigo-300/50 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] shrink-0 ${sizeClasses} ${className}`}
        >
          <svg
            viewBox="0 0 56 24"
            className={
              size === 'xs'
                ? 'h-3 w-auto'
                : size === 'sm'
                  ? 'h-3.5 w-auto'
                  : size === 'md'
                    ? 'h-4 w-auto'
                    : 'h-5 w-auto'
            }
            aria-label="SkyShowtime"
          >
            <text
              x="5"
              y="17.5"
              fill="#FFFFFF"
              fontFamily="Inter, system-ui, sans-serif"
              fontWeight="900"
              fontSize="16"
              letterSpacing="-0.5"
            >
              sky
            </text>
            <circle cx="46" cy="12" r="4" fill="#A5B4FC" />
          </svg>
        </span>
      );

    case 'youtube':
      return (
        <span
          className={`inline-flex items-center justify-center gap-1 bg-gradient-to-r from-[#FF0000] to-[#cc0000] border border-red-400/60 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] shrink-0 ${sizeClasses} ${className}`}
        >
          <svg
            viewBox="0 0 28 20"
            className={
              size === 'xs'
                ? 'w-4 h-3'
                : size === 'sm'
                  ? 'w-4.5 h-3.5'
                  : size === 'md'
                    ? 'w-5 h-4'
                    : 'w-6 h-4.5'
            }
            aria-label="YouTube"
          >
            <rect width="28" height="20" rx="5" fill="#FFFFFF" />
            <path d="M11 6l8 4-8 4V6z" fill="#FF0000" />
          </svg>
          <span className="text-[10px] font-black tracking-tight text-white">
            YT
          </span>
        </span>
      );
  }
};

export type KnownStudioKey =
  | 'warner'
  | 'universal'
  | 'paramount'
  | 'marvel'
  | 'disney'
  | 'pixar'
  | 'lucasfilm'
  | '20th'
  | 'sony'
  | 'a24'
  | 'lionsgate'
  | 'mgm'
  | 'legendary'
  | 'blumhouse'
  | 'miramax'
  | 'bbc'
  | 'fx'
  | 'amc'
  | 'showtime'
  | 'peacock'
  | 'hulu'
  | 'canal'
  | 'movistar'
  | 'skydance';

export interface ProducerStudioItem {
  name: string;
  role: 'network' | 'studio' | 'distributor';
  logoUrl?: string;
  platformId?: StreamingPlatformId;
  studioKey?: KnownStudioKey;
}

export interface ResolvedVodProviderAndStudios {
  platformId?: StreamingPlatformId;
  studios: ProducerStudioItem[];
  fallbackDescription?: string;
}

const platformByImdbMap = new Map<string, StreamingPlatformId>();
for (const plat of STREAMING_PLATFORMS) {
  for (const item of plat.flagshipSeries) {
    if (item.id && !platformByImdbMap.has(item.id)) {
      platformByImdbMap.set(item.id, plat.id);
    }
  }
}

let hasStartedCatalogPreload = false;

export function registerPlatformCatalogItems(
  platformId: StreamingPlatformId,
  ids: string[]
): void {
  for (const id of ids) {
    if (id && !platformByImdbMap.has(id)) {
      platformByImdbMap.set(id, platformId);
    }
  }
}

export function lookupPlatformByImdbId(
  imdbId?: string | null
): StreamingPlatformId | null {
  if (!imdbId) return null;
  return platformByImdbMap.get(imdbId) || null;
}

export function preloadAllPlatformCatalogIds(): void {
  if (hasStartedCatalogPreload) return;
  hasStartedCatalogPreload = true;
  const baseAddonUrl =
    'https://7a82163c306e-stremio-netflix-catalog-addon.baby-beamup.club/catalog';

  for (const plat of STREAMING_PLATFORMS) {
    for (const mType of ['series', 'movie'] as const) {
      fetch(`${baseAddonUrl}/${mType}/${plat.addonCode}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (Array.isArray(data?.metas)) {
            for (const m of data.metas) {
              if (m?.id && !platformByImdbMap.has(m.id)) {
                platformByImdbMap.set(m.id, plat.id);
              }
            }
          }
        })
        .catch(() => {});
    }
  }
}

export function matchKnownStudioKey(rawName: string): KnownStudioKey | undefined {
  const s = (rawName || '').toLowerCase();
  if (!s) return undefined;
  if (s.includes('marvel')) return 'marvel';
  if (s.includes('warner bros') || s.includes('new line cinema') || s.includes('dc studios')) return 'warner';
  if (s.includes('universal') || s.includes('focus features') || s.includes('working title')) return 'universal';
  if (s.includes('paramount')) return 'paramount';
  if (s.includes('20th century') || s.includes('twentieth century') || s.includes('searchlight')) return '20th';
  if (s.includes('pixar')) return 'pixar';
  if (s.includes('lucasfilm')) return 'lucasfilm';
  if (s.includes('walt disney')) return 'disney';
  if (s.includes('sony') || s.includes('columbia pictures') || s.includes('tristar')) return 'sony';
  if (/\ba24\b/.test(s)) return 'a24';
  if (s.includes('lionsgate') || s.includes('summit entertainment')) return 'lionsgate';
  if (s.includes('metro-goldwyn-mayer') || /\bmgm\b/.test(s)) return 'mgm';
  if (s.includes('legendary')) return 'legendary';
  if (s.includes('blumhouse')) return 'blumhouse';
  if (s.includes('miramax')) return 'miramax';
  if (/\bbbc\b/.test(s)) return 'bbc';
  if (/\bfx\b/.test(s) || s.includes('fx productions')) return 'fx';
  if (/\bamc\b/.test(s)) return 'amc';
  if (s.includes('showtime')) return 'showtime';
  if (s.includes('peacock')) return 'peacock';
  if (s.includes('hulu')) return 'hulu';
  if (s.includes('canal+') || s.includes('studiocanal')) return 'canal';
  if (s.includes('movistar')) return 'movistar';
  if (s.includes('skydance')) return 'skydance';
  return undefined;
}

export function matchStreamingPlatformByName(
  rawName: string
): StreamingPlatformId | undefined {
  const s = (rawName || '').toLowerCase();
  if (!s) return undefined;
  if (s.includes('netflix')) return 'netflix';
  if (s.includes('apple tv') || s === 'apple' || s.includes('apple inc') || s.includes('apple studios')) return 'apple';
  if (s.includes('hbo') || /\bmax\b/.test(s)) return 'hbo';
  if (s.includes('disney+') || s.includes('disney plus') || s.includes('hulu')) return 'disney';
  if (s.includes('prime video') || s.includes('amazon')) return 'prime';
  if (
    s.includes('skyshowtime') ||
    s.includes('paramount+') ||
    s.includes('peacock') ||
    s.includes('showtime') ||
    /\bsky\b/.test(s)
  ) {
    return 'paramount';
  }
  return undefined;
}

/**
 * Inspects release titles / torrent names (e.g., `Collision.2026.2160p.NF.WEB-DL...`, `Severance.S02E01.ATVP.WEB-DL...`)
 * to reliably identify the streaming platform provider.
 */
export function detectStreamingPlatformFromTexts(
  texts: Array<string | undefined | null>
): StreamingPlatformId | null {
  const scores: Record<StreamingPlatformId, number> = {
    netflix: 0,
    apple: 0,
    hbo: 0,
    disney: 0,
    paramount: 0,
    prime: 0,
  };

  for (const raw of texts) {
    if (!raw) continue;
    const t = String(raw);
    if (/(?:^|[.\s_\-[])(NF|NFLX|NETFLIX)(?:[.\s_\-\]]|$)/i.test(t)) {
      scores.netflix += 3;
    }
    if (/(?:^|[.\s_\-[])(ATVP|APTV|APPLE\s*TV\+?|APPLE\s*ORIGINAL)(?:[.\s_\-\]]|$)/i.test(t)) {
      scores.apple += 3;
    }
    if (
      /(?:^|[.\s_\-[])(HMAX|HBOMAX|HBO)(?:[.\s_\-\]]|$)/i.test(t) ||
      /(?:2160p|1080p|720p)[.\s_\-]+MAX[.\s_\-]+WEB/i.test(t) ||
      /[.\s_\-]+MAX[.\s_\-]+(?:WEB-DL|WEBRip)/i.test(t)
    ) {
      scores.hbo += 3;
    }
    if (/(?:^|[.\s_\-[])(DSNP|DSNY|DISNEY\+?|HULU)(?:[.\s_\-\]]|$)/i.test(t)) {
      scores.disney += 3;
    }
    if (
      /(?:^|[.\s_\-[])(PMTP|PCOK|SKST|SKYSHOWTIME|PEACOCK|SHOWTIME|PARAMOUNT\+)(?:[.\s_\-\]]|$)/i.test(
        t
      )
    ) {
      scores.paramount += 3;
    }
    if (/(?:^|[.\s_\-[])(AMZN|AMAZON|PRIME\s*VIDEO)(?:[.\s_\-\]]|$)/i.test(t)) {
      // Slightly lower weight than NF/ATVP/HMAX/DSNP in case a movie has both exclusive tag & AMZN VOD rip
      scores.prime += 2;
    }
  }

  let bestPlat: StreamingPlatformId | null = null;
  let bestScore = 0;
  for (const [plat, sc] of Object.entries(scores) as Array<
    [StreamingPlatformId, number]
  >) {
    if (sc > bestScore) {
      bestScore = sc;
      bestPlat = plat;
    }
  }
  return bestPlat;
}

export function getDefaultStudioForPlatform(
  platformId: StreamingPlatformId
): ProducerStudioItem {
  switch (platformId) {
    case 'netflix':
      return {
        name: 'Netflix Studios',
        role: 'network',
        platformId: 'netflix',
      };
    case 'apple':
      return {
        name: 'Apple Original Films',
        role: 'network',
        platformId: 'apple',
      };
    case 'hbo':
      return {
        name: 'HBO Entertainment',
        role: 'network',
        platformId: 'hbo',
      };
    case 'disney':
      return {
        name: 'Walt Disney Studios',
        role: 'network',
        platformId: 'disney',
        studioKey: 'disney',
      };
    case 'prime':
      return {
        name: 'Amazon MGM Studios',
        role: 'network',
        platformId: 'prime',
        studioKey: 'mgm',
      };
    case 'paramount':
      return {
        name: 'Paramount / Sky Studios',
        role: 'network',
        platformId: 'paramount',
        studioKey: 'paramount',
      };
  }
}

const wikidataStudioCache = new Map<string, ResolvedVodProviderAndStudios>();

export async function fetchVodProviderAndStudiosByImdb(
  imdbId: string
): Promise<ResolvedVodProviderAndStudios> {
  const cleanImdb = (imdbId || '').trim();
  if (!/^tt\d+$/.test(cleanImdb)) {
    return { studios: [] };
  }
  const cached = wikidataStudioCache.get(cleanImdb);
  if (cached) return cached;

  const sparql = `SELECT ?networkLabel ?networkLogo ?distLabel ?distLogo ?prodLabel ?prodLogo ?descRo ?descEn WHERE {
  ?item wdt:P345 "${cleanImdb}".
  OPTIONAL { ?item wdt:P449 ?network. OPTIONAL { ?network wdt:P154 ?networkLogo. } }
  OPTIONAL { ?item wdt:P750 ?dist. OPTIONAL { ?dist wdt:P154 ?distLogo. } }
  OPTIONAL { ?item wdt:P272 ?prod. OPTIONAL { ?prod wdt:P154 ?prodLogo. } }
  OPTIONAL { ?item schema:description ?descRo. FILTER(LANG(?descRo) = "ro") }
  OPTIONAL { ?item schema:description ?descEn. FILTER(LANG(?descEn) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ro,es,fr". }
} LIMIT 30`;

  try {
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(
      sparql
    )}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/sparql-results+json',
      },
    });
    if (!res.ok) {
      return { studios: [] };
    }
    const data = await res.json();
    const bindings: Array<Record<string, { value?: string }>> =
      data?.results?.bindings || [];

    let detectedPlatform: StreamingPlatformId | undefined =
      lookupPlatformByImdbId(cleanImdb) || undefined;
    const studios: ProducerStudioItem[] = [];
    const seenNames = new Set<string>();
    let fallbackDescription: string | undefined;

    const normalizeCommonsLogo = (rawUri?: string): string | undefined => {
      if (!rawUri) return undefined;
      return rawUri.replace(/^http:\/\//i, 'https://') + '?width=220';
    };

    const addStudio = (
      rawName: string | undefined,
      role: ProducerStudioItem['role'],
      rawLogo?: string
    ) => {
      const name = (rawName || '').trim();
      if (!name || /^Q\d+$/i.test(name)) return;
      // Skip regional theatrical sub-distributors like InterCom
      if (/^(intercom|sf studios|forum film|bontonfilm)$/i.test(name)) return;
      const key = name.toLowerCase();
      if (seenNames.has(key)) return;
      seenNames.add(key);

      const plat = matchStreamingPlatformByName(name);
      if (plat && !detectedPlatform) {
        detectedPlatform = plat;
      }
      const studioKey = matchKnownStudioKey(name);
      studios.push({
        name,
        role,
        logoUrl: normalizeCommonsLogo(rawLogo),
        platformId: plat,
        studioKey,
      });
    };

    for (const row of bindings) {
      if (!fallbackDescription) {
        fallbackDescription = row.descRo?.value || row.descEn?.value;
      }
      addStudio(row.networkLabel?.value, 'network', row.networkLogo?.value);
      addStudio(row.prodLabel?.value, 'studio', row.prodLogo?.value);
      addStudio(row.distLabel?.value, 'distributor', row.distLogo?.value);
    }

    if (detectedPlatform) {
      registerPlatformCatalogItems(detectedPlatform, [cleanImdb]);
    }

    const result: ResolvedVodProviderAndStudios = {
      platformId: detectedPlatform,
      studios: studios.slice(0, 5),
      fallbackDescription,
    };
    wikidataStudioCache.set(cleanImdb, result);
    return result;
  } catch {
    return { studios: [] };
  }
}

/**
 * Renders an authentic studio/producer vector emblem + name pill
 * for major Hollywood & international studios, streaming producers, or Wikimedia Commons studio SVGs.
 */
export const ProducerStudioLogoBadge: React.FC<{
  studio: ProducerStudioItem;
  size?: 'sm' | 'md';
  className?: string;
}> = ({ studio, size = 'sm', className = '' }) => {
  const [imgFailed, setImgFailed] = useState(false);

  const renderKnownEmblem = (sKey?: KnownStudioKey) => {
    switch (sKey) {
      case 'marvel':
        return (
          <span className="px-1.5 py-0.5 rounded bg-[#E62429] text-white text-[10px] font-black tracking-tighter uppercase leading-none shadow-sm">
            MARVEL
          </span>
        );
      case 'warner':
        return (
          <span className="px-1.5 py-0.5 rounded bg-gradient-to-b from-[#0033A0] to-[#001F60] border border-amber-400/80 text-amber-300 text-[10px] font-black tracking-tight leading-none shadow-sm">
            WB
          </span>
        );
      case 'universal':
        return (
          <span className="px-1.5 py-0.5 rounded bg-gradient-to-r from-sky-900 to-indigo-950 border border-sky-300/50 text-white text-[9px] font-black tracking-wider uppercase leading-none">
            UNIVERSAL
          </span>
        );
      case 'paramount':
        return (
          <span className="px-1.5 py-0.5 rounded bg-gradient-to-b from-[#0057B8] to-[#002D62] border border-sky-300/40 text-white text-[9px] font-black tracking-tight uppercase leading-none">
            ▲ PARAMOUNT
          </span>
        );
      case '20th':
        return (
          <span className="px-1.5 py-0.5 rounded bg-gradient-to-b from-amber-500/90 to-amber-700 text-zinc-950 text-[9px] font-black tracking-tight uppercase leading-none">
            20th
          </span>
        );
      case 'sony':
        return (
          <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-950 text-[9px] font-black tracking-widest uppercase leading-none">
            SONY
          </span>
        );
      case 'a24':
        return (
          <span className="px-1.5 py-0.5 rounded bg-white text-zinc-950 font-serif text-[10px] font-black tracking-widest leading-none">
            A24
          </span>
        );
      case 'lionsgate':
        return (
          <span className="px-1.5 py-0.5 rounded bg-amber-400 text-zinc-950 text-[9px] font-black tracking-wider uppercase leading-none">
            LIONSGATE
          </span>
        );
      case 'mgm':
        return (
          <span className="px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-500 to-yellow-300 text-zinc-950 text-[9px] font-black tracking-wider uppercase leading-none">
            MGM
          </span>
        );
      case 'legendary':
        return (
          <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-950 text-[9px] font-black tracking-wider uppercase leading-none">
            ❖ LEGENDARY
          </span>
        );
      case 'blumhouse':
        return (
          <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-zinc-950 text-[9px] font-black tracking-wider uppercase leading-none">
            BH
          </span>
        );
      case 'miramax':
        return (
          <span className="px-1.5 py-0.5 rounded bg-white text-zinc-950 text-[9px] font-black tracking-widest uppercase leading-none">
            MIRAMAX
          </span>
        );
      case 'bbc':
        return (
          <span className="inline-flex items-center gap-0.5">
            <span className="px-1 py-0.5 bg-white text-zinc-950 text-[9px] font-black leading-none">
              B
            </span>
            <span className="px-1 py-0.5 bg-white text-zinc-950 text-[9px] font-black leading-none">
              B
            </span>
            <span className="px-1 py-0.5 bg-white text-zinc-950 text-[9px] font-black leading-none">
              C
            </span>
          </span>
        );
      case 'fx':
        return (
          <span className="px-1.5 py-0.5 rounded bg-white text-zinc-950 text-[10px] font-black tracking-tight leading-none">
            FX
          </span>
        );
      case 'amc':
        return (
          <span className="px-1.5 py-0.5 rounded bg-amber-400 text-zinc-950 text-[10px] font-black uppercase leading-none">
            amc
          </span>
        );
      case 'showtime':
        return (
          <span className="px-1.5 py-0.5 rounded bg-[#E50914] text-white text-[9px] font-black uppercase leading-none">
            SHO
          </span>
        );
      case 'peacock':
        return (
          <span className="px-1.5 py-0.5 rounded bg-white text-zinc-950 text-[9px] font-black uppercase leading-none">
            PEACOCK
          </span>
        );
      case 'hulu':
        return (
          <span className="px-1.5 py-0.5 rounded bg-[#1CE783] text-zinc-950 text-[10px] font-black lowercase leading-none">
            hulu
          </span>
        );
      case 'canal':
        return (
          <span className="px-1.5 py-0.5 rounded bg-zinc-950 border border-white/40 text-white text-[9px] font-black uppercase leading-none">
            CANAL+
          </span>
        );
      case 'movistar':
        return (
          <span className="px-1.5 py-0.5 rounded bg-[#019DF4] text-white text-[10px] font-black leading-none">
            M+
          </span>
        );
      case 'skydance':
        return (
          <span className="px-1.5 py-0.5 rounded bg-sky-400 text-zinc-950 text-[9px] font-black uppercase leading-none">
            SKYDANCE
          </span>
        );
      case 'disney':
      case 'pixar':
      case 'lucasfilm':
        return (
          <span className="px-1.5 py-0.5 rounded bg-[#0052cc] text-white text-[9px] font-black uppercase leading-none">
            {sKey.toUpperCase()}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-2 ${
        size === 'md'
          ? 'px-3 py-1.5 rounded-xl text-xs sm:text-sm'
          : 'px-2.5 py-1 rounded-full text-xs'
      } bg-white/10 backdrop-blur-xl border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] text-white font-bold shrink-0 ${className}`}
    >
      {studio.platformId ? (
        <StreamingPlatformLogo platformId={studio.platformId} size="xs" />
      ) : studio.studioKey && renderKnownEmblem(studio.studioKey) ? (
        renderKnownEmblem(studio.studioKey)
      ) : studio.logoUrl && !imgFailed ? (
        <span className="h-5 px-1.5 rounded bg-white/95 inline-flex items-center justify-center shrink-0 shadow-sm">
          <img
            src={studio.logoUrl}
            alt={studio.name}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="max-h-3.5 max-w-[56px] w-auto object-contain"
          />
        </span>
      ) : (
        <span className="w-5 h-5 rounded-md bg-white/15 border border-white/20 inline-flex items-center justify-center text-[10px] font-black text-amber-300 shrink-0">
          🎬
        </span>
      )}
      <span className="truncate max-w-[180px]">{studio.name}</span>
    </span>
  );
};

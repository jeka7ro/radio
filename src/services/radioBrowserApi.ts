import { Country, Station } from '../types/radio';
import { getCachedData, setCachedData, DEFAULT_TTL_MS } from './cacheService';
import {
  extractDomainFromUrl,
  getHighResOfficialLogo,
  isLowResIcoUrl,
} from './stationLogoService';

/**
 * Official Radio Browser mirrors with automatic fallback.
 * Ordered with the fastest responsive mirrors first, including all required mirrors.
 */
export const RADIO_BROWSER_SERVERS = [
  'https://de1.api.radio-browser.info',
  'https://all.api.radio-browser.info',
  'https://de2.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
] as const;

export const APP_USER_AGENT = 'AetherRadio/1.0 (https://aetherradio.web.app)';

let preferredServerIndex = 0;

export function getActiveServerHost(): string {
  return RADIO_BROWSER_SERVERS[preferredServerIndex].replace('https://', '');
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5500
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Executes a GET or POST request against Radio Browser API with automatic failover
 * across all mirror servers.
 */
async function requestWithFallback<T>(path: string, options: RequestInit = {}): Promise<T> {
  const totalServers = RADIO_BROWSER_SERVERS.length;
  let lastError: unknown = null;
  const isSmartTvOrLan =
    typeof window !== 'undefined' &&
    (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
      window.location.hostname
    ) ||
      /Web0S|WebOS|NetCast|SmartTV|Tizen|Large Screen|MSX/i.test(
        navigator.userAgent
      ));

  for (let attempt = 0; attempt < totalServers; attempt++) {
    const serverIdx = (preferredServerIndex + attempt) % totalServers;
    const baseUrl = RADIO_BROWSER_SERVERS[serverIdx];
    const directUrl = `${baseUrl}${path}`;
    const url = isSmartTvOrLan
      ? `/api/tv-proxy?url=${encodeURIComponent(directUrl)}`
      : directUrl;

    try {
      const response = await fetchWithTimeout(url, {
        ...options,
        headers: {
          Accept: 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${baseUrl}`);
      }

      const data = (await response.json()) as T;
      preferredServerIndex = serverIdx;
      return data;
    } catch (err) {
      lastError = err;
    }
  }

  // Final fallback via /api/tv-proxy if direct browser fetch failed (e.g. Let's Encrypt root CA on older devices)
  if (!isSmartTvOrLan) {
    try {
      const fallbackUrl = `/api/tv-proxy?url=${encodeURIComponent(
        `${RADIO_BROWSER_SERVERS[0]}${path}`
      )}`;
      const res = await fetchWithTimeout(fallbackUrl, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        return (await res.json()) as T;
      }
    } catch {
      // ignore
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('All Radio Browser API servers are currently unreachable.');
}

/**
 * Fetches and caches the list of countries (TTL: 1 hour).
 * Deduplicates ISO codes and filters out invalid entries.
 */
export async function fetchCountries(forceRefresh = false): Promise<Country[]> {
  const cacheKey = 'countries_list';
  if (!forceRefresh) {
    const cached = getCachedData<Country[]>(cacheKey);
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  const rawCountries = await requestWithFallback<Country[]>('/json/countries?hidebroken=true');

  const byIso = new Map<string, Country>();
  for (const item of rawCountries) {
    const iso = (item.iso_3166_1 || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(iso) || item.stationcount <= 0) continue;

    const existing = byIso.get(iso);
    if (existing) {
      existing.stationcount += item.stationcount;
    } else {
      byIso.set(iso, {
        name: item.name || iso,
        iso_3166_1: iso,
        stationcount: item.stationcount,
      });
    }
  }

  const normalized = Array.from(byIso.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  setCachedData(cacheKey, normalized, DEFAULT_TTL_MS);
  return normalized;
}

function normalizeStationsList(
  rawStations: Station[],
  fallbackCountryCode = ''
): Station[] {
  const seenUuids = new Set<string>();
  const cleaned: Station[] = [];

  // Map homepage domain -> existing high-res (non-.ico) favicon from sibling stations
  const domainFaviconMap = new Map<string, string>();
  for (const st of rawStations) {
    const fav = (st.favicon || '').trim();
    const dom = extractDomainFromUrl(st.homepage);
    if (fav && !isLowResIcoUrl(fav) && dom && !domainFaviconMap.has(dom)) {
      domainFaviconMap.set(dom, fav);
    }
  }

  for (const st of rawStations) {
    if (!st.stationuuid || seenUuids.has(st.stationuuid)) continue;
    let streamUrl = (st.url_resolved || st.url || '').trim();
    if (!streamUrl) continue;

    // Upgrade legacy Radio Monte Carlo HTTP edge URLs to their official HTTPS Icecast server
    if (/^http:\/\/edge\.radiomontecarlo\.net\//i.test(streamUrl)) {
      streamUrl = streamUrl.replace(
        /^http:\/\/edge\.radiomontecarlo\.net\//i,
        'https://icy.unitedradio.it/'
      );
    }

    // Upgrade retired AntenaPlay live7digi radio edge (Radio ZU, Radio DOR, etc.) to active live4ro edge
    if (/\/\/live7digi\.antenaplay\.ro\//i.test(streamUrl)) {
      streamUrl = streamUrl.replace(
        /\/\/live7digi\.antenaplay\.ro\//gi,
        '//live4ro.antenaplay.ro/'
      );
    }

    const homepage = (st.homepage || '').trim();
    const domain = extractDomainFromUrl(homepage);
    let favicon = (st.favicon || '').trim();

    const highResOfficial = getHighResOfficialLogo(st.name || '', homepage);
    if (highResOfficial) {
      favicon = highResOfficial;
    } else if (!favicon || isLowResIcoUrl(favicon)) {
      if (domain && domainFaviconMap.has(domain)) {
        favicon = domainFaviconMap.get(domain)!;
      }
    }

    seenUuids.add(st.stationuuid);
    cleaned.push({
      stationuuid: st.stationuuid,
      name: (st.name || 'Unknown Station').trim(),
      url: (st.url || streamUrl)
        .trim()
        .replace(/\/\/live7digi\.antenaplay\.ro\//gi, '//live4ro.antenaplay.ro/'),
      url_resolved: streamUrl,
      homepage,
      favicon,
      tags: (st.tags || '').trim(),
      country: (st.country || '').trim(),
      countrycode: (st.countrycode || fallbackCountryCode).toUpperCase(),
      language: (st.language || '').trim(),
      votes: Number(st.votes) || 0,
      codec: (st.codec || '').trim(),
      bitrate: Number(st.bitrate) || 0,
      hls: Number(st.hls) || 0,
      clickcount: Number(st.clickcount) || 0,
      clicktrend: Number(st.clicktrend) || 0,
      lastcheckok: st.lastcheckok,
    });
  }

  return cleaned;
}

/**
 * Fetches and caches stations for a given country ISO code, or top global stations if countryCode === 'ALL' (TTL: 1 hour).
 */
export async function fetchStationsByCountry(
  countryCode: string,
  forceRefresh = false
): Promise<Station[]> {
  const upperCode = countryCode.trim().toUpperCase();
  const isGlobal = upperCode === 'ALL';
  const cacheKey = `stations_${upperCode}`;

  if (!forceRefresh) {
    const cached = getCachedData<Station[]>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const query = new URLSearchParams({
    hidebroken: 'true',
    order: 'votes',
    reverse: 'true',
    limit: isGlobal ? '600' : '800',
  });

  if (!isGlobal) {
    query.set('countrycode', upperCode);
  }

  const rawStations = await requestWithFallback<Station[]>(
    `/json/stations/search?${query.toString()}`
  );

  const cleaned = normalizeStationsList(rawStations, isGlobal ? '' : upperCode);
  setCachedData(cacheKey, cleaned, DEFAULT_TTL_MS);
  return cleaned;
}

/**
 * Searches stations globally across ALL countries in the Radio Browser catalog.
 */
export async function searchStationsGlobal(searchTerm: string): Promise<Station[]> {
  const trimmed = searchTerm.trim();
  if (!trimmed) {
    return fetchStationsByCountry('ALL');
  }

  const normalizedKey = trimmed.toLowerCase();
  const cacheKey = `global_search_${normalizedKey}`;
  const cached = getCachedData<Station[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const compact = normalizedKey.replace(/[\s\-_]+/g, '');
  const queriesToRun: string[] = [trimmed];

  if (compact !== normalizedKey && compact.length >= 3) {
    queriesToRun.push(compact);
  }
  if (compact.includes('montecarlo')) {
    queriesToRun.push('RMC');
  }

  const responses = await Promise.allSettled(
    queriesToRun.map((q) => {
      const params = new URLSearchParams({
        name: q,
        hidebroken: 'true',
        order: 'votes',
        reverse: 'true',
        limit: '600',
      });
      return requestWithFallback<Station[]>(
        `/json/stations/search?${params.toString()}`
      );
    })
  );

  const combined: Station[] = [];
  for (const res of responses) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      combined.push(...res.value);
    }
  }

  const cleaned = normalizeStationsList(combined);
  setCachedData(cacheKey, cleaned, DEFAULT_TTL_MS);
  return cleaned;
}

/**
 * Registers a station play click with Radio Browser API (/json/url/{stationuuid})
 * as required by Radio Browser guidelines. Fire-and-forget so it never blocks playback.
 */
export async function registerStationClick(stationuuid: string): Promise<void> {
  if (!stationuuid) return;
  try {
    await requestWithFallback<{ ok: boolean; url?: string }>(
      `/json/url/${encodeURIComponent(stationuuid)}`
    );
  } catch {
    // Non-fatal: do not interrupt user playback if analytics click fails
  }
}

/**
 * Determines if a stream URL is plain HTTP when the app is served over HTTPS.
 */
export function isInsecureHttpStream(streamUrl: string): boolean {
  if (!streamUrl) return false;
  return streamUrl.trim().toLowerCase().startsWith('http://');
}

/**
 * Converts an http:// URL to https:// for attempting an upgraded connection.
 */
export function toHttpsStreamUrl(streamUrl: string): string {
  return streamUrl.trim().replace(/^http:\/\//i, 'https://');
}

/**
 * Checks whether a station stream uses HLS (.m3u8 or station.hls === 1).
 */
export function isHlsStation(station: Station, activeUrl?: string): boolean {
  if (station.hls === 1) return true;
  const target = (activeUrl || station.url_resolved || station.url || '').toLowerCase();
  return target.includes('.m3u8') || target.includes('application/vnd.apple.mpegurl');
}


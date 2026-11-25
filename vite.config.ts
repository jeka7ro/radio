import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import { spawn } from 'node:child_process';

function isPrivateOrReservedDevIp(ipRaw: string): boolean {
  const ip = String(ipRaw || '').replace(/^\[|\]$/g, '').toLowerCase().trim();
  if (!ip) return true;
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]), c = Number(m[3]), d = Number(m[4]);
    if (a > 255 || b > 255 || c > 255 || d > 255) return true;
    if (a === 127 || a === 10 || a === 0 || a >= 224) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (
    ip === '::' || ip === '::1' ||
    /^f[cd][0-9a-f]{2}:/i.test(ip) ||
    /^fe[89ab][0-9a-f]:/i.test(ip) ||
    /^ff[0-9a-f]{2}:/i.test(ip)
  ) return true;
  if (ip.startsWith('::ffff:')) {
    const mapped = ip.slice(7);
    if (isPrivateOrReservedDevIp(mapped)) return true;
    const hm = mapped.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (hm) {
      const hi = parseInt(hm[1], 16), lo = parseInt(hm[2], 16);
      if (isPrivateOrReservedDevIp(`${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`)) return true;
    }
  }
  return false;
}

function isDisallowedDevTargetUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return true;
    const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '').trim();
    if (
      !h || h === 'localhost' || h === '0.0.0.0' ||
      h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') ||
      h === 'metadata' || h === 'metadata.google.internal' ||
      isPrivateOrReservedDevIp(h)
    ) return true;
    if (u.pathname.toLowerCase().includes('/api/tv-proxy')) return true;
    return false;
  } catch {
    return true;
  }
}

async function fetchSafeDevExternalUrl(targetUrl: string, init: RequestInit = {}, maxRedirects = 5): Promise<Response> {
  let cur = targetUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (isDisallowedDevTargetUrl(cur)) {
      throw new Error('Forbidden proxy target');
    }
    const parsed = new URL(cur);
    const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && !host.includes(':')) {
      const recs = await dns.lookup(host, { all: true });
      if (!recs.length || recs.some((r) => isPrivateOrReservedDevIp(r.address))) {
        throw new Error('Forbidden proxy target (private DNS)');
      }
    }
    const r = await fetch(cur, { ...init, redirect: 'manual' });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location') && hop < maxRedirects) {
      try { r.body?.cancel(); } catch { /* ignore */ }
      cur = new URL(r.headers.get('location')!, cur).toString();
      continue;
    }
    return r;
  }
  throw new Error('Too many proxy redirects');
}

function sanitizeDevProxyContentType(rawCt: string | null | undefined, fallback: string): string {
  const base = String(rawCt || '').split(';')[0].trim().toLowerCase();
  if (!base) return fallback;
  if (
    base === 'text/html' || base === 'application/xhtml+xml' ||
    base === 'image/svg+xml' || base === 'text/javascript' ||
    base === 'application/javascript' || base === 'application/x-javascript'
  ) return 'application/octet-stream';
  return String(rawCt);
}
import ffmpegPath from 'ffmpeg-static';
import { handleFileListRequest } from './src/server/filelistServer';
import { handleYouTubeRequest } from './src/server/youtubeServer';

interface EpgProgrammeItem {
  t: string;
  d?: string;
  c?: string;
  s: number;
  e: number;
}

interface ParsedEpgFeed {
  timestamp: number;
  channels: Record<
    string,
    {
      icon: string;
      programmes: EpgProgrammeItem[];
    }
  >;
  archiveChannels: Record<
    string,
    {
      icon: string;
      displayName: string;
      programmes: EpgProgrammeItem[];
    }
  >;
  keyMap: Record<string, string>;
}

const epgFeedCache = new Map<string, ParsedEpgFeed>();
const epgFeedInFlight = new Map<string, Promise<ParsedEpgFeed>>();
const EPG_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function normalizeEpgKey(raw: string, stripGenericWords = false): string {
  const base = (raw || '')
    .toLowerCase()
    .replace(/[ăâäàá]/g, 'a')
    .replace(/[îïìí]/g, 'i')
    .replace(/[șşš]/g, 's')
    .replace(/[țţ]/g, 't')
    .replace(/[éèêë]/g, 'e')
    .replace(/[óòôö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\(\s*(1080[pi]?|720[pi]?|576[pi]?|480[pi]?|4k|uhd|hd|sd|russia|romania|moldova|архив|live|\d+)\s*\)/gi, ' ')
    .replace(/\([^+)]*\)/g, ' ')
    .split('/')[0]
    .replace(/\.(ro|ru|md|uk|gb|us|de|fr|it|es|ua|by|kz)(@\w+)?$/i, '')
    .replace(/\b(hd|fhd|uhd|4k|sd|live|orig|50fps|архив)\b/gi, ' ');

  const cleanBase = base.replace(/[^a-z0-9а-яё+]+/gi, '').trim();
  if (!stripGenericWords) {
    return cleanBase;
  }

  const stripped = base
    .replace(/\b(tv|тв|канал|channel|телеканал|romania|russia|moldova)\b/gi, ' ')
    .replace(/[^a-z0-9а-яё+]+/gi, '')
    .trim();

  return stripped.length >= 3 ? stripped : cleanBase;
}

function parseXmltvTimestamp(raw: string): number {
  const m = raw
    .trim()
    .match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
  if (!m) return 0;
  const tz = m[7] ? `${m[7].slice(0, 3)}:${m[7].slice(3)}` : 'Z';
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${tz}`;
  return Date.parse(iso) || 0;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function fetchAndParseXmltvFeed(feedUrl: string): Promise<ParsedEpgFeed> {
  const now = Date.now();
  const cached = epgFeedCache.get(feedUrl);
  if (cached && now - cached.timestamp < EPG_CACHE_TTL_MS) {
    return cached;
  }

  const existingPromise = epgFeedInFlight.get(feedUrl);
  if (existingPromise) {
    return existingPromise;
  }

  const loadPromise = (async (): Promise<ParsedEpgFeed> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 14000);
    const res = await fetch(feedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching EPG ${feedUrl}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const xml = feedUrl.endsWith('.gz')
      ? zlib.gunzipSync(buf).toString('utf8')
      : buf.toString('utf8');

    const channels: ParsedEpgFeed['channels'] = {};
    const archiveChannels: ParsedEpgFeed['archiveChannels'] = {};
    const keyMap: Record<string, string> = {};

    const firstProgIdx = xml.indexOf('<programme ');
    const chSection = firstProgIdx > 0 ? xml.slice(0, firstProgIdx) : xml;

    const chRegex = /<channel\s+id="([^"]+)">([\s\S]*?)<\/channel>/g;
    let chMatch: RegExpExecArray | null;
    while ((chMatch = chRegex.exec(chSection)) !== null) {
      const id = chMatch[1].trim();
      const body = chMatch[2];
      const iconMatch = body.match(/<icon\s+src="([^"]+)"/i);
      const icon = iconMatch?.[1]?.trim() || '';

      channels[id] = { icon, programmes: [] };
      let firstDisplayName = id;

      const idKey1 = normalizeEpgKey(id, false);
      const idKey2 = normalizeEpgKey(id, true);
      if (idKey1 && !keyMap[idKey1]) keyMap[idKey1] = id;
      if (idKey2 && !keyMap[idKey2]) keyMap[idKey2] = id;

      const dnRegex = /<display-name[^>]*>([^<]+)<\/display-name>/gi;
      let dnMatch: RegExpExecArray | null;
      while ((dnMatch = dnRegex.exec(body)) !== null) {
        const name = decodeXmlEntities(dnMatch[1].trim());
        if (firstDisplayName === id && name) {
          firstDisplayName = name;
        }
        const k1 = normalizeEpgKey(name, false);
        const k2 = normalizeEpgKey(name, true);
        if (k1 && !keyMap[k1]) keyMap[k1] = id;
        if (k2 && !keyMap[k2]) keyMap[k2] = id;
      }

      archiveChannels[id] = {
        icon,
        displayName: firstDisplayName,
        programmes: [],
      };
    }

    if (firstProgIdx > 0) {
      const minArchiveStop = now - 7 * 24 * 60 * 60 * 1000; // 7 days archive
      const minLiveStop = now - 5 * 60 * 1000;
      const maxStart = now + 12 * 60 * 60 * 1000;
      const progRegex = /<programme\s+([^>]+)>([\s\S]*?)<\/programme>/g;
      progRegex.lastIndex = firstProgIdx;

      let progMatch: RegExpExecArray | null;
      while ((progMatch = progRegex.exec(xml)) !== null) {
        const attrs = progMatch[1];
        const startStr = attrs.match(/start="([^"]+)"/)?.[1];
        const stopStr = attrs.match(/stop="([^"]+)"/)?.[1];
        const chId = attrs.match(/channel="([^"]+)"/)?.[1];
        if (!startStr || !stopStr || !chId) continue;

        const chEntry = channels[chId];
        const archEntry = archiveChannels[chId];
        if (!chEntry || !archEntry) continue;

        const s = parseXmltvTimestamp(startStr);
        const e = parseXmltvTimestamp(stopStr);
        if (!s || !e || e < minArchiveStop || s > maxStart) continue;

        const body = progMatch[2];
        const titleRaw = body.match(/<title[^>]*>([^<]+)<\/title>/)?.[1];
        if (!titleRaw) continue;

        const descRaw = body.match(/<desc[^>]*>([^<]+)<\/desc>/)?.[1];
        const catRaw = body.match(/<category[^>]*>([^<]+)<\/category>/)?.[1];

        const item: EpgProgrammeItem = {
          t: decodeXmlEntities(titleRaw.trim()),
          d: descRaw ? decodeXmlEntities(descRaw.trim()).slice(0, 260) : undefined,
          c: catRaw ? decodeXmlEntities(catRaw.trim()) : undefined,
          s,
          e,
        };

        if (archEntry.programmes.length < 320) {
          archEntry.programmes.push(item);
        }

        if (e >= minLiveStop && chEntry.programmes.length < 6) {
          chEntry.programmes.push(item);
        }
      }
    }

    const parsed: ParsedEpgFeed = {
      timestamp: now,
      channels,
      archiveChannels,
      keyMap,
    };
    if (!epgFeedCache.has(feedUrl) && epgFeedCache.size >= 3) {
      const oldestKey = epgFeedCache.keys().next().value;
      if (oldestKey) epgFeedCache.delete(oldestKey);
    }
    epgFeedCache.set(feedUrl, parsed);
    return parsed;
  })();

  epgFeedInFlight.set(feedUrl, loadPromise);
  try {
    return await loadPromise;
  } finally {
    epgFeedInFlight.delete(feedUrl);
  }
}

function getEpgFeedUrlsForCountry(countryCode: string): string[] {
  const upper = (countryCode || 'RO').trim().toUpperCase();
  if (upper === 'ALL') {
    return [
      'https://epgshare01.online/epgshare01/epg_ripper_RO1.xml.gz',
      'https://iptvx.one/epg/epg_lite.xml.gz',
    ];
  }
  if (['RU', 'BY', 'KZ', 'AM', 'UZ', 'KG', 'TJ'].includes(upper)) {
    return ['https://iptvx.one/epg/epg_lite.xml.gz'];
  }
  if (upper === 'RO' || upper === 'MD') {
    return [
      'https://epgshare01.online/epgshare01/epg_ripper_RO1.xml.gz',
      'https://epgshare01.online/epgshare01/epg_ripper_RO2.xml.gz',
    ];
  }
  const mapCode: Record<string, string> = {
    GB: 'UK1',
    UK: 'UK1',
    US: 'US2',
    CA: 'CA2',
    BE: 'BE2',
  };
  const suffix = mapCode[upper] || `${upper}1`;
  return [`https://epgshare01.online/epgshare01/epg_ripper_${suffix}.xml.gz`];
}

interface RichTrackInfo {
  rawTitle: string;
  artist: string;
  title: string;
  album?: string;
  coverUrl?: string;
  artistAvatarUrl?: string;
  updatedAt: number;
}

const trackRichMetaCache = new Map<string, RichTrackInfo>();
const latestStreamTitleByUrl = new Map<
  string,
  { rawTitle: string; maxIso: string; updatedAt: number }
>();

const radioSessionCookies = new Map<string, string>();

function getRadioDomainKey(urlStr: string): string {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    const parts = host.split('.');
    return parts.length >= 2 ? parts.slice(-2).join('.') : host;
  } catch {
    return '';
  }
}

function saveRadioResponseCookies(urlStr: string, resHeaders: Headers): void {
  const key = getRadioDomainKey(urlStr);
  if (!key) return;
  const rawSetCookie = resHeaders.get('set-cookie');
  if (!rawSetCookie) return;
  const pair = rawSetCookie.split(';')[0]?.trim();
  if (pair && pair.includes('=')) {
    radioSessionCookies.set(key, pair);
  }
}

function getRadioCookieHeader(urlStr: string): string {
  const key = getRadioDomainKey(urlStr);
  return (key && radioSessionCookies.get(key)) || '';
}

function extractMaxIsoTimestamp(raw: string): string {
  const matches = raw.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\b/g);
  if (!matches || matches.length === 0) return '';
  return matches.reduce((max, cur) => (cur > max ? cur : max), '');
}

async function probeSingleIcyStreamTitle(
  streamUrl: string
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const savedCookie = getRadioCookieHeader(streamUrl);
    const res = await fetch(streamUrl, {
      headers: {
        'Icy-MetaData': '1',
        'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
        Connection: 'close',
        ...(savedCookie ? { Cookie: savedCookie } : {}),
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    saveRadioResponseCookies(streamUrl, res.headers);

    const metaintStr = res.headers.get('icy-metaint');
    if (!metaintStr || !res.body) {
      controller.abort();
      clearTimeout(timeoutId);
      return null;
    }

    const metaint = parseInt(metaintStr, 10);
    if (!metaint || metaint > 131072) {
      controller.abort();
      clearTimeout(timeoutId);
      return null;
    }

    const reader = res.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    const maxBlocksToCheck = metaint <= 32768 ? 3 : 1;
    const maxBytes = metaint * maxBlocksToCheck + 4096;

    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(Buffer.from(value));
      total += value.byteLength;

      const buf = Buffer.concat(chunks, total);
      let pos = metaint;
      let blocksChecked = 0;

      while (blocksChecked < maxBlocksToCheck && pos < buf.length) {
        const lenByte = buf[pos];
        const metaLen = lenByte * 16;
        if (pos + 1 + metaLen > buf.length) {
          break;
        }
        if (metaLen > 0) {
          const metaBuf = buf.subarray(pos + 1, pos + 1 + metaLen);
          controller.abort();
          clearTimeout(timeoutId);
          let str = metaBuf.toString('utf8').replace(/\0+$/g, '');
          if (str.includes('\uFFFD')) {
            str = new TextDecoder('windows-1251')
              .decode(metaBuf)
              .replace(/\0+$/g, '');
          }
          const m =
            str.match(/StreamTitle='(.*?)'\s*;/i) ||
            str.match(/StreamTitle='(.*)'/i);
          return m ? m[1].trim() : '';
        }
        blocksChecked += 1;
        pos += 1 + metaLen + metaint;
      }

      if (blocksChecked >= maxBlocksToCheck) {
        controller.abort();
        clearTimeout(timeoutId);
        return '';
      }
    }

    controller.abort();
    clearTimeout(timeoutId);
    return null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Reads ICY StreamTitle while defeating frozen round-robin edge nodes (e.g. Mediaset / RMC / UnitedRadio)
 * where 3 out of 4 load-balanced backend instances return stale metadata from days ago.
 */
async function readIcyStreamTitle(streamUrl: string): Promise<string | null> {
  const isClusteredStream =
    /radiomontecarlo\.net|unitedradio\.it|105\.net|virginradio\.it|r101\.it|subasio\.it/i.test(
      streamUrl
    );

  if (!isClusteredStream) {
    const single = await probeSingleIcyStreamTitle(streamUrl);
    if (!single) return single;
    // If this non-clustered stream also embeds ISO timestamps, verify freshness
    const singleIso = extractMaxIsoTimestamp(single);
    if (!singleIso) return single;
  }

  // Fire 6 parallel probes so we hit the live backend node across the 4-node nginx round-robin
  const results = (
    await Promise.all(
      Array.from({ length: 6 }, () => probeSingleIcyStreamTitle(streamUrl))
    )
  ).filter((r): r is string => Boolean(r && r.trim()));

  if (results.length === 0) {
    const prev = latestStreamTitleByUrl.get(streamUrl);
    if (prev && Date.now() - prev.updatedAt < 3 * 60 * 1000) {
      return prev.rawTitle;
    }
    return null;
  }

  const withIso = results
    .map((rawTitle) => ({
      rawTitle,
      maxIso: extractMaxIsoTimestamp(rawTitle),
    }))
    .sort((a, b) => b.maxIso.localeCompare(a.maxIso));

  const best = withIso[0];
  const prevBest = latestStreamTitleByUrl.get(streamUrl);

  // If best candidate has an ISO timestamp older than a previously seen live timestamp on this stream,
  // all 6 probes hit frozen nodes -> return the cached live title if still recent (< 4 mins)
  if (best.maxIso && prevBest?.maxIso && best.maxIso < prevBest.maxIso) {
    if (Date.now() - prevBest.updatedAt < 4 * 60 * 1000) {
      return prevBest.rawTitle;
    }
  }

  if (best.maxIso) {
    latestStreamTitleByUrl.set(streamUrl, {
      rawTitle: best.rawTitle,
      maxIso: best.maxIso,
      updatedAt: Date.now(),
    });
  }

  return best.rawTitle;
}

async function readIcecastStatusTitle(streamUrl: string): Promise<string | null> {
  try {
    const parsed = new URL(streamUrl);
    const mountPath = parsed.pathname.replace(/^\//, '').toLowerCase();
    if (!mountPath) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const statusUrl = `${parsed.origin}/status-json.xsl`;
    const res = await fetch(statusUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      icestats?: {
        source?:
        | Array<{
          listenurl?: string;
          title?: string;
          yp_currently_playing?: string;
        }>
        | {
          listenurl?: string;
          title?: string;
          yp_currently_playing?: string;
        };
      };
    };

    const rawSources = data?.icestats?.source;
    if (!rawSources) return null;
    const sources = Array.isArray(rawSources) ? rawSources : [rawSources];
    const matched =
      sources.find((s) =>
        (s?.listenurl || '').toLowerCase().includes(mountPath)
      ) || (sources.length === 1 ? sources[0] : null);

    const title = (
      matched?.yp_currently_playing ||
      matched?.title ||
      ''
    ).trim();
    return title || null;
  } catch {
    return null;
  }
}

const ISRC_CODE_REGEX = /\b[A-Z]{2}[A-Z0-9]{3}\d{7}\b/gi;
const ISO_DATE_REGEX =
  /\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g;
const ID3_FRAME_REGEX =
  /\b(?:ID3|TIT2|TPE1|TPE2|TALB|TXXX|TRCK|TYER|TDRC|TCON|TCOP|TSSE|PRIV|APIC|WXXX|COMM|USLT|StreamTitle)\b/g;

function isStationOrJingleFieldServer(val: string, stationName = ''): boolean {
  const s = (val || '').trim().toLowerCase();
  if (!s) return true;
  if (
    /^(?:rmc|rmc hits|rmc 80|rmc 90|radio monte carlo.*|virgin radio.*|radio 105.*|r101.*|kiss\s*fm.*|#1\s*hit\s*radio.*|hit\s*radio.*|magic\s*fm.*|rock\s*fm.*|radio\s*zu.*|europa\s*fm.*|digi\s*fm.*|pro\s*fm.*|autopromo.*|promo.*|spot.*|jingle.*|liner.*|sigla.*|notiziario.*|meteo.*|oroscopo.*|traffico.*|commercial.*|publicitate.*|reclama.*)$/i.test(
      s
    )
  ) {
    return true;
  }
  const normStation = stationName
    .toLowerCase()
    .replace(/\b(?:romania|moldova|russia|live|online|fm|radio)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
  const normVal = s
    .replace(/\b(?:romania|moldova|russia|live|online|fm|radio)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
  if (normStation && normVal && normVal === normStation) {
    return true;
  }
  return false;
}

function normalizeForMatch(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .replace(/\b(?:feat|ft|with|vs)\.?\b.*$/i, '')
    .replace(/[^a-z0-9а-яё]/gi, '');
}

function doesCatalogItemMatch(
  candidateArtist: string,
  candidateTitle: string,
  targetArtist: string,
  targetTitle: string
): boolean {
  const cTitle = normalizeForMatch(candidateTitle);
  const tTitle = normalizeForMatch(targetTitle);
  if (!cTitle || !tTitle) return false;

  const titleMatches =
    cTitle === tTitle ||
    (tTitle.length >= 10 && cTitle.includes(tTitle)) ||
    (cTitle.length >= 10 && tTitle.includes(cTitle));
  if (!titleMatches) return false;

  if (targetArtist) {
    const cArtist = normalizeForMatch(candidateArtist);
    const tPrimary = normalizeForMatch(
      targetArtist.split(/[,&/;]|feat\.?|ft\.?|vs\.?|with/i)[0] || ''
    );
    if (
      tPrimary &&
      cArtist &&
      !cArtist.includes(tPrimary) &&
      !tPrimary.includes(cArtist)
    ) {
      return false;
    }
  }
  return true;
}

function parseRawStreamMetadataServer(
  rawInput: string,
  stationName = ''
): { artist: string; title: string; album?: string } | null {
  let raw = (rawInput || '')
    .replace(/\0+/g, ' ')
    .replace(ID3_FRAME_REGEX, ' ')
    .replace(/StreamUrl='[^']*';?/gi, ' ')
    .replace(/StreamTitle='(.*?)'\s*;?/gi, '$1')
    .trim();

  if (!raw || raw.length < 2) return null;
  if (/com\.apple\.streaming\.transportStreamTimestamp/i.test(raw)) return null;

  // 1. JSON payload
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const t = String(parsed.title || parsed.song || parsed.track || '').trim();
      const a = String(parsed.artist || parsed.performer || '')
        .replace(/\s*;\s*/g, ', ')
        .trim();
      if (t && !isStationOrJingleFieldServer(t, stationName)) {
        return { artist: a, title: t };
      }
    } catch {
      // fall through
    }
  }

  // 2. Adswizz / Triton key="value" metadata
  if (/\b(?:title|artist|text)\s*=\s*["']/i.test(raw)) {
    const titleMatch =
      raw.match(/\btitle\s*=\s*["']([^"']+)["']/i) ||
      raw.match(/\btext\s*=\s*["']([^"']+)["']/i);
    const artistMatch = raw.match(/\bartist\s*=\s*["']([^"']+)["']/i);
    if (titleMatch || artistMatch) {
      const extractedTitle = (titleMatch?.[1] || '').trim();
      const extractedArtist = (artistMatch?.[1] || '')
        .replace(/\s*;\s*/g, ', ')
        .trim();
      if (
        extractedTitle &&
        !isStationOrJingleFieldServer(extractedTitle, stationName)
      ) {
        return { artist: extractedArtist, title: extractedTitle };
      }
    }
  }

  // 3. Mediaset / RMC / Virgin Radio / Radio 105 tilde-delimited format:
  // "Still~Karol G; Bruno Mars~~2026~USUG12607936~216~2026-11-01T09:05:09..."
  if (raw.includes('~')) {
    const tildeParts = raw.split('~').map((part) =>
      part
        .replace(ISO_DATE_REGEX, '')
        .replace(ISRC_CODE_REGEX, '')
        .trim()
    );

    const isTechnicalToken = (val: string): boolean => {
      if (!val) return true;
      if (/^\d+(?:\.\d+)?$/.test(val)) return true;
      if (/^\d{4}-\d{2}/.test(val)) return true;
      if (/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(val)) return true;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(val)) return true;
      if (/^(?:MUS|HIT|JNG|COM|ADV|SPOT|LIN|SIG|IDS|NWS)$/i.test(val)) return true;
      return false;
    };

    const rawTitleField = !isTechnicalToken(tildeParts[0] || '') ? tildeParts[0] : '';
    const rawArtistField = !isTechnicalToken(tildeParts[1] || '') ? tildeParts[1] : '';
    const rawAlbumField =
      tildeParts[2] &&
        !isTechnicalToken(tildeParts[2]) &&
        !isStationOrJingleFieldServer(tildeParts[2], stationName) &&
        tildeParts[2].length > 1
        ? tildeParts[2]
        : undefined;

    const candidateTitle = isStationOrJingleFieldServer(rawTitleField, stationName)
      ? ''
      : rawTitleField;
    const candidateArtist = isStationOrJingleFieldServer(rawArtistField, stationName)
      ? ''
      : rawArtistField.replace(/\s*;\s*/g, ', ');

    if (candidateTitle && candidateArtist) {
      return {
        artist: candidateArtist,
        title: candidateTitle,
        album: rawAlbumField,
      };
    }

    if (candidateTitle) {
      return { artist: '', title: candidateTitle, album: rawAlbumField };
    }
    return null;
  }

  // 4. Standard string cleanup
  let cleaned = raw
    .replace(ISO_DATE_REGEX, ' ')
    .replace(ISRC_CODE_REGEX, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(
      /\(\s*(?:live|bonus|remix|radio edit|edit|extended|version|ost|from|official|video|audio|hd|hq|\d{4})[^)]*\)/gi,
      ' '
    )
    .replace(/\s+[-|]\s+\d{1,2}:\d{2}\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    !cleaned ||
    cleaned.length < 2 ||
    isStationOrJingleFieldServer(cleaned, stationName)
  ) {
    return null;
  }

  if (!/\s+[-–—]\s+/.test(cleaned)) {
    if (/\s+\|\s+/.test(cleaned)) {
      cleaned = cleaned.replace(/\s+\|\s+/g, ' - ');
    } else if (/\s+\/\s+/.test(cleaned)) {
      cleaned = cleaned.replace(/\s+\/\s+/g, ' - ');
    }
  }

  const rawParts = cleaned.split(/\s+[-–—]\s+/);
  if (
    rawParts.length >= 3 &&
    /fm|radio|rmc|virgin|zu|kiss|magic|rock|pro|digi|europa|dfm|retro|hit/i.test(
      rawParts[0]
    )
  ) {
    cleaned = rawParts.slice(1).join(' - ');
  }

  const parts = cleaned
    .split(/\s+[-–—]\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const artist = parts[0].replace(/\s*;\s*/g, ', ');
    const title = parts.slice(1).join(' - ');
    if (
      isStationOrJingleFieldServer(title, stationName) &&
      isStationOrJingleFieldServer(artist, stationName)
    ) {
      return null;
    }
    return { artist, title };
  }

  return { artist: '', title: cleaned };
}

function isGenericStationSlogan(raw: string, stationName: string): boolean {
  const s = raw.trim().toLowerCase();
  if (!s || s.length < 2) return true;
  if (
    /^(unknown|stream|offline|live|on air|reclama|publicitate|commercial|jingle|spot|реклама|новости|#1 hit radio|hit radio)$/i.test(
      s
    )
  ) {
    return true;
  }
  if (
    /\b(publicitate|reclama|commercial break|рекламная пауза|реклама|#1 hit radio|kissfm\s+live)\b/i.test(
      s
    )
  ) {
    return true;
  }
  if (
    /always the best music|radiovanya\.ru|actualitati\s*-\s*\d{4}|\.ru$|\.ro$|\.com$/i.test(
      s
    )
  ) {
    return true;
  }
  const cleanStation = stationName.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '');
  const cleanRaw = s.replace(/[^a-z0-9а-яё]/gi, '');
  if (cleanStation && cleanRaw === cleanStation) return true;
  return false;
}

const orbAliasCache = new Map<string, string>();
const KNOWN_ORB_ALIASES: Array<{ pattern: RegExp; alias: string }> = [
  { pattern: /kissfm\.ro|kiss\s*fm/i, alias: 'ro.kiss' },
  { pattern: /magicfm\.ro|magic\s*fm/i, alias: 'ro.magic' },
  { pattern: /rockfm\.ro|rock\s*fm/i, alias: 'ro.rockfmromania' },
  { pattern: /onefm\.ro|one\s*fm/i, alias: 'ro.one1006' },
  { pattern: /zuicast|radio\s*zu/i, alias: 'ro.radiozu' },
  { pattern: /virginradio\.ro|virgin\s*radio\s*romania|VirginRadio_aac/i, alias: 'ro.radio21' },
  { pattern: /europafm\.ro|europa\s*fm/i, alias: 'ro.europafm' },
  { pattern: /digifm|digi\s*fm/i, alias: 'ro.digifm' },
  { pattern: /dancefm|dance\s*fm/i, alias: 'ro.dancefm' },
  { pattern: /profm|pro\s*fm/i, alias: 'ro.infopro' },
  { pattern: /radio-impuls|radio\s*impuls/i, alias: 'ro.impuls' },
  { pattern: /dancemusic\.ro|deep\s*house\s*radio/i, alias: 'ro.deephouse' },
  { pattern: /playradio\.org.*90|play\s*90/i, alias: 'ro.playhit90s' },
  { pattern: /radiocafe\.ro|radio\s*cafe/i, alias: 'ro.radiocafe' },
  { pattern: /jurnalfm|jurnal\s*fm/i, alias: 'md.1001jurnalfm' },
  { pattern: /radiorecordmoldova|record\s*moldova/i, alias: 'md.radiorecordmoldova' },
  { pattern: /radiozum|radio\s*zum/i, alias: 'md.radiozum' },
  { pattern: /hitfm\.md|hit\s*fm\s*moldova/i, alias: 'md.hitfm' },
  { pattern: /noroc/i, alias: 'md.noroc' },
  { pattern: /plai/i, alias: 'md.plai' },
];

const KNOWN_TOP_RADIO_RU_SLUGS: Array<{ pattern: RegExp; slug: string }> = [
  { pattern: /radio7|радио\s*7|семи\s*холмах/i, slug: '7-na-semi-xolmax' },
  { pattern: /radiovanya|радио\s*ваня|radio\s*vanya/i, slug: 'vanya' },
  { pattern: /rusradio|русское\s*радио|russkoe/i, slug: 'russkoe' },
  { pattern: /europaplus|европа\s*плюс|europa\s*plus/i, slug: 'evropa-plyus' },
  { pattern: /retrofm|ретро\s*fm|ретро\s*фм|retro\s*fm/i, slug: 'retro-fm' },
  { pattern: /dorognoe|дорожное|dorozhnoe/i, slug: 'dorozhnoe' },
  { pattern: /avtoradio|авторадио/i, slug: 'avtoradio' },
  { pattern: /radiorecord|радио\s*рекорд|radio\s*record|дискотека\s*90|superdiskoteka/i, slug: 'rekord' },
  { pattern: /novoeradio|новое\s*радио|novoe\s*radio/i, slug: 'novoe' },
  { pattern: /veseloeradio|юмор\s*fm|юмор\s*фм|yumor/i, slug: 'yumor-fm' },
  { pattern: /dfm\.ru|\bdfm\b/i, slug: 'dfm' },
  { pattern: /montecarlo\.ru|монте[\s-]*карло/i, slug: 'monte-karlo' },
  { pattern: /hitfm\.ru|хит\s*fm|хит\s*фм/i, slug: 'xit-fm' },
  { pattern: /energyfm|радио\s*энерджи|energy\s*fm|\bnrg\b/i, slug: 'energy' },
  { pattern: /relax-fm|relax\s*fm|релакс\s*фм/i, slug: 'relax-fm' },
  { pattern: /nashe\.ru|наше\s*радио|nashe\s*radio/i, slug: 'nashe' },
  { pattern: /maximum\.ru|радио\s*maximum|радио\s*максимум/i, slug: 'maximum' },
  { pattern: /zharafm|жара\s*fm|zhara\s*fm/i, slug: 'zhara-fm' },
  { pattern: /russkijhit|русский\s*хит/i, slug: 'russkij-xit' },
  { pattern: /likefm|like\s*fm|лайк\s*фм/i, slug: 'like-fm' },
  { pattern: /калина\s*красная/i, slug: 'kalina-krasnaya' },
  { pattern: /эльдорадио|eldoradio/i, slug: 'eldoradio' },
  { pattern: /питер\s*fm|piter\s*fm/i, slug: 'piter-fm' },
];

async function readTopRadioRuTrack(
  streamUrl: string,
  stationName: string
): Promise<{ rawTitle: string; coverUrl?: string } | null> {
  const combined = `${streamUrl} ${stationName}`.trim();

  // 1. Direct SSR playlist for Радио 7 на семи холмах (provides both live Artist/Title + 600x600 cover on meta.hostingradio.ru)
  if (/radio7|радио\s*7|семи\s*холмах/i.test(combined)) {
    try {
      const ctrl = new AbortController();
      const tId = setTimeout(() => ctrl.abort(), 3200);
      const res = await fetch('https://radio7.ru/playlist', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: ctrl.signal,
      });
      clearTimeout(tId);
      if (res.ok) {
        const html = await res.text();
        const cardMatch = html.match(
          /playlist-track-card-info-image[\s\S]{0,260}?data-src="([^"]+)"[\s\S]{0,260}?playlist-track-card-info-content[^>]*>\s*<p[^>]*>([^<]+)<\/p>\s*<p[^>]*>([^<]+)<\/p>/i
        );
        if (cardMatch) {
          const coverUrl = cardMatch[1]?.trim() || undefined;
          const artist = decodeXmlEntities(cardMatch[2].trim());
          const song = decodeXmlEntities(cardMatch[3].trim());
          if (artist && song) {
            return { rawTitle: `${artist} - ${song}`, coverUrl };
          }
        }
      }
    } catch {
      // fall through to top-radio.ru/playlist/7-na-semi-xolmax
    }
  }

  // 2. Match known Russian station slug on top-radio.ru/playlist/<slug>
  let slug = '';
  for (const entry of KNOWN_TOP_RADIO_RU_SLUGS) {
    if (entry.pattern.test(combined)) {
      slug = entry.slug;
      break;
    }
  }
  if (!slug) return null;

  try {
    const ctrl = new AbortController();
    const tId = setTimeout(() => ctrl.abort(), 3200);
    const res = await fetch(`https://top-radio.ru/playlist/${slug}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: ctrl.signal,
    });
    clearTimeout(tId);
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(
      /<div class="name_track">\s*<span class="artist">([^<]+)<\/span>\s*-\s*<span class="song">([^<]+)<\/span>/i
    );
    if (m?.[1] && m?.[2]) {
      const artist = decodeXmlEntities(m[1].trim());
      const song = decodeXmlEntities(m[2].trim());
      if (artist && song) {
        return { rawTitle: `${artist} - ${song}` };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function readOnlineRadioBoxTrack(
  streamUrl: string,
  stationName: string
): Promise<{ rawTitle: string; coverUrl?: string } | null> {
  try {
    const ruTrack = await readTopRadioRuTrack(streamUrl, stationName);
    if (ruTrack?.rawTitle) {
      return ruTrack;
    }

    const combined = `${streamUrl} ${stationName}`.trim();
    let alias = orbAliasCache.get(combined.toLowerCase()) || '';

    if (!alias) {
      for (const entry of KNOWN_ORB_ALIASES) {
        if (entry.pattern.test(combined)) {
          alias = entry.alias;
          break;
        }
      }
    }

    if (!alias && stationName && stationName.length >= 3) {
      const ctrl = new AbortController();
      const tId = setTimeout(() => ctrl.abort(), 2500);
      try {
        const searchRes = await fetch(
          `https://onlineradiobox.com/search?q=${encodeURIComponent(stationName)}`,
          {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: ctrl.signal,
          }
        );
        clearTimeout(tId);
        if (searchRes.ok) {
          const html = await searchRes.text();
          const m = html.match(
            /streamType="[^"]*"[^>]*radioId="([a-z]{2}\.[a-z0-9_-]+)"/i
          );
          if (m?.[1]) {
            alias = m[1].toLowerCase();
          }
        }
      } catch {
        clearTimeout(tId);
      }
    }

    if (!alias) return null;
    orbAliasCache.set(combined.toLowerCase(), alias);

    const ctrl = new AbortController();
    const tId = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`https://scraper2.onlineradiobox.com/${alias}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: ctrl.signal,
    });
    clearTimeout(tId);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      title?: string;
      iArtist?: string;
      iName?: string;
      iImg?: string;
      updated?: number;
    };
    const rawTitle = (
      data?.iArtist && data?.iName
        ? `${data.iArtist} - ${data.iName}`
        : data?.title || ''
    ).trim();
    if (!rawTitle) return null;

    const coverUrl = data?.iImg
      ? data.iImg.replace(/\d+x\d+bb/, '600x600bb')
      : undefined;
    return { rawTitle, coverUrl };
  } catch {
    return null;
  }
}

async function resolveRichTrackMetadata(
  rawStreamTitle: string,
  stationName = ''
): Promise<RichTrackInfo | null> {
  const parsedFields = parseRawStreamMetadataServer(rawStreamTitle, stationName);
  if (!parsedFields || (!parsedFields.title && !parsedFields.artist)) {
    return null;
  }

  if (
    isGenericStationSlogan(parsedFields.title, stationName) &&
    (!parsedFields.artist || isGenericStationSlogan(parsedFields.artist, stationName))
  ) {
    return null;
  }

  const cacheKey = `v3:::${parsedFields.artist}:::${parsedFields.title}`.toLowerCase();
  const cached = trackRichMetaCache.get(cacheKey);
  if (cached && Date.now() - cached.updatedAt < 30 * 60 * 1000) {
    return {
      ...cached,
      rawTitle: rawStreamTitle,
    };
  }

  // Always preserve the radio stream's real artist and title when both are provided!
  const hasAuthoritativeArtistAndTitle = Boolean(
    parsedFields.artist && parsedFields.title
  );
  let artist = parsedFields.artist;
  let title = parsedFields.title;
  let album = parsedFields.album || '';
  let coverUrl = '';
  let artistAvatarUrl = '';

  const primaryArtist = artist
    ? artist.split(/[,&/;]|feat\.?|ft\.?|vs\.?|with/i)[0].trim()
    : '';
  const cleanSongTitle = title
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .replace(/feat\.?.*$/i, '')
    .trim();

  const queries = Array.from(
    new Set(
      [
        primaryArtist && cleanSongTitle
          ? `artist:"${primaryArtist}" track:"${cleanSongTitle}"`
          : '',
        artist && title ? `${artist} ${title}` : '',
        primaryArtist && cleanSongTitle
          ? `${primaryArtist} ${cleanSongTitle}`
          : '',
        !artist && cleanSongTitle ? cleanSongTitle : '',
      ].filter(Boolean)
    )
  );

  // 1. Query Deezer Search API (verify track title & artist match before using album cover)
  for (const q of queries) {
    if (coverUrl) break;
    try {
      const ctrl = new AbortController();
      const tId = setTimeout(() => ctrl.abort(), 3200);
      const r = await fetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=5`,
        { signal: ctrl.signal }
      );
      clearTimeout(tId);
      if (r.ok) {
        const j = (await r.json()) as {
          data?: Array<{
            title?: string;
            artist?: {
              name?: string;
              picture_xl?: string;
              picture_big?: string;
              picture_medium?: string;
            };
            album?: {
              title?: string;
              cover_xl?: string;
              cover_big?: string;
              cover_medium?: string;
            };
          }>;
        };
        const matchedItem = (j?.data || []).find((cand) =>
          doesCatalogItemMatch(
            cand.artist?.name || '',
            cand.title || '',
            primaryArtist || artist,
            cleanSongTitle || title
          )
        );
        if (matchedItem) {
          artist = matchedItem.artist?.name || artist;
          title = matchedItem.title || title;
          album = album || matchedItem.album?.title || '';
          coverUrl =
            matchedItem.album?.cover_xl ||
            matchedItem.album?.cover_big ||
            matchedItem.album?.cover_medium ||
            '';
          artistAvatarUrl =
            matchedItem.artist?.picture_xl ||
            matchedItem.artist?.picture_big ||
            matchedItem.artist?.picture_medium ||
            '';
          break;
        }
      }
    } catch {
      // ignore and fall through
    }
  }

  // 2. Fallback to iTunes Search API (verify track match before using cover)
  if (!coverUrl) {
    const itunesQuery =
      (primaryArtist && cleanSongTitle
        ? `${primaryArtist} ${cleanSongTitle}`
        : '') ||
      (artist && title ? `${artist} ${title}` : '') ||
      cleanSongTitle;

    if (itunesQuery) {
      const countries = /[а-яА-ЯёЁ]/.test(itunesQuery)
        ? ['RU', 'US']
        : ['US', 'RO'];

      for (const countryParam of countries) {
        if (coverUrl) break;
        try {
          const ctrl = new AbortController();
          const tId = setTimeout(() => ctrl.abort(), 3200);
          const r = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(
              itunesQuery
            )}&country=${countryParam}&entity=song&limit=5`,
            { signal: ctrl.signal }
          );
          clearTimeout(tId);
          if (r.ok) {
            const j = (await r.json()) as {
              results?: Array<{
                artistName?: string;
                trackName?: string;
                collectionName?: string;
                artworkUrl100?: string;
              }>;
            };
            const matchedItem = (j?.results || []).find((cand) =>
              doesCatalogItemMatch(
                cand.artistName || '',
                cand.trackName || '',
                primaryArtist || artist,
                cleanSongTitle || title
              )
            );
            if (matchedItem) {
              artist = matchedItem.artistName || artist;
              title = matchedItem.trackName || title;
              album = album || matchedItem.collectionName || '';
              if (matchedItem.artworkUrl100) {
                coverUrl = matchedItem.artworkUrl100.replace(
                  /\d+x\d+bb/,
                  '600x600bb'
                );
              }
            }
          }
        } catch {
          // ignore
        }
      }
    }
  }

  // 3. Look up Artist Portrait on Deezer Artist API (always verified by artist name)
  if (!artistAvatarUrl && (primaryArtist || artist)) {
    try {
      const ctrl = new AbortController();
      const tId = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch(
        `https://api.deezer.com/search/artist?q=${encodeURIComponent(
          primaryArtist || artist
        )}&limit=3`,
        { signal: ctrl.signal }
      );
      clearTimeout(tId);
      if (r.ok) {
        const j = (await r.json()) as {
          data?: Array<{
            name?: string;
            picture_xl?: string;
            picture_big?: string;
            picture_medium?: string;
          }>;
        };
        const targetNorm = normalizeForMatch(primaryArtist || artist);
        const art =
          (j?.data || []).find((a) => {
            const cNorm = normalizeForMatch(a.name || '');
            return cNorm && targetNorm && (cNorm.includes(targetNorm) || targetNorm.includes(cNorm));
          }) || j?.data?.[0];
        if (art) {
          artistAvatarUrl =
            art.picture_xl || art.picture_big || art.picture_medium || '';
        }
      }
    } catch {
      // ignore
    }
  }

  const finalCoverUrl = coverUrl || artistAvatarUrl || undefined;
  const finalArtistAvatarUrl = artistAvatarUrl || coverUrl || undefined;

  const result: RichTrackInfo = {
    rawTitle: rawStreamTitle,
    artist: artist || '',
    title: title || rawStreamTitle,
    album: album || undefined,
    coverUrl: finalCoverUrl,
    artistAvatarUrl: finalArtistAvatarUrl,
    updatedAt: Date.now(),
  };

  trackRichMetaCache.set(cacheKey, result);
  return result;
}

function tvStreamProxyPlugin(): Plugin {
  return {
    name: 'tv-stream-proxy',
    closeBundle() {
      const assetsDir = path.resolve(process.cwd(), 'dist/assets');
      if (!fs.existsSync(assetsDir)) return;
      for (const fileName of fs.readdirSync(assetsDir)) {
        if (fileName.endsWith('.css')) {
          const fullPath = path.join(assetsDir, fileName);
          const raw = fs.readFileSync(fullPath, 'utf8');
          const patched = raw
            // Remove :where() around input[type=button/reset/submit] so Chrome < 88 on Smart TVs never drops the button reset rule
            .replace(/:where\(\[type=(button|reset|submit)\]\)/g, '[type=$1]')
            // Convert CSS Color 4 `rgb(R G B / A)` to classic `rgba(R, G, B, A)` for Smart TV WebViews
            .replace(
              /rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([^)]+)\)/g,
              'rgba($1, $2, $3, $4)'
            );
          fs.writeFileSync(fullPath, patched, 'utf8');
        }
      }
    },
    transformIndexHtml(html, ctx) {
      if (ctx.bundle) {
        // Replace <script type="module" crossorigin src="/assets/..."> with classic <script defer src="/assets/...">
        // so older Smart TV WebViews (LG webOS / Samsung Tizen / MSX iframe) execute the IIFE bundle without ES Module / CORS restrictions
        return html
          .replace(
            /<script\s+type="module"\s+crossorigin\s+src="([^"]+)"><\/script>/g,
            '<script defer src="$1"></script>'
          )
          .replace(/\s+crossorigin(?=[\s>])/g, '');
      }
      return html;
    },
    configureServer(server) {
      server.middlewares.use('/api/tv-log', (req, res) => {
        console.log('[SMART-TV-LOG]', req.url);
        res.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
        res.end('ok');
      });

      // Atomic disk persistence helper (write temp file + atomic rename) prevents truncated/corrupt JSON on unexpected exit
      const writeFileAtomicSync = (filePath: string, content: string): void => {
        const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
        try {
          fs.writeFileSync(tmpPath, content, 'utf-8');
          fs.renameSync(tmpPath, filePath);
        } catch (err) {
          try {
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
          } catch {
            // ignore temp cleanup failure
          }
          throw err;
        }
      };

      const lanDistAssetCache = new Map<string, { mtimeMs: number; buf: Buffer }>();
      let lanLastGoodHtml: { ver: number; raw: string; gz: Buffer } | null = null;
      let lanLastGoodJs: { raw: Buffer; gz: Buffer } | null = null;
      let lanLastGoodCss: { raw: Buffer; gz: Buffer } | null = null;

      // Pre-warm RAM fallback from existing dist/ on startup so LG TV Chrome 68 stays protected even during the very first `vite build`
      try {
        const initDistDir = path.resolve(process.cwd(), 'dist');
        const initIndex = path.join(initDistDir, 'index.html');
        if (fs.existsSync(initIndex)) {
          const ver = Math.floor(fs.statSync(initIndex).mtimeMs);
          const freshHtml = fs
            .readFileSync(initIndex, 'utf-8')
            .replace(/(\/assets\/[^"'\s>]+\.(?:js|css))/g, `$1?v=${ver}`);
          lanLastGoodHtml = {
            ver,
            raw: freshHtml,
            gz: zlib.gzipSync(Buffer.from(freshHtml, 'utf-8'), { level: 6 }),
          };
        }
        const initAssetsDir = path.join(initDistDir, 'assets');
        if (fs.existsSync(initAssetsDir)) {
          const assetFiles = fs.readdirSync(initAssetsDir);
          const jsName = assetFiles.find((f) => f.startsWith('index-') && f.endsWith('.js'));
          if (jsName) {
            const rawJs = fs.readFileSync(path.join(initAssetsDir, jsName));
            lanLastGoodJs = { raw: rawJs, gz: zlib.gzipSync(rawJs, { level: 6 }) };
          }
          const cssName = assetFiles.find((f) => f.startsWith('style-') && f.endsWith('.css'));
          if (cssName) {
            const rawCss = fs.readFileSync(path.join(initAssetsDir, cssName));
            lanLastGoodCss = { raw: rawCss, gz: zlib.gzipSync(rawCss, { level: 6 }) };
          }
        }
      } catch {
        // ignore startup warm-up error
      }

      server.middlewares.use((req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Private-Network': 'true',
          });
          res.end();
          return;
        }

        const rawUrl = (req.url || '/').split('?')[0];
        const hostHeader = req.headers.host || 'localhost:8769';
        const baseOrigin = `http://${hostHeader}`;

        // Normalize /tv/msx/... -> /msx/... and /tv/icons/... -> /icons/... so Media Station X
        // works identically whether configured with 192.168.x.x:8769 or 192.168.x.x:8769/tv
        const normalizedMsxUrl = rawUrl.startsWith('/tv/msx/')
          ? rawUrl.slice(3)
          : rawUrl === '/tv/start.json'
            ? '/msx/start.json'
            : rawUrl === '/start.json'
              ? '/msx/start.json'
              : rawUrl;

        if (normalizedMsxUrl.startsWith('/msx/')) {
          const msxFilePath = path.resolve(
            process.cwd(),
            'public',
            normalizedMsxUrl.slice(1)
          );
          if (fs.existsSync(msxFilePath) && fs.statSync(msxFilePath).isFile()) {
            const ext = path.extname(msxFilePath).toLowerCase();
            if (ext === '.json') {
              const rawJson = fs.readFileSync(msxFilePath, 'utf-8');
              const resolvedJson = rawJson
                .replace(/\{PREFIX\}\{SERVER\}/g, baseOrigin)
                .replace(/\{PREFIX\}/g, baseOrigin)
                .replace(/https:\/\/filmio\.my/g, baseOrigin);
              res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Private-Network': 'true',
                'Cross-Origin-Resource-Policy': 'cross-origin',
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
              });
              res.end(resolvedJson);
              return;
            }
            const mime =
              ext === '.png'
                ? 'image/png'
                : ext === '.svg'
                  ? 'image/svg+xml'
                  : ext === '.ico'
                    ? 'image/x-icon'
                    : 'application/octet-stream';
            res.writeHead(200, {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Private-Network': 'true',
              'Cross-Origin-Resource-Policy': 'cross-origin',
              'Content-Type': mime,
              'Cache-Control': 'no-cache',
            });
            res.end(fs.readFileSync(msxFilePath));
            return;
          }
        }

        const normalizedIconUrl = rawUrl.startsWith('/tv/icons/')
          ? rawUrl.slice(3)
          : rawUrl;
        if (
          normalizedIconUrl.startsWith('/icons/') ||
          normalizedIconUrl === '/favicon.png' ||
          normalizedIconUrl === '/favicon.ico' ||
          normalizedIconUrl === '/apple-touch-icon.png'
        ) {
          const iconPath = path.resolve(
            process.cwd(),
            'public',
            normalizedIconUrl.slice(1)
          );
          if (fs.existsSync(iconPath) && fs.statSync(iconPath).isFile()) {
            const ext = path.extname(iconPath).toLowerCase();
            const mime =
              ext === '.png'
                ? 'image/png'
                : ext === '.svg'
                  ? 'image/svg+xml'
                  : ext === '.ico'
                    ? 'image/x-icon'
                    : 'application/octet-stream';
            res.writeHead(200, {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Private-Network': 'true',
              'Cross-Origin-Resource-Policy': 'cross-origin',
              'Content-Type': mime,
              'Cache-Control': 'no-cache',
            });
            res.end(fs.readFileSync(iconPath));
            return;
          }
        }

        // When accessed from a Smart TV on LAN (e.g. 192.168.x.x), serve the pre-built ES2015 IIFE dist/ bundle
        // so the TV never receives Vite 6's /@vite/client (which uses ES2022 private class fields #)
        const isLanTvClient =
          hostHeader.startsWith('192.168.') ||
          hostHeader.startsWith('10.') ||
          hostHeader.startsWith('100.') ||
          hostHeader.includes('.local') ||
          hostHeader.includes('.lhr.life') ||
          hostHeader.includes('.trycloudflare.com') ||
          /Web0S|WebOS|NetCast|SmartTV|Tizen|Large Screen|MSX/i.test(
            req.headers['user-agent'] || ''
          );

        if (isLanTvClient && !rawUrl.startsWith('/api/') && !rawUrl.startsWith('/msx/')) {
          const distDir = path.resolve(process.cwd(), 'dist');
          const acceptsGzip = /\bgzip\b/i.test(
            String(req.headers['accept-encoding'] || '')
          );
          if (rawUrl === '/sw.js') {
            const isSmartTvUa = /Web0S|WebOS|NetCast|SmartTV|SMART-TV|Tizen|Large Screen|MSX/i.test(
              req.headers['user-agent'] || ''
            );
            const isHttpsTunnel = hostHeader.includes('.trycloudflare.com');
            const swDiskPath = fs.existsSync(path.join(distDir, 'sw.js'))
              ? path.join(distDir, 'sw.js')
              : path.resolve(process.cwd(), 'public', 'sw.js');
            res.writeHead(200, {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/javascript; charset=utf-8',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            });
            if (isHttpsTunnel && !isSmartTvUa && fs.existsSync(swDiskPath)) {
              res.end(fs.readFileSync(swDiskPath));
            } else {
              res.end(
                "self.addEventListener('install',function(){self.skipWaiting()});self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.map(function(n){return caches.delete(n)}))}).then(function(){return self.registration.unregister()}))});"
              );
            }
            return;
          }
          if (rawUrl.startsWith('/assets/') || rawUrl.startsWith('/icons/') || rawUrl === '/manifest.webmanifest') {
            let assetFile = path.join(distDir, rawUrl);
            if ((!fs.existsSync(assetFile) || !fs.statSync(assetFile).isFile()) && rawUrl.startsWith('/assets/')) {
              const assetsDir = path.join(distDir, 'assets');
              if (fs.existsSync(assetsDir)) {
                const files = fs.readdirSync(assetsDir);
                if (rawUrl.endsWith('.js')) {
                  const currentJs = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));
                  if (currentJs) assetFile = path.join(assetsDir, currentJs);
                } else if (rawUrl.endsWith('.css')) {
                  const currentCss = files.find((f) => f.startsWith('style-') && f.endsWith('.css'));
                  if (currentCss) assetFile = path.join(assetsDir, currentCss);
                }
              }
            }
            if (fs.existsSync(assetFile) && fs.statSync(assetFile).isFile()) {
              const ext = path.extname(assetFile).toLowerCase();
              const mime =
                ext === '.js'
                  ? 'application/javascript; charset=utf-8'
                  : ext === '.css'
                    ? 'text/css; charset=utf-8'
                    : ext === '.png'
                      ? 'image/png'
                      : ext === '.ico'
                        ? 'image/x-icon'
                        : ext === '.svg'
                          ? 'image/svg+xml'
                          : ext === '.json' || ext === '.webmanifest'
                            ? 'application/json; charset=utf-8'
                            : 'application/octet-stream';
              const isCompressible =
                ext === '.js' ||
                ext === '.css' ||
                ext === '.svg' ||
                ext === '.json' ||
                ext === '.webmanifest';
              const sendGzip = acceptsGzip && isCompressible;
              const statMtime = Math.floor(fs.statSync(assetFile).mtimeMs);
              const cacheKey = `${assetFile}:${sendGzip ? 'gz' : 'raw'}`;
              const cachedAsset = lanDistAssetCache.get(cacheKey);
              let payload: Buffer;
              if (cachedAsset && cachedAsset.mtimeMs === statMtime) {
                payload = cachedAsset.buf;
              } else {
                const rawBuf = fs.readFileSync(assetFile);
                const gzBuf = isCompressible ? zlib.gzipSync(rawBuf, { level: 6 }) : rawBuf;
                payload = sendGzip ? gzBuf : rawBuf;
                if (lanDistAssetCache.size > 24) lanDistAssetCache.clear();
                lanDistAssetCache.set(cacheKey, { mtimeMs: statMtime, buf: payload });
                if (ext === '.js') lanLastGoodJs = { raw: rawBuf, gz: gzBuf };
                else if (ext === '.css') lanLastGoodCss = { raw: rawBuf, gz: gzBuf };
              }
              res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Private-Network': 'true',
                'Cross-Origin-Resource-Policy': 'cross-origin',
                'Content-Type': mime,
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Vary': 'Accept-Encoding',
                ...(sendGzip ? { 'Content-Encoding': 'gzip' } : {}),
              });
              res.end(payload);
              return;
            }
            // Fallback during `vite build` (while dist/ is momentarily emptied): serve last-good compiled bundle from RAM
            const ramAsset = rawUrl.endsWith('.js')
              ? { entry: lanLastGoodJs, mime: 'application/javascript; charset=utf-8' }
              : rawUrl.endsWith('.css')
                ? { entry: lanLastGoodCss, mime: 'text/css; charset=utf-8' }
                : null;
            if (ramAsset?.entry) {
              res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Private-Network': 'true',
                'Cross-Origin-Resource-Policy': 'cross-origin',
                'Content-Type': ramAsset.mime,
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Vary': 'Accept-Encoding',
                ...(acceptsGzip ? { 'Content-Encoding': 'gzip' } : {}),
              });
              res.end(acceptsGzip ? ramAsset.entry.gz : ramAsset.entry.raw);
              return;
            }
          } else if (rawUrl === '/' || rawUrl === '/tv' || rawUrl.startsWith('/tv/') || rawUrl === '/car' || rawUrl.startsWith('/car/') || rawUrl === '/index.html') {
            const distIndex = path.join(distDir, 'index.html');
            if (fs.existsSync(distIndex)) {
              const ver = Math.floor(fs.statSync(distIndex).mtimeMs);
              const rawHtml = fs.readFileSync(distIndex, 'utf-8');
              const freshHtml = rawHtml.replace(
                /(\/assets\/[^"'\s>]+\.(?:js|css))/g,
                `$1?v=${ver}`
              );
              const gzHtml = zlib.gzipSync(Buffer.from(freshHtml, 'utf-8'), { level: 6 });
              lanLastGoodHtml = { ver, raw: freshHtml, gz: gzHtml };
              const htmlPayload = acceptsGzip ? gzHtml : freshHtml;
              console.log(`[LAN-TV] Serving compiled ES2015 bundle (v=${ver}) to ${hostHeader}${req.url} (${req.headers['user-agent'] || ''})`);
              res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Referrer-Policy': 'no-referrer',
                'Vary': 'Accept-Encoding',
                ...(acceptsGzip ? { 'Content-Encoding': 'gzip' } : {}),
              });
              res.end(htmlPayload);
              return;
            } else if (lanLastGoodHtml) {
              console.log(`[LAN-TV] Serving RAM fallback ES2015 bundle (v=${lanLastGoodHtml.ver}) during dist rebuild to ${hostHeader}${req.url}`);
              res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Referrer-Policy': 'no-referrer',
                'Vary': 'Accept-Encoding',
                ...(acceptsGzip ? { 'Content-Encoding': 'gzip' } : {}),
              });
              res.end(acceptsGzip ? lanLastGoodHtml.gz : lanLastGoodHtml.raw);
              return;
            }
          }
        }

        next();
      });

      const getPrimaryLanIp = (): string => {
        try {
          const nets = os.networkInterfaces();
          for (const name of Object.keys(nets)) {
            for (const net of nets[name] || []) {
              if (net.family === 'IPv4' && !net.internal) {
                if (
                  net.address.startsWith('192.168.') ||
                  net.address.startsWith('10.') ||
                  net.address.startsWith('172.')
                ) {
                  return net.address;
                }
              }
            }
          }
        } catch {
          // ignore
        }
        return '192.168.2.57';
      };

      server.middlewares.use('/api/lan-info', (_req, res) => {
        const lanIp = getPrimaryLanIp();
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache, no-store',
        });
        res.end(
          JSON.stringify({
            lanIp,
            port: 8769,
            lanOrigin: `http://${lanIp}:8769`,
          })
        );
      });

      const legacyTvProgressFile = path.resolve(
        __dirname,
        '.tv-watch-progress.json'
      );
      const getTvProgressFileForProfile = (profileId: string) => {
        const cleanId = (profileId || 'p1').replace(/[^a-zA-Z0-9_-]/g, '') || 'p1';
        if (cleanId === 'p1') {
          return legacyTvProgressFile;
        }
        return path.resolve(__dirname, `.tv-watch-progress-${cleanId}.json`);
      };

      const mergeProgressEntriesMap = (
        baseMap: Record<string, any>,
        incomingMap: Record<string, any>
      ): Record<string, any> => {
        const merged = { ...(baseMap || {}) };
        for (const [k, v] of Object.entries(incomingMap || {})) {
          if (!v || typeof v !== 'object') continue;
          const cleanV = { ...(v as Record<string, any>) };
          if (cleanV.item && typeof cleanV.item === 'object') {
            cleanV.item = { ...cleanV.item };
            if (
              !/^мама$|^mama$/i.test(String(cleanV.item.name || '').trim()) &&
              (String(cleanV.item.poster || '').includes('11303084') ||
                cleanV.item.imdbId === 'tt43353255' ||
                cleanV.item.nameOriginal === 'MAMA')
            ) {
              if (/жизнь\s+заново/i.test(String(cleanV.item.name || ''))) {
                cleanV.item.kpId = '7958160';
                cleanV.item.poster =
                  'https://kinopoiskapiunofficial.tech/images/posters/kp/7958160.jpg';
                cleanV.item.background =
                  'https://kinopoiskapiunofficial.tech/images/posters/kp/7958160.jpg';
                cleanV.item.description =
                  '2026 год. Жизнь сорокалетнего врача скорой помощи Димы пошла под откос: жена ушла, коллеги презирают, а сам он живёт у деспотичной матери.';
              } else {
                delete cleanV.item.poster;
                delete cleanV.item.background;
              }
              delete cleanV.item.imdbId;
              delete cleanV.item.nameOriginal;
            }
            const cStr = String(cleanV.item?.country || '');
            const isRuCountry = /(Росси|СССР|Russia|USSR|Soviet|Беларус)/i.test(cStr);
            const isZvyozdy =
              k === 'tt31712367' ||
              k === 'kp_5508530' ||
              cleanV.item?.id === 'tt31712367' ||
              cleanV.item?.id === 'kp_5508530' ||
              String(cleanV.item?.kpId) === '5508530' ||
              cleanV.item?.name?.toLowerCase().includes('zvyozdy') ||
              cleanV.item?.name?.toLowerCase().includes('звёзд');
            if (isZvyozdy) {
              cleanV.item.poster = '/posters/zvyozdy.jpg';
              cleanV.item.background = '/posters/zvyozdy.jpg';
            }
            if (k === 'kp_1435343' || (k.startsWith('kp_') && !isRuCountry && !isZvyozdy)) {
              delete merged[k];
              continue;
            }
            if (!isRuCountry && !isZvyozdy && (cleanV.item?.id?.startsWith('tt') || cleanV.item?.imdbId)) {
              cleanV.server = 'filelist_torrent';
            }
          }
          if (
            cleanV.episodeProgressMap &&
            typeof cleanV.episodeProgressMap === 'object'
          ) {
            const epMap = { ...cleanV.episodeProgressMap };
            for (const [epK, epV] of Object.entries(epMap)) {
              if (
                epV &&
                typeof epV === 'object' &&
                (epV as any).duration === 4500 &&
                (epV as any).currentTime >= 2500
              ) {
                delete epMap[epK];
              }
            }
            cleanV.episodeProgressMap = epMap;
          }
          const prev = merged[k];
          if (!prev) {
            merged[k] = cleanV;
            continue;
          }
          const vCleared =
            (cleanV.currentTime || 0) === 0 &&
            cleanV.isWatched === false &&
            (!cleanV.episodeProgressMap ||
              Object.values(cleanV.episodeProgressMap).every(
                (ep: any) => (ep?.currentTime || 0) === 0 && !ep?.isWatched
              ));
          if (vCleared && (cleanV.updatedAt || 0) >= (prev.updatedAt || 0)) {
            merged[k] = cleanV;
            continue;
          }
          const mergedEpMap = { ...(prev.episodeProgressMap || {}) };
          if (
            cleanV.episodeProgressMap &&
            typeof cleanV.episodeProgressMap === 'object'
          ) {
            for (const [epK, epV] of Object.entries(cleanV.episodeProgressMap)) {
              if (!epV || typeof epV !== 'object') continue;
              const prevEp = mergedEpMap[epK];
              if (
                !prevEp ||
                ((epV as any).updatedAt || 0) >= ((prevEp as any).updatedAt || 0)
              ) {
                mergedEpMap[epK] = epV;
              }
            }
          }
          const preserveAdult18 =
            Boolean(prev.item?.isAdult18) ||
            Boolean(cleanV.item?.isAdult18) ||
            (Array.isArray(prev.item?.genres) &&
              prev.item.genres.some((g: unknown) => /^erotic$/i.test(String(g || '').trim()))) ||
            (Array.isArray(cleanV.item?.genres) &&
              cleanV.item.genres.some((g: unknown) => /^erotic$/i.test(String(g || '').trim())));
          if ((cleanV.updatedAt || 0) >= (prev.updatedAt || 0)) {
            const mergedItem = cleanV.item
              ? { ...(prev.item || {}), ...cleanV.item, ...(preserveAdult18 ? { isAdult18: true } : {}) }
              : prev.item;
            merged[k] = {
              ...prev,
              ...cleanV,
              ...(mergedItem ? { item: mergedItem } : {}),
              episodeProgressMap: mergedEpMap,
            };
          } else {
            const mergedItem = prev.item
              ? { ...(cleanV.item || {}), ...prev.item, ...(preserveAdult18 ? { isAdult18: true } : {}) }
              : cleanV.item;
            merged[k] = {
              ...cleanV,
              ...prev,
              ...(mergedItem ? { item: mergedItem } : {}),
              episodeProgressMap: mergedEpMap,
            };
          }
        }

        // Canonical deduplication pass: merge duplicate entries for the same title/IMDb
        const deduped: Record<string, any> = {};
        const groups: any[][] = [];
        for (const [k, entry] of Object.entries(merged)) {
          if (!entry || typeof entry !== 'object' || !entry.item) {
            deduped[k] = entry;
            continue;
          }
          let foundGroup = false;
          for (const g of groups) {
            const sample = g[0];
            const a = sample.item;
            const b = entry.item;
            const aType = a?.type;
            const bType = b?.type;
            if (aType && bType && aType !== bType) continue;

            const aId = String(a?.id || '').trim();
            const bId = String(b?.id || '').trim();
            if (aId && bId && aId === bId) {
              g.push(entry);
              foundGroup = true;
              break;
            }

            const aImdb = String(a?.imdbId || a?.imdb_id || (aId.startsWith('tt') ? aId : '')).trim();
            const bImdb = String(b?.imdbId || b?.imdb_id || (bId.startsWith('tt') ? bId : '')).trim();
            if (aImdb.startsWith('tt') && bImdb.startsWith('tt') && aImdb === bImdb) {
              g.push(entry);
              foundGroup = true;
              break;
            }

            const aKp = String(a?.kpId || (aId.startsWith('kp_') ? aId.replace('kp_', '') : '')).trim();
            const bKp = String(b?.kpId || (bId.startsWith('kp_') ? bId.replace('kp_', '') : '')).trim();
            if (aKp && bKp && aKp === bKp) {
              g.push(entry);
              foundGroup = true;
              break;
            }

            const aTitles = [a?.name, a?.title, a?.nameOriginal].filter(Boolean).map((s: any) => String(s).toLowerCase().trim());
            const bTitles = [b?.name, b?.title, b?.nameOriginal].filter(Boolean).map((s: any) => String(s).toLowerCase().trim());
            if (aTitles.some((t1: string) => bTitles.some((t2: string) => t1 === t2 && t1.length > 2))) {
              g.push(entry);
              foundGroup = true;
              break;
            }
          }
          if (!foundGroup) {
            groups.push([entry]);
          }
        }

        for (const g of groups) {
          let finalEntry = g[0];
          if (g.length > 1) {
            for (let i = 1; i < g.length; i++) {
              const other = g[i];
              const fTime = finalEntry.updatedAt || 0;
              const oTime = other.updatedAt || 0;
              const primary = oTime >= fTime ? other : finalEntry;
              const secondary = oTime >= fTime ? finalEntry : other;
              const mergedEpMap: Record<string, any> = {
                ...(secondary.episodeProgressMap || {}),
              };
              for (const [ek, ev] of Object.entries(primary.episodeProgressMap || {})) {
                const prevEv = mergedEpMap[ek];
                if (!prevEv || (Number((ev as any)?.updatedAt) || 0) >= (Number(prevEv?.updatedAt) || 0)) {
                  mergedEpMap[ek] = ev;
                }
              }
              const mergedItem: any = {
                ...(secondary.item || {}),
                ...(primary.item || {}),
              };
              if (primary.item?.isAdult18 || secondary.item?.isAdult18) mergedItem.isAdult18 = true;
              if (primary.item?.isAdultKlubnichka || secondary.item?.isAdultKlubnichka) mergedItem.isAdultKlubnichka = true;
              const canonImdb =
                primary.item?.imdbId ||
                secondary.item?.imdbId ||
                (String(primary.item?.id || '').startsWith('tt')
                  ? primary.item.id
                  : String(secondary.item?.id || '').startsWith('tt')
                    ? secondary.item.id
                    : undefined);
              if (canonImdb) {
                mergedItem.imdbId = canonImdb;
                mergedItem.id = canonImdb;
              }
              const strictlyNewer = Math.abs(oTime - fTime) > 1500;
              finalEntry = {
                ...secondary,
                ...primary,
                item: mergedItem,
                episodeProgressMap: mergedEpMap,
                currentTime: strictlyNewer
                  ? primary.currentTime || 0
                  : primary.season === secondary.season &&
                      primary.episode === secondary.episode
                    ? Math.max(primary.currentTime || 0, secondary.currentTime || 0)
                    : primary.currentTime,
                isWatched: strictlyNewer
                  ? primary.isWatched
                  : primary.isWatched ?? secondary.isWatched,
                updatedAt: Math.max(fTime, oTime),
              };
            }
          }
          const item = finalEntry.item;
          const canonicalKey =
            item?.imdbId && String(item.imdbId).startsWith('tt')
              ? item.imdbId
              : String(item?.id || '').startsWith('tt')
                ? item.id
                : item?.kpId
                  ? `kp_${item.kpId}`
                  : item?.id;
          if (canonicalKey) {
            const rawItem = finalEntry.item;
            if (rawItem && typeof rawItem === 'object') {
              const cleanItem: Record<string, unknown> = { ...rawItem };
              delete cleanItem.videos;
              delete cleanItem.links;
              delete cleanItem.trailers;
              delete cleanItem.trailerStreams;
              delete cleanItem.popularities;
              delete cleanItem.cast;
              delete cleanItem.director;
              delete cleanItem.writer;
              delete cleanItem.awards;
              delete cleanItem.behaviorHints;
              if (typeof cleanItem.description === 'string' && cleanItem.description.length > 320) {
                cleanItem.description = cleanItem.description.slice(0, 320);
              }
              if (Array.isArray(cleanItem.genres)) {
                const gs = cleanItem.genres
                  .filter(
                    (g: unknown): g is string =>
                      typeof g === 'string' &&
                      g.trim().length > 0 &&
                      g.trim().length <= 40 &&
                      !g.includes('\uFFFD')
                  )
                  .slice(0, 8);
                if (gs.length > 0) cleanItem.genres = gs;
                else delete cleanItem.genres;
              }
              deduped[canonicalKey] = { ...finalEntry, item: cleanItem };
            } else {
              deduped[canonicalKey] = finalEntry;
            }
          }
        }
        return deduped;
      };

      const lastCloudPullAtByProf: Record<string, number> = {};
      const syncProfileProgressWithCloud = async (
        profileId: string,
        forceSync = false,
        deltaPayload?: Record<string, any>
      ): Promise<Record<string, any> | null> => {
        const cleanId = (profileId || 'p1').replace(/[^a-zA-Z0-9_-]/g, '') || 'p1';
        const now = Date.now();
        if (!forceSync && !deltaPayload && now - (lastCloudPullAtByProf[cleanId] || 0) < 60_000) {
          return null;
        }
        lastCloudPullAtByProf[cleanId] = now;
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 3200);
        try {
          const targetFile = getTvProgressFileForProfile(cleanId);
          const localData = fs.existsSync(targetFile)
            ? JSON.parse(fs.readFileSync(targetFile, 'utf-8') || '{}')
            : {};
          const localStr = JSON.stringify(localData);
          const isPush = Boolean(deltaPayload && Object.keys(deltaPayload).length > 0);
          const cloudUrl = `https://filmio.my/api/tv-progress?profileId=${encodeURIComponent(cleanId)}${isPush ? '' : '&fresh=1'}`;
          const res = await fetch(
            cloudUrl,
            isPush
              ? {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(deltaPayload),
                  signal: ctrl.signal,
                }
              : {
                  cache: 'no-store',
                  signal: ctrl.signal,
                }
          );
          clearTimeout(timeoutId);
          if (res.ok) {
            const cloudMerged = (await res.json()) as Record<string, any>;
            if (cloudMerged && typeof cloudMerged === 'object') {
              const finalMerged = mergeProgressEntriesMap(localData, cloudMerged);
              const finalStr = JSON.stringify(finalMerged);
              if (finalStr !== localStr) {
                writeFileAtomicSync(targetFile, finalStr);
              }
              return finalMerged;
            }
          }
        } catch {
          clearTimeout(timeoutId);
        }
        return null;
      };

      server.middlewares.use('/api/tv-progress', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }
        const reqUrl = new URL(req.url || '', 'http://localhost');
        const profileId = reqUrl.searchParams.get('profileId') || 'p1';
        const deleteId = reqUrl.searchParams.get('deleteId') || '';
        const targetProgressFile = getTvProgressFileForProfile(profileId);

        const readDiskProgress = (): Record<string, unknown> => {
          try {
            if (fs.existsSync(targetProgressFile)) {
              const parsed = JSON.parse(
                fs.readFileSync(targetProgressFile, 'utf-8')
              );
              return parsed && typeof parsed === 'object' ? parsed : {};
            }
          } catch {
            // ignore
          }
          return {};
        };

        if (req.method === 'DELETE' || deleteId) {
          const current = readDiskProgress();
          if (deleteId && deleteId in current) {
            delete current[deleteId];
            try {
              writeFileAtomicSync(targetProgressFile, JSON.stringify(current));
            } catch {
              // ignore
            }
            fetch(
              `https://filmio.my/api/tv-progress?profileId=${encodeURIComponent(
                profileId
              )}&deleteId=${encodeURIComponent(deleteId)}`,
              { method: 'DELETE' }
            ).catch(() => { });
          }
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache, no-store',
          });
          res.end(JSON.stringify(current));
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const incoming = JSON.parse(body || '{}') as Record<string, any>;
              const current = readDiskProgress() as Record<string, any>;
              const prevStr = JSON.stringify(current);
              const merged = mergeProgressEntriesMap(current, incoming);
              const nextStr = JSON.stringify(merged);
              if (nextStr !== prevStr) {
                writeFileAtomicSync(targetProgressFile, nextStr);
                const compactedIncoming = mergeProgressEntriesMap({}, incoming);
                void syncProfileProgressWithCloud(
                  profileId,
                  true,
                  Object.keys(compactedIncoming).length > 0 ? compactedIncoming : merged
                );
              }
              res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-cache, no-store',
              });
              res.end(nextStr);
            } catch {
              res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
              });
              res.end(JSON.stringify(readDiskProgress()));
            }
          });
          return;
        }
        const forceFresh = reqUrl.searchParams.get('fresh') === '1';
        const diskProgress = readDiskProgress();
        const hasDiskData = Object.keys(diskProgress).length > 0;
        const cleanProfId = (profileId || 'p1').replace(/[^a-zA-Z0-9_-]/g, '') || 'p1';
        const shouldPullCloud =
          forceFresh ||
          !hasDiskData ||
          Date.now() - (lastCloudPullAtByProf[cleanProfId] || 0) >= 60_000;
        if (shouldPullCloud) {
          const maxInlineWaitMs = hasDiskData ? 850 : 2500;
          const syncPromise = syncProfileProgressWithCloud(profileId, forceFresh);
          const timeoutPromise = new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), maxInlineWaitMs)
          );
          void Promise.race([syncPromise, timeoutPromise]).then((synced) => {
            if (!res.writableEnded) {
              res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-cache, no-store',
              });
              res.end(JSON.stringify(synced || diskProgress));
            }
          });
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache, no-store',
        });
        res.end(JSON.stringify(diskProgress));
      });

      const lanCloudGetCache = new Map<string, { ts: number; data: unknown }>();
      const pullCloudJsonIfMissingOnDisk = async <T>(
        cacheKey: string,
        cloudUrl: string,
        fallbackVal: T
      ): Promise<T> => {
        const cached = lanCloudGetCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < 60_000) {
          return (cached.data as T) ?? fallbackVal;
        }
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3200);
        try {
          const r = await fetch(cloudUrl, {
            cache: 'no-store',
            signal: ctrl.signal,
          });
          clearTimeout(timer);
          if (r.ok) {
            const parsed = (await r.json()) as T;
            lanCloudGetCache.set(cacheKey, { ts: Date.now(), data: parsed });
            return parsed;
          }
        } catch {
          clearTimeout(timer);
        }
        return fallbackVal;
      };

      const inMemoryRemovedSavedByProf: Record<string, Record<string, number>> = {};

      const getTvSavedFileForProfile = (profileId: string) => {
        const cleanId = (profileId || 'p1').replace(/[^a-zA-Z0-9_-]/g, '') || 'p1';
        return path.resolve(__dirname, `.tv-saved-${cleanId}.json`);
      };

      server.middlewares.use('/api/tv-saved', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Removed-Vod-Ids');
        res.setHeader('Access-Control-Expose-Headers', 'X-Server-Removed-Vod-Ids');
        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }
        const reqUrl = new URL(req.url || '', 'http://localhost');
        const profileId = reqUrl.searchParams.get('profileId') || 'p1';
        const targetSavedFile = getTvSavedFileForProfile(profileId);
        if (!inMemoryRemovedSavedByProf[profileId]) {
          inMemoryRemovedSavedByProf[profileId] = {};
        }

        const readDiskSaved = (): unknown[] => {
          try {
            if (fs.existsSync(targetSavedFile)) {
              const parsed = JSON.parse(
                fs.readFileSync(targetSavedFile, 'utf-8')
              );
              return Array.isArray(parsed) ? parsed : [];
            }
          } catch {
            // ignore
          }
          return [];
        };

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            lanCloudGetCache.delete(`saved:${profileId}`);
            const removedMap = inMemoryRemovedSavedByProf[profileId];
            let incomingRemovedHeader = '{}';
            try {
              const rawRem = String(req.headers['x-removed-vod-ids'] || '{}');
              const parsedRem = JSON.parse(rawRem);
              if (parsedRem && typeof parsedRem === 'object') {
                for (const [rid, rts] of Object.entries(parsedRem)) {
                  const tsNum = Number(rts) || 0;
                  if (rid && tsNum > (removedMap[rid] || 0)) {
                    removedMap[rid] = tsNum;
                  }
                }
              }
              incomingRemovedHeader = JSON.stringify(removedMap);
            } catch {
              // ignore
            }
            try {
              const incoming = JSON.parse(body || '[]');
              if (Array.isArray(incoming)) {
                for (const it of incoming) {
                  if (it && it.id && removedMap[it.id]) {
                    const incTs = Number(it.savedAt) || 0;
                    if (incTs > removedMap[it.id]) {
                      delete removedMap[it.id];
                    }
                  }
                }
                const filtered = incoming.filter((it: any) => {
                  if (!it || !it.id) return false;
                  const remTs = Number(removedMap[it.id]) || 0;
                  const savedTs = Number(it.savedAt) || 1;
                  return remTs === 0 || savedTs > remTs;
                });
                incomingRemovedHeader = JSON.stringify(removedMap);
                writeFileAtomicSync(targetSavedFile, JSON.stringify(filtered));
                fetch(
                  `https://filmio.my/api/tv-saved?profileId=${encodeURIComponent(
                    profileId
                  )}`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Removed-Vod-Ids': incomingRemovedHeader,
                    },
                    body: JSON.stringify(filtered),
                  }
                ).catch(() => { });
              }
            } catch {
              // ignore
            }
            res.setHeader('X-Server-Removed-Vod-Ids', incomingRemovedHeader);
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-cache, no-store',
            });
            res.end(JSON.stringify(readDiskSaved()));
          });
          return;
        }

        const localSaved = readDiskSaved();
        if (profileId !== 'p1' && !fs.existsSync(targetSavedFile)) {
          void pullCloudJsonIfMissingOnDisk<unknown[]>(
            `saved:${profileId}`,
            `https://filmio.my/api/tv-saved?profileId=${encodeURIComponent(
              profileId
            )}`,
            localSaved
          ).then((cloudSaved) => {
            res.setHeader(
              'X-Server-Removed-Vod-Ids',
              JSON.stringify(inMemoryRemovedSavedByProf[profileId] || {})
            );
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-cache, no-store',
            });
            res.end(JSON.stringify(Array.isArray(cloudSaved) ? cloudSaved : []));
          });
          return;
        }

        res.setHeader(
          'X-Server-Removed-Vod-Ids',
          JSON.stringify(inMemoryRemovedSavedByProf[profileId] || {})
        );
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache, no-store',
        });
        res.end(JSON.stringify(localSaved));
      });

      const getTvRadioFavsFileForProfile = (profileId: string) => {
        const cleanId =
          (profileId || 'p1').replace(/[^a-zA-Z0-9_-]/g, '') || 'p1';
        return path.resolve(__dirname, `.tv-radio-favs-${cleanId}.json`);
      };

      server.middlewares.use('/api/tv-radio-favorites', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }
        const reqUrl = new URL(req.url || '', 'http://localhost');
        const profileId = reqUrl.searchParams.get('profileId') || 'p1';
        const targetFile = getTvRadioFavsFileForProfile(profileId);

        const readDiskRadioFavs = (): {
          updatedAt: number;
          stations: unknown[];
        } | null => {
          try {
            if (fs.existsSync(targetFile)) {
              const parsed = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
              if (
                parsed &&
                typeof parsed === 'object' &&
                Array.isArray(parsed.stations)
              ) {
                return {
                  updatedAt: Number(parsed.updatedAt) || 0,
                  stations: parsed.stations,
                };
              }
            }
          } catch {
            // ignore
          }
          return null;
        };

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const incoming = JSON.parse(body || 'null');
              if (
                incoming &&
                typeof incoming === 'object' &&
                Array.isArray(incoming.stations)
              ) {
                const existing = readDiskRadioFavs();
                const incomingTs = Number(incoming.updatedAt) || Date.now();
                const existingTs = Number(existing?.updatedAt) || 0;
                if (!existing || incomingTs >= existingTs) {
                  const nextPayload = {
                    updatedAt: incomingTs,
                    stations: incoming.stations.slice(0, 300),
                  };
                  lanCloudGetCache.delete(`radio:${profileId}`);
                  writeFileAtomicSync(targetFile, JSON.stringify(nextPayload));
                  fetch(
                    `https://filmio.my/api/tv-radio-favorites?profileId=${encodeURIComponent(
                      profileId
                    )}`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(nextPayload),
                    }
                  ).catch(() => { });
                }
              }
            } catch {
              // ignore
            }
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-cache, no-store',
            });
            res.end(
              JSON.stringify(
                readDiskRadioFavs() || { updatedAt: 0, stations: [] }
              )
            );
          });
          return;
        }

        if (profileId !== 'p1' && !fs.existsSync(targetFile)) {
          void pullCloudJsonIfMissingOnDisk<{ updatedAt: number; stations: unknown[] }>(
            `radio:${profileId}`,
            `https://filmio.my/api/tv-radio-favorites?profileId=${encodeURIComponent(
              profileId
            )}`,
            { updatedAt: 0, stations: [] }
          ).then((cloudRadio) => {
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-cache, no-store',
            });
            res.end(
              JSON.stringify(
                cloudRadio && Array.isArray(cloudRadio.stations)
                  ? cloudRadio
                  : { updatedAt: 0, stations: [] }
              )
            );
          });
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache, no-store',
        });
        res.end(
          JSON.stringify(
            readDiskRadioFavs() || { updatedAt: 0, stations: [] }
          )
        );
      });

      const getTvChannelFavsFileForProfile = (profileId: string) => {
        const cleanId =
          (profileId || 'p1').replace(/[^a-zA-Z0-9_-]/g, '') || 'p1';
        return path.resolve(__dirname, `.tv-channel-favs-${cleanId}.json`);
      };

      server.middlewares.use('/api/tv-channel-favorites', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }
        const reqUrl = new URL(req.url || '', 'http://localhost');
        const profileId = reqUrl.searchParams.get('profileId') || 'p1';
        const targetFile = getTvChannelFavsFileForProfile(profileId);

        const readDiskChannelFavs = (): {
          updatedAt: number;
          channels: unknown[];
        } | null => {
          try {
            if (fs.existsSync(targetFile)) {
              const parsed = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
              if (
                parsed &&
                typeof parsed === 'object' &&
                Array.isArray(parsed.channels)
              ) {
                return {
                  updatedAt: Number(parsed.updatedAt) || 0,
                  channels: parsed.channels,
                };
              }
            }
          } catch {
            // ignore
          }
          return null;
        };

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const incoming = JSON.parse(body || 'null');
              if (
                incoming &&
                typeof incoming === 'object' &&
                Array.isArray(incoming.channels)
              ) {
                const existing = readDiskChannelFavs();
                const incomingTs = Number(incoming.updatedAt) || Date.now();
                const existingTs = Number(existing?.updatedAt) || 0;
                if (!existing || incomingTs >= existingTs) {
                  const nextPayload = {
                    updatedAt: incomingTs,
                    channels: incoming.channels.slice(0, 300),
                  };
                  lanCloudGetCache.delete(`tvch:${profileId}`);
                  writeFileAtomicSync(targetFile, JSON.stringify(nextPayload));
                  fetch(
                    `https://filmio.my/api/tv-channel-favorites?profileId=${encodeURIComponent(
                      profileId
                    )}`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(nextPayload),
                    }
                  ).catch(() => { });
                }
              }
            } catch {
              // ignore
            }
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-cache, no-store',
            });
            res.end(
              JSON.stringify(
                readDiskChannelFavs() || { updatedAt: 0, channels: [] }
              )
            );
          });
          return;
        }

        if (profileId !== 'p1' && !fs.existsSync(targetFile)) {
          void pullCloudJsonIfMissingOnDisk<{ updatedAt: number; channels: unknown[] }>(
            `tvch:${profileId}`,
            `https://filmio.my/api/tv-channel-favorites?profileId=${encodeURIComponent(
              profileId
            )}`,
            { updatedAt: 0, channels: [] }
          ).then((cloudCh) => {
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-cache, no-store',
            });
            res.end(
              JSON.stringify(
                cloudCh && Array.isArray(cloudCh.channels)
                  ? cloudCh
                  : { updatedAt: 0, channels: [] }
              )
            );
          });
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache, no-store',
        });
        res.end(
          JSON.stringify(
            readDiskChannelFavs() || { updatedAt: 0, channels: [] }
          )
        );
      });

      const getTvMusicSyncFileForProfile = (profileId: string) => {
        const cleanId =
          (profileId || 'p1').replace(/[^a-zA-Z0-9_-]/g, '') || 'p1';
        return path.resolve(__dirname, `.music-sync-${cleanId}.json`);
      };

      const mergeLocalMusicSyncData = (existing: any, incoming: any) => {
        const prev = existing && typeof existing === 'object' ? existing : {};
        const next = incoming && typeof incoming === 'object' ? incoming : {};
        const baseTs =
          Number(next.updatedAt) || Number(prev.updatedAt) || Date.now();
        const removedMap: Record<string, number> = {
          ...(prev.removedMap && typeof prev.removedMap === 'object'
            ? prev.removedMap
            : {}),
          ...(next.removedMap && typeof next.removedMap === 'object'
            ? next.removedMap
            : {}),
        };
        const normKey = (t: any) => {
          const a = String(t?.artist || '').toLowerCase().trim();
          const ti = String(t?.title || '').toLowerCase().trim();
          return a && ti ? `${a}::${ti}` : String(t?.id || '');
        };
        const seenIds = new Set<string>();
        const seenKeys = new Set<string>();
        const likedTracks: any[] = [];
        for (const raw of [
          ...(Array.isArray(next.likedTracks) ? next.likedTracks : []),
          ...(Array.isArray(prev.likedTracks) ? prev.likedTracks : []),
        ]) {
          if (!raw || typeof raw !== 'object' || !raw.id || !raw.title) continue;
          const idStr = String(raw.id);
          const likedAt =
            Number(raw.likedAt) ||
            (Array.isArray(next.likedTracks) && next.likedTracks.includes(raw)
              ? baseTs
              : Number(prev.updatedAt) || 1);
          const removedAt = Number(removedMap[idStr]) || 0;
          if (removedAt > 0 && likedAt <= removedAt) continue;
          if (removedAt > 0 && likedAt > removedAt) delete removedMap[idStr];
          const k = normKey(raw);
          if (seenIds.has(idStr) || (k && seenKeys.has(k))) continue;
          seenIds.add(idStr);
          if (k) seenKeys.add(k);
          likedTracks.push({ ...raw, likedAt });
        }
        likedTracks.sort(
          (a, b) => (Number(b.likedAt) || 0) - (Number(a.likedAt) || 0)
        );
        const recentIds = new Set<string>();
        const recentKeys = new Set<string>();
        const recentTracks: any[] = [];
        for (const raw of [
          ...(Array.isArray(next.recentTracks) ? next.recentTracks : []),
          ...(Array.isArray(prev.recentTracks) ? prev.recentTracks : []),
        ]) {
          if (!raw || typeof raw !== 'object' || !raw.id || !raw.title) continue;
          const idStr = String(raw.id);
          const k = normKey(raw);
          if (recentIds.has(idStr) || (k && recentKeys.has(k))) continue;
          recentIds.add(idStr);
          if (k) recentKeys.add(k);
          recentTracks.push({ ...raw, playedAt: Number(raw.playedAt) || 0 });
        }
        recentTracks.sort(
          (a, b) => (Number(b.playedAt) || 0) - (Number(a.playedAt) || 0)
        );
        const normalizePb = (raw: any) => {
          if (!raw || typeof raw !== 'object') return null;
          const ts = Number(raw.updatedAt) || 0;
          if (raw.closed || raw.track === null) {
            return ts > 0
              ? { track: null, elapsedSec: 0, durationSec: 0, updatedAt: ts, closed: true }
              : null;
          }
          if (raw.track && typeof raw.track === 'object' && raw.track.id && raw.track.title) {
            return raw;
          }
          return null;
        };
        const prevPb = normalizePb(prev.playbackState);
        const nextPb = normalizePb(next.playbackState);
        const playbackState =
          nextPb && (Number(nextPb.updatedAt) || 0) >= (Number(prevPb?.updatedAt) || 0)
            ? nextPb
            : prevPb || null;
        return {
          updatedAt: Math.max(Number(prev.updatedAt) || 0, baseTs),
          likedTracks: likedTracks.slice(0, 500),
          removedMap,
          recentTracks: recentTracks.slice(0, 50),
          playbackState,
        };
      };

      const lastMusicCloudPushAtByProf: Record<string, number> = {};
      const lastMusicLikedSigByProf: Record<string, string> = {};

      server.middlewares.use('/api/tv-music-sync', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }
        const reqUrl = new URL(req.url || '', 'http://localhost');
        const profileId = reqUrl.searchParams.get('profileId') || 'p1';
        const targetFile = getTvMusicSyncFileForProfile(profileId);

        const emptyMusicPayload = () => ({
          updatedAt: 0,
          likedTracks: [],
          removedMap: {},
          recentTracks: [],
          playbackState: null,
        });

        const readDiskMusicSync = () => {
          try {
            if (fs.existsSync(targetFile)) {
              const parsed = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
              if (parsed && typeof parsed === 'object') {
                return mergeLocalMusicSyncData(null, parsed);
              }
            }
          } catch {
            // ignore
          }
          return null;
        };

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const incoming = JSON.parse(body || 'null');
              if (incoming && typeof incoming === 'object') {
                const existing = readDiskMusicSync();
                const merged = mergeLocalMusicSyncData(existing, incoming);
                const prevStr = existing ? JSON.stringify(existing) : '';
                const nextStr = JSON.stringify(merged);
                if (nextStr !== prevStr) {
                  writeFileAtomicSync(targetFile, nextStr);
                  const likedSig = `${(merged.likedTracks || []).length}:${Object.keys(merged.removedMap || {}).length}:${merged.playbackState?.closed ? 1 : 0}`;
                  const nowTs = Date.now();
                  const shouldPushMusicCloud =
                    likedSig !== lastMusicLikedSigByProf[profileId] ||
                    nowTs - (lastMusicCloudPushAtByProf[profileId] || 0) >= 180000;
                  if (shouldPushMusicCloud) {
                    lastMusicLikedSigByProf[profileId] = likedSig;
                    lastMusicCloudPushAtByProf[profileId] = nowTs;
                    fetch(
                      `https://filmio.my/api/tv-music-sync?profileId=${encodeURIComponent(
                        profileId
                      )}`,
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: nextStr,
                      }
                    ).catch(() => { });
                  }
                }
              }
            } catch {
              // ignore
            }
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-cache, no-store',
            });
            res.end(JSON.stringify(readDiskMusicSync() || emptyMusicPayload()));
          });
          return;
        }

        const diskData = readDiskMusicSync();
        if (
          diskData &&
          (diskData.likedTracks.length > 0 ||
            diskData.recentTracks.length > 0 ||
            diskData.playbackState)
        ) {
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache, no-store',
          });
          res.end(JSON.stringify(diskData));
          return;
        }

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3200);
        fetch(
          `https://filmio.my/api/tv-music-sync?profileId=${encodeURIComponent(
            profileId
          )}`,
          { signal: ctrl.signal }
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((cloudData) => {
            clearTimeout(timer);
            const payload =
              cloudData && typeof cloudData === 'object'
                ? mergeLocalMusicSyncData(diskData, cloudData)
                : diskData || emptyMusicPayload();
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-cache, no-store',
            });
            res.end(JSON.stringify(payload));
          })
          .catch(() => {
            clearTimeout(timer);
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-cache, no-store',
            });
            res.end(JSON.stringify(diskData || emptyMusicPayload()));
          });
      });

      const tvProfilesFile = path.resolve(__dirname, '.tv-profiles.json');
      const inMemoryExtraProfiles = new Map<string, Record<string, unknown>>();
      const inMemoryDeletedMap: Record<string, number> = {};
      const normalizeLanProfileName = (name: unknown): string =>
        String(name || '')
          .trim()
          .replace(/\s+/g, ' ')
          .toLowerCase();
      const mergeLanAndCloudProfiles = (
        lists: Array<Array<Record<string, unknown>> | null | undefined>
      ): Array<Record<string, unknown>> => {
        const byId = new Map<string, Record<string, unknown>>();
        const idByNormName = new Map<string, string>();
        for (const list of lists) {
          if (!Array.isArray(list)) continue;
          for (const p of list) {
            const id = typeof p?.id === 'string' ? p.id : '';
            if (!id) continue;
            if (id === 'p1' && p.name === 'Eugeniu' && !p.pin) continue;
            const pTs = typeof p?.updatedAt === 'number' ? p.updatedAt : 0;
            const delTs = id !== 'p1' ? Number(inMemoryDeletedMap[id]) || 0 : 0;
            if (delTs > 0 && pTs <= delTs) continue;
            const prev = byId.get(id);
            if (!prev) {
              const normName = normalizeLanProfileName(p?.name);
              if (normName && idByNormName.has(normName) && idByNormName.get(normName) !== id) {
                continue;
              }
              byId.set(id, p);
              if (normName) {
                idByNormName.set(normName, id);
              }
              continue;
            }
            const prevTs =
              typeof prev?.updatedAt === 'number' ? prev.updatedAt : 0;
            const nextMerged = pTs >= prevTs ? { ...prev, ...p } : { ...p, ...prev };
            const mergedNormName = normalizeLanProfileName(nextMerged.name);
            const ownerId = mergedNormName ? idByNormName.get(mergedNormName) : undefined;
            if (ownerId && ownerId !== id) {
              nextMerged.name = prev.name;
            } else {
              const prevNormName = normalizeLanProfileName(prev.name);
              if (prevNormName && prevNormName !== mergedNormName && idByNormName.get(prevNormName) === id) {
                idByNormName.delete(prevNormName);
              }
              if (mergedNormName) {
                idByNormName.set(mergedNormName, id);
              }
            }
            byId.set(id, nextMerged);
          }
        }
        return Array.from(byId.values()).slice(0, 32);
      };

      server.middlewares.use('/api/tv-profiles', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, X-Deleted-Profile-Ids, X-Replace-Profiles'
        );
        res.setHeader(
          'Access-Control-Expose-Headers',
          'X-Server-Deleted-Ids, X-Persistent-Store'
        );
        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }
        const readProfiles = (): Array<Record<string, unknown>> | null => {
          try {
            if (fs.existsSync(tvProfilesFile)) {
              const parsed = JSON.parse(fs.readFileSync(tvProfilesFile, 'utf-8'));
              if (Array.isArray(parsed)) return parsed;
            }
          } catch {
            // ignore
          }
          return null;
        };
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            let finalMerged = mergeLanAndCloudProfiles([
              readProfiles(),
              Array.from(inMemoryExtraProfiles.values()),
            ]);
            try {
              const incoming = JSON.parse(body || 'null');
              if (Array.isArray(incoming) && incoming.length > 0) {
                const deletedHeader = String(
                  req.headers['x-deleted-profile-ids'] || '[]'
                );
                let deletedIds = new Set<string>();
                try {
                  const parsedDel = JSON.parse(deletedHeader);
                  if (Array.isArray(parsedDel)) {
                    deletedIds = new Set(
                      parsedDel.filter((x) => typeof x === 'string' && x)
                    );
                  }
                } catch {
                  // ignore
                }
                const now = Date.now();
                for (const delId of deletedIds) {
                  if (delId !== 'p1') {
                    inMemoryDeletedMap[delId] = Math.max(
                      Number(inMemoryDeletedMap[delId]) || 0,
                      now
                    );
                    inMemoryExtraProfiles.delete(delId);
                  }
                }
                const sanitizedIncoming = incoming.filter((p) => {
                  const id = typeof p?.id === 'string' ? p.id : '';
                  if (!id || (id !== 'p1' && deletedIds.has(id))) return false;
                  const ts = typeof p?.updatedAt === 'number' ? p.updatedAt : 0;
                  if (id !== 'p1' && inMemoryDeletedMap[id]) {
                    if (ts > inMemoryDeletedMap[id]) {
                      delete inMemoryDeletedMap[id];
                    } else {
                      return false;
                    }
                  }
                  return true;
                });
                finalMerged = mergeLanAndCloudProfiles([
                  readProfiles(),
                  Array.from(inMemoryExtraProfiles.values()),
                  sanitizedIncoming,
                ]);
                for (const p of finalMerged) {
                  if (typeof p?.id === 'string') {
                    inMemoryExtraProfiles.set(p.id, p);
                  }
                }
                if (finalMerged.length > 0) {
                  writeFileAtomicSync(tvProfilesFile, JSON.stringify(finalMerged));
                  fetch('https://filmio.my/api/tv-profiles', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Deleted-Profile-Ids': deletedHeader,
                    },
                    body: JSON.stringify(finalMerged),
                  }).catch(() => { });
                }
              }
            } catch {
              // ignore
            }
            const deletedList = Object.keys(inMemoryDeletedMap).filter(
              (id) => id !== 'p1' && !finalMerged.some((p) => p?.id === id)
            );
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-cache, no-store',
              'X-Server-Deleted-Ids': JSON.stringify(deletedList),
              'Access-Control-Expose-Headers': 'X-Server-Deleted-Ids, X-Persistent-Store',
            });
            res.end(JSON.stringify(finalMerged));
          });
          return;
        }
        const diskProfiles = readProfiles() || [];
        const immediateMerged = mergeLanAndCloudProfiles([
          diskProfiles,
          Array.from(inMemoryExtraProfiles.values()),
        ]);

        const syncProfilesWithCloudBg = () => {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 3000);
          return fetch('https://filmio.my/api/tv-profiles', {
            cache: 'no-store',
            signal: ctrl.signal,
          })
            .then(async (r) => {
              const rawDel = r.headers.get('x-server-deleted-ids');
              if (rawDel) {
                try {
                  const parsedDel = JSON.parse(rawDel);
                  if (Array.isArray(parsedDel)) {
                    const now = Date.now();
                    for (const id of parsedDel) {
                      if (typeof id === 'string' && id && id !== 'p1') {
                        inMemoryDeletedMap[id] = Math.max(
                          Number(inMemoryDeletedMap[id]) || 0,
                          now
                        );
                        inMemoryExtraProfiles.delete(id);
                      }
                    }
                  }
                } catch {
                  // ignore
                }
              }
              return r.ok ? r.json() : null;
            })
            .then((cloudProfiles) => {
              clearTimeout(timer);
              const cloudArr = Array.isArray(cloudProfiles) ? cloudProfiles : [];
              const merged = mergeLanAndCloudProfiles([
                diskProfiles,
                Array.from(inMemoryExtraProfiles.values()),
                cloudArr,
              ]);
              for (const p of merged) {
                if (typeof p?.id === 'string') {
                  inMemoryExtraProfiles.set(p.id, p);
                }
              }
              const cloudIds = new Set(
                cloudArr.map((p: Record<string, unknown>) => p?.id).filter(Boolean)
              );
              if (
                merged.some(
                  (p) => typeof p?.id === 'string' && !cloudIds.has(p.id)
                )
              ) {
                fetch('https://filmio.my/api/tv-profiles', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Deleted-Profile-Ids': JSON.stringify(Object.keys(inMemoryDeletedMap)),
                  },
                  body: JSON.stringify(merged),
                }).catch(() => { });
              }
              return merged;
            })
            .catch(() => {
              clearTimeout(timer);
              return immediateMerged;
            });
        };

        // Fast non-blocking path: return local profiles in <1ms and sync cloud quietly in background (throttled >= 60s)
        if (immediateMerged.length > 0) {
          const nowSync = Date.now();
          const lastProfSync = (lanCloudGetCache.get('profiles_bg_sync')?.ts) || 0;
          if (nowSync - lastProfSync >= 60_000) {
            lanCloudGetCache.set('profiles_bg_sync', { ts: nowSync, data: true });
            void syncProfilesWithCloudBg();
          }
          const deletedList = Object.keys(inMemoryDeletedMap).filter(
            (id) => id !== 'p1' && !immediateMerged.some((p) => p?.id === id)
          );
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache, no-store',
            'X-Server-Deleted-Ids': JSON.stringify(deletedList),
            'Access-Control-Expose-Headers': 'X-Server-Deleted-Ids, X-Persistent-Store',
          });
          res.end(JSON.stringify(immediateMerged));
          return;
        }

        void syncProfilesWithCloudBg().then((merged) => {
          const deletedList = Object.keys(inMemoryDeletedMap).filter(
            (id) => id !== 'p1' && !merged.some((p) => p?.id === id)
          );
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache, no-store',
            'X-Server-Deleted-Ids': JSON.stringify(deletedList),
            'Access-Control-Expose-Headers': 'X-Server-Deleted-Ids, X-Persistent-Store',
          });
          res.end(JSON.stringify(merged));
        });
      });

      // Auto-register active HTTPS Home Bridge origin (Cloudflare Tunnel) to https://filmio.my/api/tv-bridge once per unique origin
      let lastPublishedBridgeOrigin = '';
      const publishHomeBridgeOriginOnce = (rawOrigin: string) => {
        const clean = String(rawOrigin || '').trim().replace(/\/+$/, '');
        if (!clean.startsWith('https://') || clean === lastPublishedBridgeOrigin) return;
        let safeOrigin = '';
        try {
          const parsed = new URL(clean);
          const host = parsed.hostname.toLowerCase();
          if (
            parsed.protocol === 'https:' &&
            (host.endsWith('.trycloudflare.com') ||
              host.endsWith('.lhr.life') ||
              host.endsWith('.serveousercontent.com') ||
              Boolean(process.env.FILMIO_BRIDGE_URL))
          ) {
            safeOrigin = parsed.origin;
          }
        } catch {
          return;
        }
        if (!safeOrigin || safeOrigin === lastPublishedBridgeOrigin) return;
        lastPublishedBridgeOrigin = safeOrigin;
        void fetch('https://filmio.my/api/tv-bridge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bridgeUrl: safeOrigin }),
          signal: AbortSignal.timeout(5000),
        }).catch(() => {
          lastPublishedBridgeOrigin = '';
        });
      };

      if (process.env.FILMIO_BRIDGE_URL) {
        publishHomeBridgeOriginOnce(process.env.FILMIO_BRIDGE_URL);
      }

      // FileList.io Live Torrent Catalog, Resolver & Remux Streaming Engine
      server.middlewares.use(async (req, res, next) => {
        const reqHost = String(req.headers.host || '').trim().toLowerCase();
        if (
          reqHost.endsWith('.trycloudflare.com') ||
          reqHost.endsWith('.lhr.life') ||
          reqHost.endsWith('.serveousercontent.com')
        ) {
          publishHomeBridgeOriginOnce(`https://${reqHost}`);
        }
        if (req.url && req.url.startsWith('/api/filelist')) {
          const handled = await handleFileListRequest(req, res);
          if (handled) return;
        }
        if (req.url && req.url.startsWith('/api/youtube')) {
          const handled = await handleYouTubeRequest(req, res);
          if (handled) return;
        }
        next();
      });

      // Fast lossless MPEG-TS -> MP4 (+faststart) remuxer for iPhone / iOS Offline playback & Files app export
      server.middlewares.use('/api/offline-remux-mp4', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }
        const vLen = Number(req.headers['x-video-bytes'] || 0);
        const aLen = Number(req.headers['x-audio-bytes'] || 0);
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          const totalBuf = Buffer.concat(chunks);
          if (totalBuf.length === 0) {
            res.statusCode = 400;
            res.end('Empty body');
            return;
          }
          const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const tmpDir = os.tmpdir();
          const vPath = path.join(tmpDir, `filmio_v_${stamp}.ts`);
          const aPath = path.join(tmpDir, `filmio_a_${stamp}.ts`);
          const outPath = path.join(tmpDir, `filmio_out_${stamp}.mp4`);

          const cleanupTmp = () => {
            for (const p of [vPath, aPath, outPath]) {
              try {
                if (fs.existsSync(p)) fs.unlinkSync(p);
              } catch {
                // ignore
              }
            }
          };

          try {
            const actualVLen = vLen > 0 && vLen <= totalBuf.length ? vLen : totalBuf.length;
            fs.writeFileSync(vPath, totalBuf.subarray(0, actualVLen));
            const hasAudio = aLen > 0 && actualVLen + aLen <= totalBuf.length;
            if (hasAudio) {
              fs.writeFileSync(aPath, totalBuf.subarray(actualVLen, actualVLen + aLen));
            }

            const ffBin = (ffmpegPath as unknown as string) || 'ffmpeg';
            const ffArgs = hasAudio
              ? [
                '-y',
                '-hide_banner',
                '-loglevel',
                'error',
                '-i',
                vPath,
                '-i',
                aPath,
                '-map',
                '0:v:0',
                '-map',
                '1:a:0',
                '-c',
                'copy',
                '-bsf:a',
                'aac_adtstoasc',
                '-movflags',
                '+faststart',
                outPath,
              ]
              : [
                '-y',
                '-hide_banner',
                '-loglevel',
                'error',
                '-i',
                vPath,
                '-c',
                'copy',
                '-bsf:a',
                'aac_adtstoasc',
                '-movflags',
                '+faststart',
                outPath,
              ];

            const proc = spawn(ffBin, ffArgs);
            proc.stderr?.resume();
            const ffTimer = setTimeout(() => {
              try { proc.kill('SIGKILL'); } catch { /* ignore */ }
            }, 90_000);
            proc.on('close', () => clearTimeout(ffTimer));
            proc.on('error', () => {
              clearTimeout(ffTimer);
              cleanupTmp();
              if (!res.headersSent) {
                res.statusCode = 500;
                res.end('ffmpeg spawn error');
              }
            });
            proc.on('close', (code) => {
              if (code === 0 && fs.existsSync(outPath)) {
                try {
                  const stat = fs.statSync(outPath);
                  res.writeHead(200, {
                    'Content-Type': 'video/mp4',
                    'Content-Length': String(stat.size),
                    'Cache-Control': 'no-store',
                  });
                  const rs = fs.createReadStream(outPath);
                  rs.on('close', cleanupTmp);
                  rs.on('error', cleanupTmp);
                  rs.pipe(res);
                  return;
                } catch {
                  // fallthrough
                }
              }
              cleanupTmp();
              if (!res.headersSent) {
                res.statusCode = 500;
                res.end('ffmpeg remux failed');
              }
            });
          } catch {
            cleanupTmp();
            if (!res.headersSent) {
              res.statusCode = 500;
              res.end('remux exception');
            }
          }
        });
      });

      server.middlewares.use('/api/radio-meta', async (req, res) => {
        try {
          const reqUrl = new URL(req.url || '', 'http://localhost');
          const streamUrl = reqUrl.searchParams.get('url') || '';
          const stationName = reqUrl.searchParams.get('name') || '';
          let rawTitle = (reqUrl.searchParams.get('rawTitle') || '').trim();
          let fallbackOrbCoverUrl: string | undefined;

          const isValidSongCandidate = (cand: string | null | undefined) => {
            if (!cand || isGenericStationSlogan(cand, stationName)) return false;
            const parsed = parseRawStreamMetadataServer(cand, stationName);
            return Boolean(parsed && (parsed.title || parsed.artist));
          };

          if (!rawTitle && streamUrl && /^https?:\/\//i.test(streamUrl) && !isDisallowedDevTargetUrl(streamUrl)) {
            const icyTitle = await readIcyStreamTitle(streamUrl);
            if (icyTitle && isValidSongCandidate(icyTitle)) {
              rawTitle = icyTitle;
            }
            if (!rawTitle) {
              const icecastTitle = await readIcecastStatusTitle(streamUrl);
              if (icecastTitle && isValidSongCandidate(icecastTitle)) {
                rawTitle = icecastTitle;
              }
            }
            if (!rawTitle) {
              const orbTrack = await readOnlineRadioBoxTrack(
                streamUrl,
                stationName
              );
              if (
                orbTrack?.rawTitle &&
                isValidSongCandidate(orbTrack.rawTitle)
              ) {
                rawTitle = orbTrack.rawTitle;
                fallbackOrbCoverUrl = orbTrack.coverUrl;
              }
            }
          }

          if (!rawTitle || isGenericStationSlogan(rawTitle, stationName)) {
            res.writeHead(200, {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-cache',
            });
            res.end(JSON.stringify({ track: null }));
            return;
          }

          const rich = await resolveRichTrackMetadata(rawTitle, stationName);
          if (rich) {
            const rawCover = rich.coverUrl || fallbackOrbCoverUrl;
            const rawAvatar = rich.artistAvatarUrl || rawCover;
            const toTvSafeImg = (u?: string) =>
              u && /^https?:\/\//i.test(u)
                ? `/api/tv-proxy?url=${encodeURIComponent(u)}`
                : u;
            const tvSafeRich: RichTrackInfo = {
              ...rich,
              coverUrl: toTvSafeImg(rawCover),
              artistAvatarUrl: toTvSafeImg(rawAvatar),
            };
            res.writeHead(200, {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-cache',
            });
            res.end(JSON.stringify({ track: tvSafeRich }));
            return;
          }

          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache',
          });
          res.end(JSON.stringify({ track: null }));
        } catch {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json; charset=utf-8',
          });
          res.end(JSON.stringify({ track: null }));
        }
      });

      server.middlewares.use('/api/tv-epg-archive', async (req, res) => {
        try {
          const reqUrl = new URL(req.url || '', 'http://localhost');
          const country = reqUrl.searchParams.get('country') || 'RU';
          const tvgId = (reqUrl.searchParams.get('tvgId') || '').trim();
          const name = (reqUrl.searchParams.get('name') || '').trim();

          const feedUrls = getEpgFeedUrlsForCountry(country);
          const results = await Promise.allSettled(
            feedUrls.map((u) => fetchAndParseXmltvFeed(u))
          );

          const mergedArchive: ParsedEpgFeed['archiveChannels'] = {};
          const mergedKeyMap: Record<string, string> = {};

          for (const r of results) {
            if (r.status !== 'fulfilled') continue;
            Object.assign(mergedArchive, r.value.archiveChannels);
            for (const [k, v] of Object.entries(r.value.keyMap)) {
              if (!mergedKeyMap[k]) mergedKeyMap[k] = v;
            }
          }

          let matchedEntry:
            | {
              icon: string;
              displayName: string;
              programmes: EpgProgrammeItem[];
            }
            | undefined;

          if (tvgId) {
            const cleanId = tvgId.replace(/@\w+$/, '');
            matchedEntry =
              mergedArchive[tvgId] ||
              mergedArchive[cleanId] ||
              mergedArchive[mergedKeyMap[normalizeEpgKey(cleanId, false)]] ||
              mergedArchive[mergedKeyMap[normalizeEpgKey(cleanId, true)]];
          }

          if (!matchedEntry && name) {
            const nk1 = normalizeEpgKey(name, false);
            const nk2 = normalizeEpgKey(name, true);
            matchedEntry =
              (nk1 && mergedArchive[mergedKeyMap[nk1]]) ||
              (nk2 && mergedArchive[mergedKeyMap[nk2]]) ||
              undefined;
          }

          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
          });
          res.end(
            JSON.stringify({
              programmes: matchedEntry ? matchedEntry.programmes : [],
              icon: matchedEntry?.icon || '',
              displayName: matchedEntry?.displayName || name,
            })
          );
        } catch (err) {
          res.writeHead(500, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          });
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'EPG archive error',
              programmes: [],
            })
          );
        }
      });

      server.middlewares.use('/api/vod-stream', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Private-Network': 'true',
          });
          res.end();
          return;
        }
        try {
          const reqUrl = new URL(req.url || '', 'http://localhost');
          const kp = reqUrl.searchParams.get('kp') || '';
          const imdb = reqUrl.searchParams.get('imdb') || '';
          const title = reqUrl.searchParams.get('title') || '';
          const mediaType = reqUrl.searchParams.get('type') || '';
          const year = reqUrl.searchParams.get('year') || '';
          const season =
            Number(
              reqUrl.searchParams.get('season') || reqUrl.searchParams.get('s')
            ) || 1;
          const episode =
            Number(
              reqUrl.searchParams.get('episode') || reqUrl.searchParams.get('e')
            ) || 1;
          const ru = reqUrl.searchParams.get('ru') ?? '';
          const reqUa = String(req.headers['user-agent'] || '');
          const vodStreamPath = path.resolve(
            __dirname,
            'netlify/functions/vod-stream.mjs'
          );
          const vodMtime = fs.existsSync(vodStreamPath)
            ? Math.floor(fs.statSync(vodStreamPath).mtimeMs)
            : 0;
          const vodStreamUrl = `file://${vodStreamPath}?t=${vodMtime}`;
          const mod = await import(/* @vite-ignore */ vodStreamUrl);
          const result = await mod.resolveVodStreamData({
            kp,
            imdb,
            title,
            mediaType,
            year,
            season,
            episode,
            ru,
            userAgent: reqUa,
          });
          if (result.ok && result.hlsUrl) {
            if (String(result.hlsUrl).startsWith('/api/tv-proxy')) {
              result.proxyHlsUrl = result.hlsUrl;
            } else if (!result.proxyHlsUrl) {
              const safeDesktopUa =
                result.userAgent ||
                reqUa ||
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
              const proxyRef = /rutube\.ru|rtbcdn\.ru/i.test(result.hlsUrl)
                ? 'https://rutube.ru/'
                : /vkvideo\.ru|okcdn\.ru|vkuser/i.test(result.hlsUrl)
                  ? 'https://vkvideo.ru/'
                  : 'https://api.kinogram.best/';
              result.proxyHlsUrl = `/api/tv-proxy?url=${encodeURIComponent(
                result.hlsUrl
              )}&ref=${encodeURIComponent(
                proxyRef
              )}&ua=${encodeURIComponent(safeDesktopUa)}`;
            }
          }
          console.log(
            `[VOD-STREAM] ${title || imdb || kp} -> ok=${result.ok} source=${result.sourcePath || 'none'
            }`
          );
          res.writeHead(result.ok ? 200 : 404, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Private-Network': 'true',
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache',
          });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Private-Network': 'true',
            'Content-Type': 'application/json; charset=utf-8',
          });
          res.end(
            JSON.stringify({
              ok: false,
              error: err instanceof Error ? err.message : 'VOD stream error',
            })
          );
        }
      });

      server.middlewares.use('/api/tv-epg', async (req, res) => {
        try {
          const reqUrl = new URL(req.url || '', 'http://localhost');
          const country = reqUrl.searchParams.get('country') || 'RO';
          const feedUrls = getEpgFeedUrlsForCountry(country);

          const results = await Promise.allSettled(
            feedUrls.map((u) => fetchAndParseXmltvFeed(u))
          );

          const mergedChannels: ParsedEpgFeed['channels'] = {};
          const mergedKeyMap: Record<string, string> = {};

          for (const r of results) {
            if (r.status !== 'fulfilled') continue;
            Object.assign(mergedChannels, r.value.channels);
            for (const [k, v] of Object.entries(r.value.keyMap)) {
              if (!mergedKeyMap[k]) mergedKeyMap[k] = v;
            }
          }

          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
          });
          res.end(
            JSON.stringify({
              channels: mergedChannels,
              keyMap: mergedKeyMap,
            })
          );
        } catch (err) {
          res.writeHead(500, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          });
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'EPG error',
              channels: {},
              keyMap: {},
            })
          );
        }
      });

      const vkMetaCache = new Map<
        string,
        {
          totalBytes: number;
          contentType: string;
          resolvedUrl: string;
          ts: number;
        }
      >();
      const transcodedTsCache = new Map<string, { buf: Buffer; ts: number }>();
      const transcodedTsInFlight = new Map<string, Promise<Buffer>>();
      const vodAcceleratedSegCache = new Map<
        string,
        { buf: Buffer; contentType: string; ts: number }
      >();
      const vodAcceleratedSegInFlight = new Map<
        string,
        Promise<{ buf: Buffer; contentType: string } | null>
      >();
      const vkHttpsAgent = new https.Agent({
        keepAlive: true,
        maxSockets: 64,
        maxFreeSockets: 24,
      });
      const vkHttpAgent = new http.Agent({
        keepAlive: true,
        maxSockets: 64,
        maxFreeSockets: 24,
      });

      const fetchVkRangeHttp1 = (
        urlStr: string,
        start: number,
        end: number,
        hdrs: Record<string, string>,
        timeoutMs: number,
        signal?: AbortSignal,
        redirectsLeft = 4
      ): Promise<{
        status: number;
        headers: http.IncomingHttpHeaders;
        body: Buffer;
        finalUrl: string;
      }> =>
        new Promise((resolve, reject) => {
          if (signal?.aborted) {
            reject(new Error('Client aborted'));
            return;
          }
          let parsedU: URL;
          try {
            parsedU = new URL(urlStr);
          } catch (err) {
            reject(err);
            return;
          }
          const isHttps = parsedU.protocol === 'https:';
          const transport = isHttps ? https : http;
          const reqHdrs: Record<string, string> = {
            ...hdrs,
            Connection: 'keep-alive',
          };
          if (start >= 0 && end >= start) {
            reqHdrs.Range = `bytes=${start}-${end}`;
          }
          let settled = false;
          const reqOut = transport.get(
            {
              protocol: parsedU.protocol,
              hostname: parsedU.hostname,
              port: parsedU.port || (isHttps ? 443 : 80),
              path: `${parsedU.pathname}${parsedU.search}`,
              agent: isHttps ? vkHttpsAgent : vkHttpAgent,
              headers: reqHdrs,
            },
            (resIn) => {
              const sc = resIn.statusCode || 0;
              if (
                [301, 302, 303, 307, 308].includes(sc) &&
                resIn.headers.location &&
                redirectsLeft > 0
              ) {
                resIn.resume();
                settled = true;
                clearTimeout(timer);
                signal?.removeEventListener('abort', onAbort);
                const nextUrl = new URL(resIn.headers.location, urlStr).toString();
                fetchVkRangeHttp1(
                  nextUrl,
                  start,
                  end,
                  hdrs,
                  timeoutMs,
                  signal,
                  redirectsLeft - 1
                ).then(resolve, reject);
                return;
              }
              const chunks: Buffer[] = [];
              resIn.on('data', (c: Buffer) => chunks.push(c));
              resIn.on('end', () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                signal?.removeEventListener('abort', onAbort);
                resolve({
                  status: sc,
                  headers: resIn.headers,
                  body: Buffer.concat(chunks),
                  finalUrl: urlStr,
                });
              });
              resIn.on('error', (err) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                signal?.removeEventListener('abort', onAbort);
                reject(err);
              });
            }
          );
          const onAbort = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reqOut.destroy(new Error('Client aborted'));
            reject(new Error('Client aborted'));
          };
          const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            signal?.removeEventListener('abort', onAbort);
            reqOut.destroy(new Error('VK slice timeout'));
            reject(new Error('VK slice timeout'));
          }, timeoutMs);
          signal?.addEventListener('abort', onAbort, { once: true });
          reqOut.on('error', (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            reject(err);
          });
        });

      const fetchParallelSegmentBuffer = async (
        mediaUrl: string,
        totalBytesVal: number,
        hdrs: Record<string, string>,
        workersCount: number,
        signal?: AbortSignal
      ): Promise<Buffer> => {
        const tsSliceStep = 262144; // 256 KB
        const tsRanges: Array<[number, number]> = [];
        for (let b = 0; b < totalBytesVal; b += tsSliceStep) {
          tsRanges.push([b, Math.min(b + tsSliceStep - 1, totalBytesVal - 1)]);
        }
        const results: Buffer[] = new Array(tsRanges.length);
        let cursor = 0;
        const runWorker = async () => {
          while (!signal?.aborted) {
            const idx = cursor++;
            if (idx >= tsRanges.length) return;
            const [s, e] = tsRanges[idx];
            let lastErr: unknown = null;
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                const sr = await fetchVkRangeHttp1(
                  mediaUrl,
                  s,
                  e,
                  hdrs,
                  9500,
                  signal
                );
                if (
                  (sr.status === 200 || sr.status === 206) &&
                  sr.body.length === e - s + 1
                ) {
                  results[idx] = sr.body;
                  lastErr = null;
                  break;
                }
              } catch (err) {
                lastErr = err;
                if (signal?.aborted) throw err;
                await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
              }
            }
            if (lastErr || !results[idx]) {
              throw lastErr || new Error('Segment slice failed');
            }
          }
        };
        const workers = Array.from(
          { length: Math.min(workersCount, tsRanges.length) },
          () => runWorker()
        );
        await Promise.all(workers);
        return Buffer.concat(results);
      };

      const prewarmVidmolySegment = async (
        segUrl: string,
        refHdr: string,
        originHdr: string,
        uaStr: string
      ): Promise<{ buf: Buffer; contentType: string } | null> => {
        const nowTs = Date.now();
        const cached = vodAcceleratedSegCache.get(segUrl);
        if (cached && nowTs - cached.ts < 90_000) {
          return { buf: cached.buf, contentType: cached.contentType };
        }
        vodAcceleratedSegCache.delete(segUrl);

        const existing = vodAcceleratedSegInFlight.get(segUrl);
        if (existing) {
          return existing;
        }

        const job = (async (): Promise<{
          buf: Buffer;
          contentType: string;
        } | null> => {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 22000);
          try {
            const probeRes = await fetchVkRangeHttp1(
              segUrl,
              0,
              1,
              {
                'User-Agent': uaStr,
                Referer: refHdr,
                Origin: originHdr,
                Accept: '*/*',
              },
              6000,
              ctrl.signal
            );
            const ctRaw = String(probeRes.headers['content-type'] || '').toLowerCase();
            const crMatch = String(probeRes.headers['content-range'] || '').match(
              /\/(\d+)$/
            );
            const totalBytes = crMatch
              ? Number(crMatch[1]) || 0
              : probeRes.status === 200
                ? Number(probeRes.headers['content-length'] || 0)
                : 0;
            const resolvedUrl = probeRes.finalUrl || segUrl;
            const ok =
              (probeRes.status === 200 || probeRes.status === 206) &&
              totalBytes > 0 &&
              !ctRaw.includes('mpegurl') &&
              !ctRaw.includes('m3u');
            if (!ok) return null;

            const contentTypeOut = ctRaw || 'video/mp2t';
            vkMetaCache.set(segUrl, {
              totalBytes,
              contentType: contentTypeOut,
              resolvedUrl,
              ts: Date.now(),
            });

            const buf = await fetchParallelSegmentBuffer(
              resolvedUrl,
              totalBytes,
              {
                'User-Agent': uaStr,
                Referer: refHdr,
                Origin: originHdr,
                Accept: '*/*',
              },
              14,
              ctrl.signal
            );
            const storeTs = Date.now();
            for (const [k, v] of vodAcceleratedSegCache) {
              if (storeTs - v.ts >= 90_000) {
                vodAcceleratedSegCache.delete(k);
              }
            }
            while (vodAcceleratedSegCache.size >= 8) {
              const oldestKey = vodAcceleratedSegCache.keys().next().value;
              if (!oldestKey) break;
              vodAcceleratedSegCache.delete(oldestKey);
            }
            vodAcceleratedSegCache.set(segUrl, {
              buf,
              contentType: contentTypeOut,
              ts: storeTs,
            });
            return { buf, contentType: contentTypeOut };
          } catch {
            return null;
          } finally {
            clearTimeout(timer);
            vodAcceleratedSegInFlight.delete(segUrl);
          }
        })();

        job.catch(() => { });
        vodAcceleratedSegInFlight.set(segUrl, job);
        return job;
      };

      server.middlewares.use('/api/tv-proxy', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Private-Network': 'true',
          });
          res.end();
          return;
        }

        try {
          const reqUrl = new URL(req.url || '', 'http://localhost');
          const rawTargetUrl = reqUrl.searchParams.get('url');
          const targetUrl = rawTargetUrl
            ? rawTargetUrl.replace(
              /\/\/live7digi\.antenaplay\.ro\//gi,
              '//live4ro.antenaplay.ro/'
            )
            : null;
          const customRef = reqUrl.searchParams.get('ref') || '';
          const customUa = reqUrl.searchParams.get('ua') || '';
          const rawMode = reqUrl.searchParams.get('raw') === '1';
          const skipAd = reqUrl.searchParams.get('skipAd') === '1';
          const wantOrigAudio = reqUrl.searchParams.get('orig') === '1';
          const keepAllQualities = reqUrl.searchParams.get('allQualities') === '1';
          const audioIdxParam = reqUrl.searchParams.get('audioIdx');
          const requestedAudioIdx =
            audioIdxParam !== null && /^\d+$/.test(audioIdxParam)
              ? Number(audioIdxParam)
              : -1;

          if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Invalid or missing url parameter');
            return;
          }

          const parsedTarget = new URL(targetUrl);
          if (isDisallowedDevTargetUrl(targetUrl)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden target host');
            return;
          }
          const refererHeader = customRef || `${parsedTarget.origin}/`;
          let originHeader = parsedTarget.origin;
          if (customRef) {
            try {
              originHeader = new URL(customRef).origin;
            } catch {
              // keep parsedTarget.origin
            }
          }

          const effectiveUa =
            customUa ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

          const isLikelyDirectRadioStream =
            skipAd &&
            !/\.(?:ts|m4s|mp4|aac|jpg|jpeg|png|webp|vtt|srt)(\?|$)/i.test(
              parsedTarget.pathname
            ) &&
            !/\.m3u8?(\?|$)/i.test(parsedTarget.pathname);

          // Automatic 2x Pre-Connect Handshake to skip 30-second preroll ads (Icecast hss7 / Adswizz / HostingRadio / Streamr)
          if (isLikelyDirectRadioStream) {
            for (let warmIdx = 0; warmIdx < 2; warmIdx++) {
              const warmCtrl = new AbortController();
              const warmTimer = setTimeout(() => warmCtrl.abort(), 1400);
              try {
                const warmCookie = getRadioCookieHeader(targetUrl);
                const warmRes = await fetchSafeDevExternalUrl(targetUrl, {
                  method: 'GET',
                  headers: {
                    'User-Agent': effectiveUa,
                    Referer: refererHeader,
                    Origin: originHeader,
                    Accept: '*/*',
                    ...(warmCookie ? { Cookie: warmCookie } : {}),
                  },
                  signal: warmCtrl.signal,
                });
                saveRadioResponseCookies(targetUrl, warmRes.headers);
                if (warmRes.body) {
                  const warmReader = warmRes.body.getReader();
                  await warmReader.read().catch(() => { });
                }
              } catch {
                // ignore warm probe abort
              } finally {
                clearTimeout(warmTimer);
                warmCtrl.abort();
              }
            }
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 35000);

          const activeCookie = getRadioCookieHeader(targetUrl);
          const rangeHeader = req.headers.range;

          // VK / OK CDN & iEdem Live TV Parallel Byte-Range Accelerator:
          // vkuser.net / okcdn.ru / rossteleccom.net / iedem.com throttle individual HTTP connections to ~0.6-1.76 Mbps,
          // causing HD/4K segments to stall. Sliding-window parallel Range slices boost throughput to 12-25+ Mbps
          // while strictly honoring HTTP 200 (no Range) & full HTTP 206 Range semantics (no premature truncation on Smart TV / Safari).
          const isVidmolyThrottledSeg =
            /(vmget\.online|vmpx\.online|vmnow\.online|vmeas\.cloud|vidmoly)/i.test(
              targetUrl
            ) && /\.(?:ts|m4s|mp4|aac)(\?|$)/i.test(parsedTarget.pathname);
          const isIedemThrottledSeg =
            /(rossteleccom\.net|iedem\.com|jmeekos\.com)/i.test(targetUrl) ||
            isVidmolyThrottledSeg ||
            /\/iptv\/[A-Za-z0-9_-]+\/\d+\/[^/?#]+\.(?:ts|m4s|mp4|aac)$/i.test(
              parsedTarget.pathname
            );
          const isVkThrottledBinary =
            (req.method === 'GET' || req.method === 'HEAD') &&
            !rawMode &&
            (/(vkuser\.net|okcdn\.ru|mycdn\.me|vkuservideo\.net)/i.test(targetUrl) ||
              isIedemThrottledSeg) &&
            !/\.(m3u8?|pls)(\?|$)/i.test(parsedTarget.pathname) &&
            !/\/video\/?$/i.test(parsedTarget.pathname);

          if (isVidmolyThrottledSeg && !rangeHeader && req.method === 'GET' && !rawMode) {
            const segMatch = targetUrl.match(
              /\/seg-(\d+)((?:-v\d+-a\d+)?\.ts)(\?.*)?$/i
            );
            if (segMatch) {
              const segIdx = Number(segMatch[1]);
              const suffix = segMatch[2] || '.ts';
              const queryPart = segMatch[3] || '';
              for (const nextIdx of [segIdx + 1, segIdx + 2]) {
                const nextUrl = targetUrl.replace(
                  /\/seg-\d+(?:-v\d+-a\d+)?\.ts(\?.*)?$/i,
                  `/seg-${nextIdx}${suffix}${queryPart}`
                );
                if (nextUrl && nextUrl !== targetUrl) {
                  void prewarmVidmolySegment(
                    nextUrl,
                    refererHeader,
                    originHeader,
                    effectiveUa
                  );
                }
              }
            }
            const segHit = await prewarmVidmolySegment(
              targetUrl,
              refererHeader,
              originHeader,
              effectiveUa
            );
            if (segHit && segHit.buf.length > 0) {
              clearTimeout(timeoutId);
              if (res.writableEnded || res.destroyed || req.aborted) {
                return;
              }
              res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Private-Network': 'true',
                'Access-Control-Expose-Headers':
                  'Content-Length, Content-Range, Accept-Ranges, Content-Type',
                'Content-Type': segHit.contentType || 'video/mp2t',
                'Content-Length': String(segHit.buf.length),
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=60',
              });
              res.end(segHit.buf);
              return;
            }
          }

          if (isVkThrottledBinary) {
            const accelCtrl = new AbortController();
            const onEarlyClose = () => {
              if (!res.writableEnded) accelCtrl.abort();
            };
            req.on('aborted', onEarlyClose);
            res.on('close', onEarlyClose);
            try {
              let meta = vkMetaCache.get(targetUrl);
              if (!meta || Date.now() - meta.ts > 10 * 60 * 1000) {
                let headCt = '';
                let totalBytes = 0;
                let resolvedUrl = targetUrl;
                let upstreamOk = false;

                try {
                  const rpRes = await fetchVkRangeHttp1(
                    targetUrl,
                    0,
                    1,
                    {
                      'User-Agent': effectiveUa,
                      Referer: refererHeader,
                      Origin: originHeader,
                      Accept: '*/*',
                    },
                    6000,
                    accelCtrl.signal
                  );
                  headCt = String(rpRes.headers['content-type'] || '').toLowerCase();
                  const crMatch = String(rpRes.headers['content-range'] || '').match(
                    /\/(\d+)$/
                  );
                  if (crMatch) {
                    totalBytes = Number(crMatch[1]) || 0;
                  } else if (rpRes.status === 200) {
                    totalBytes = Number(rpRes.headers['content-length'] || 0);
                  }
                  resolvedUrl = rpRes.finalUrl || targetUrl;
                  upstreamOk = rpRes.status === 200 || rpRes.status === 206;
                } catch {
                  // ignore probe failure
                }

                if (
                  upstreamOk &&
                  totalBytes > 0 &&
                  !headCt.includes('mpegurl') &&
                  !headCt.includes('m3u')
                ) {
                  if (vkMetaCache.size > 400) {
                    const nowTs = Date.now();
                    for (const [k, v] of vkMetaCache) {
                      if (nowTs - v.ts > 5 * 60 * 1000 || vkMetaCache.size > 300) {
                        vkMetaCache.delete(k);
                      }
                    }
                  }
                  meta = {
                    totalBytes,
                    contentType: headCt || 'video/mp4',
                    resolvedUrl,
                    ts: Date.now(),
                  };
                  vkMetaCache.set(targetUrl, meta);
                }
              }

              if (meta && meta.totalBytes > 0) {
                const {
                  totalBytes,
                  contentType: headCt,
                  resolvedUrl: resolvedMediaUrl,
                } = meta;
                const isTsSeg =
                  /\.(ts|m4s|aac)(\?|$)/i.test(parsedTarget.pathname) ||
                  headCt.includes('mp2t');
                const contentTypeOut = isTsSeg
                  ? headCt || 'video/mp2t'
                  : headCt || 'video/mp4';

                if (req.method === 'HEAD') {
                  clearTimeout(timeoutId);
                  req.off('aborted', onEarlyClose);
                  res.off('close', onEarlyClose);
                  res.writeHead(200, {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Private-Network': 'true',
                    'Access-Control-Expose-Headers':
                      'Content-Length, Content-Range, Accept-Ranges, Content-Type',
                    'Content-Type': contentTypeOut,
                    'Content-Length': String(totalBytes),
                    'Accept-Ranges': 'bytes',
                    'Cache-Control': 'public, max-age=60',
                  });
                  res.end();
                  return;
                }

                const rangeMatch = String(rangeHeader || '').match(
                  /bytes=(\d+)-(\d*)/i
                );

                // Ultra-fast parallel fetch + hardware-universal H.264/AAC remux for HEVC live TV segments (Pro TV RO 6997)
                const needsHevcToH264Transcode =
                  isTsSeg &&
                  !rangeMatch &&
                  req.method === 'GET' &&
                  Boolean(ffmpegPath) &&
                  (/\/iptv\/[^/]+\/6997\/[^/?#]+\.ts/i.test(resolvedMediaUrl) ||
                    reqUrl.searchParams.get('h264') === '1');

                if (needsHevcToH264Transcode) {
                  clearTimeout(timeoutId);
                  let cachedHit = transcodedTsCache.get(resolvedMediaUrl);
                  if (cachedHit && Date.now() - cachedHit.ts >= 45000) {
                    transcodedTsCache.delete(resolvedMediaUrl);
                    cachedHit = undefined;
                  }
                  let outBuf: Buffer;
                  if (cachedHit) {
                    outBuf = cachedHit.buf;
                  } else {
                    let jobPromise = transcodedTsInFlight.get(resolvedMediaUrl);
                    if (!jobPromise) {
                      jobPromise = (async (): Promise<Buffer> => {
                        const jobCtrl = new AbortController();
                        const jobTimer = setTimeout(() => jobCtrl.abort(), 25000);
                        try {
                          const tsSliceStep = 262144; // 256 KB
                          const tsRanges: Array<[number, number]> = [];
                          for (let b = 0; b < totalBytes; b += tsSliceStep) {
                            tsRanges.push([b, Math.min(b + tsSliceStep - 1, totalBytes - 1)]);
                          }
                          const results: Buffer[] = new Array(tsRanges.length);
                          let cursor = 0;
                          const runJobWorker = async () => {
                            while (!jobCtrl.signal.aborted) {
                              const idx = cursor++;
                              if (idx >= tsRanges.length) return;
                              const [s, e] = tsRanges[idx];
                              let lastErr: unknown = null;
                              for (let attempt = 0; attempt < 2; attempt++) {
                                try {
                                  const sr = await fetchVkRangeHttp1(
                                    resolvedMediaUrl,
                                    s,
                                    e,
                                    {
                                      'User-Agent': effectiveUa,
                                      Referer: refererHeader,
                                      Origin: originHeader,
                                      Accept: '*/*',
                                    },
                                    9500,
                                    jobCtrl.signal
                                  );
                                  if (
                                    (sr.status === 200 || sr.status === 206) &&
                                    sr.body.length === e - s + 1
                                  ) {
                                    results[idx] = sr.body;
                                    lastErr = null;
                                    break;
                                  }
                                } catch (err) {
                                  lastErr = err;
                                  if (jobCtrl.signal.aborted) throw err;
                                  await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
                                }
                              }
                              if (lastErr || !results[idx]) {
                                throw lastErr || new Error('HEVC TS slice failed');
                              }
                            }
                          };
                          const workers = Array.from(
                            { length: Math.min(18, tsRanges.length) },
                            () => runJobWorker()
                          );
                          await Promise.all(workers);
                          const rawTsBuf = Buffer.concat(results);
                          const remuxed = await new Promise<Buffer>((resolveRemux) => {
                            const ff = spawn(ffmpegPath!, [
                              '-hide_banner',
                              '-loglevel',
                              'error',
                              '-copyts',
                              '-i',
                              'pipe:0',
                              '-map',
                              '0:v:0',
                              '-map',
                              '0:a:0?',
                              '-c:v',
                              'libx264',
                              '-preset',
                              'ultrafast',
                              '-crf',
                              '22',
                              '-g',
                              '50',
                              '-keyint_min',
                              '50',
                              '-sc_threshold',
                              '0',
                              '-pix_fmt',
                              'yuv420p',
                              '-bsf:v',
                              'dump_extra',
                              '-c:a',
                              'copy',
                              '-muxdelay',
                              '0',
                              '-muxpreload',
                              '0',
                              '-f',
                              'mpegts',
                              'pipe:1',
                            ]);
                            const outChunks: Buffer[] = [];
                            let settled = false;
                            ff.stderr?.resume();
                            const remuxTimer = setTimeout(() => {
                              try { ff.kill('SIGKILL'); } catch { /* ignore */ }
                              if (!settled) { settled = true; resolveRemux(rawTsBuf); }
                            }, 25_000);
                            ff.stdout.on('data', (c: Buffer) => outChunks.push(c));
                            ff.on('error', () => {
                              clearTimeout(remuxTimer);
                              if (!settled) {
                                settled = true;
                                resolveRemux(rawTsBuf);
                              }
                            });
                            ff.on('close', (code) => {
                              clearTimeout(remuxTimer);
                              if (!settled) {
                                settled = true;
                                const merged = Buffer.concat(outChunks);
                                resolveRemux(
                                  code === 0 && merged.length > 0 ? merged : rawTsBuf
                                );
                              }
                            });
                            ff.stdin.on('error', () => { });
                            ff.stdin.end(rawTsBuf);
                          });
                          const nowCacheTs = Date.now();
                          for (const [k, v] of transcodedTsCache) {
                            if (nowCacheTs - v.ts >= 45000) {
                              transcodedTsCache.delete(k);
                            }
                          }
                          while (transcodedTsCache.size >= 8) {
                            const oldestKey = transcodedTsCache.keys().next().value;
                            if (!oldestKey) break;
                            transcodedTsCache.delete(oldestKey);
                          }
                          transcodedTsCache.set(resolvedMediaUrl, {
                            buf: remuxed,
                            ts: Date.now(),
                          });
                          return remuxed;
                        } finally {
                          clearTimeout(jobTimer);
                          transcodedTsInFlight.delete(resolvedMediaUrl);
                        }
                      })();
                      jobPromise.catch(() => { });
                      transcodedTsInFlight.set(resolvedMediaUrl, jobPromise);
                    }
                    outBuf = await jobPromise;
                  }
                  if (res.writableEnded || res.destroyed) {
                    return;
                  }
                  req.off('aborted', onEarlyClose);
                  res.off('close', onEarlyClose);
                  res.writeHead(200, {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Private-Network': 'true',
                    'Access-Control-Expose-Headers':
                      'Content-Length, Content-Range, Accept-Ranges, Content-Type',
                    'Content-Type': 'video/mp2t',
                    'Content-Length': String(outBuf.length),
                    'Cache-Control': 'public, max-age=30',
                  });
                  res.end(outBuf);
                  return;
                }

                // Small explicit range (e.g. Chrome/LG checking headers, bytes=0-1000, or <= 512KB):
                // Direct single range fetch over HTTP/1.1 keep-alive socket
                if (rangeMatch && rangeMatch[2]) {
                  const s = Number(rangeMatch[1]);
                  const e = Math.min(Number(rangeMatch[2]), totalBytes - 1);
                  if (e >= s && e - s + 1 <= 512 * 1024) {
                    clearTimeout(timeoutId);
                    try {
                      const sr = await fetchVkRangeHttp1(
                        resolvedMediaUrl,
                        s,
                        e,
                        {
                          'User-Agent': effectiveUa,
                          Referer: refererHeader,
                          Origin: originHeader,
                          Accept: '*/*',
                        },
                        8000,
                        accelCtrl.signal
                      );
                      if (sr.status === 200 || sr.status === 206) {
                        req.off('aborted', onEarlyClose);
                        res.off('close', onEarlyClose);
                        res.writeHead(206, {
                          'Access-Control-Allow-Origin': '*',
                          'Access-Control-Allow-Private-Network': 'true',
                          'Access-Control-Expose-Headers':
                            'Content-Length, Content-Range, Accept-Ranges, Content-Type',
                          'Content-Type': contentTypeOut,
                          'Content-Range': `bytes ${s}-${s + sr.body.length - 1}/${totalBytes}`,
                          'Content-Length': String(sr.body.length),
                          'Accept-Ranges': 'bytes',
                          'Cache-Control': 'public, max-age=60',
                        });
                        res.end(sr.body);
                        return;
                      }
                    } catch {
                      // fall through to full slicer
                    }
                  }
                }

                clearTimeout(timeoutId);
                const startByte = rangeMatch ? Number(rangeMatch[1]) : 0;
                if (startByte >= totalBytes) {
                  req.off('aborted', onEarlyClose);
                  res.off('close', onEarlyClose);
                  res.writeHead(416, {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Range': `bytes */${totalBytes}`,
                  });
                  res.end();
                  return;
                }
                const endByte =
                  rangeMatch && rangeMatch[2]
                    ? Math.min(Number(rangeMatch[2]), totalBytes - 1)
                    : totalBytes - 1;
                const responseLen = endByte - startByte + 1;

                const sliceRanges: Array<[number, number]> = [];
                let cur = startByte;
                // Fast 64KB initial chunk for instantaneous ftyp/moov start
                if (cur <= endByte) {
                  const firstEnd = Math.min(cur + 65536 - 1, endByte);
                  sliceRanges.push([cur, firstEnd]);
                  cur = firstEnd + 1;
                }
                const sliceStep = isTsSeg ? 262144 : 196608; // 256 KB for Live TV .ts segments, 192 KB otherwise
                while (cur <= endByte) {
                  sliceRanges.push([
                    cur,
                    Math.min(cur + sliceStep - 1, endByte),
                  ]);
                  cur += sliceStep;
                }

                const fetchSlice = async (
                  s: number,
                  e: number
                ): Promise<Buffer> => {
                  for (let attempt = 0; attempt < 2; attempt++) {
                    if (accelCtrl.signal.aborted) {
                      throw new Error('Client aborted');
                    }
                    try {
                      const sr = await fetchVkRangeHttp1(
                        resolvedMediaUrl,
                        s,
                        e,
                        {
                          'User-Agent': effectiveUa,
                          Referer: refererHeader,
                          Origin: originHeader,
                          Accept: '*/*',
                        },
                        9500,
                        accelCtrl.signal
                      );
                      if (
                        (sr.status === 200 || sr.status === 206) &&
                        sr.body.length === e - s + 1
                      ) {
                        return sr.body;
                      }
                    } catch {
                      if (accelCtrl.signal.aborted) {
                        throw new Error('Client aborted');
                      }
                      await new Promise((r) =>
                        setTimeout(r, 100 * (attempt + 1))
                      );
                    }
                  }
                  throw new Error('VK slice mismatch');
                };

                // Bounded multi-socket HTTP/1.1 sliding window
                const MAX_IN_FLIGHT = isTsSeg ? 18 : 14;
                const inflight = new Map<number, Promise<Buffer>>();
                let launchedIdx = 0;
                const scheduleAhead = (writeCursor: number) => {
                  while (
                    launchedIdx < sliceRanges.length &&
                    launchedIdx - writeCursor < MAX_IN_FLIGHT &&
                    !accelCtrl.signal.aborted
                  ) {
                    const idx = launchedIdx++;
                    const [s, e] = sliceRanges[idx];
                    const p = fetchSlice(s, e);
                    p.catch(() => { });
                    inflight.set(idx, p);
                  }
                };

                scheduleAhead(0);
                const firstPromise = inflight.get(0)!;
                const firstChunk = await firstPromise;
                inflight.delete(0);

                if (accelCtrl.signal.aborted || res.writableEnded || res.destroyed) {
                  return;
                }

                const use200Ok = !rangeMatch;
                res.writeHead(use200Ok ? 200 : 206, {
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Private-Network': 'true',
                  'Access-Control-Expose-Headers':
                    'Content-Length, Content-Range, Accept-Ranges, Content-Type',
                  'Content-Type': contentTypeOut,
                  ...(use200Ok
                    ? { 'Content-Length': String(responseLen) }
                    : {
                      'Content-Range': `bytes ${startByte}-${endByte}/${totalBytes}`,
                      'Content-Length': String(responseLen),
                    }),
                  'Accept-Ranges': 'bytes',
                  'Cache-Control': 'public, max-age=60',
                });

                const writeWithBackpressure = async (chunk: Buffer) => {
                  if (
                    accelCtrl.signal.aborted ||
                    res.writableEnded ||
                    res.destroyed
                  ) {
                    return false;
                  }
                  const ok = res.write(chunk);
                  if (!ok) {
                    await new Promise<void>((resolveDrain) => {
                      const onDone = () => {
                        res.off('drain', onDone);
                        res.off('close', onDone);
                        accelCtrl.signal.removeEventListener('abort', onDone);
                        resolveDrain();
                      };
                      res.once('drain', onDone);
                      res.once('close', onDone);
                      accelCtrl.signal.addEventListener('abort', onDone, {
                        once: true,
                      });
                    });
                  }
                  return true;
                };

                if (await writeWithBackpressure(firstChunk)) {
                  for (let i = 1; i < sliceRanges.length; i++) {
                    if (
                      accelCtrl.signal.aborted ||
                      res.writableEnded ||
                      res.destroyed
                    ) {
                      break;
                    }
                    scheduleAhead(i);
                    const nextP = inflight.get(i);
                    if (!nextP) break;
                    const chunk = await nextP;
                    inflight.delete(i);
                    if (!(await writeWithBackpressure(chunk))) {
                      break;
                    }
                  }
                }
                req.off('aborted', onEarlyClose);
                res.off('close', onEarlyClose);
                if (!res.writableEnded && !res.destroyed) {
                  res.end();
                }
                return;
              }
            } catch {
              accelCtrl.abort();
              if (res.headersSent || res.writableEnded || res.destroyed) {
                if (!res.writableEnded && !res.destroyed) {
                  res.destroy();
                }
                return;
              }
              // Fall back cleanly to standard single-stream proxy below
            } finally {
              req.off('aborted', onEarlyClose);
              res.off('close', onEarlyClose);
            }
          }

          const upstreamRes = await fetch(targetUrl, {
            method: req.method === 'HEAD' ? 'HEAD' : 'GET',
            headers: {
              'User-Agent': effectiveUa,
              Referer: refererHeader,
              Origin: originHeader,
              Accept: '*/*',
              ...(rangeHeader ? { Range: String(rangeHeader) } : {}),
              ...(activeCookie ? { Cookie: activeCookie } : {}),
            },
            redirect: 'follow',
            signal: controller.signal,
          });
          saveRadioResponseCookies(targetUrl, upstreamRes.headers);

          clearTimeout(timeoutId);

          if (!upstreamRes.ok) {
            res.writeHead(upstreamRes.status, {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'text/plain',
            });
            res.end(`Upstream error ${upstreamRes.status}`);
            return;
          }

          const finalUrl = upstreamRes.url || targetUrl;
          const contentType = (
            upstreamRes.headers.get('content-type') || ''
          ).toLowerCase();

          const isPls =
            contentType.includes('scpls') || /\.pls(\?|$)/i.test(finalUrl);
          const isM3u8 =
            contentType.includes('mpegurl') ||
            contentType.includes('m3u') ||
            /\.m3u8?(\?|$)/i.test(finalUrl);

          const extraParams = `${customRef ? `&ref=${encodeURIComponent(customRef)}` : ''
            }${effectiveUa ? `&ua=${encodeURIComponent(effectiveUa)}` : ''}${skipAd ? '&skipAd=1' : ''}${wantOrigAudio ? '&orig=1' : ''}`;

          const buildProxyUrl = (rawUri: string) => {
            try {
              const resolved = new URL(rawUri.trim(), finalUrl).toString();
              return `/api/tv-proxy?url=${encodeURIComponent(resolved)}${extraParams}`;
            } catch {
              return rawUri;
            }
          };

          if (rawMode && !isM3u8) {
            const text = await upstreamRes.text();
            res.writeHead(200, {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': contentType.includes('json')
                ? 'application/json; charset=utf-8'
                : 'text/plain; charset=utf-8',
              'Cache-Control': 'no-cache, no-store',
            });
            res.end(text);
            return;
          }

          if (isPls) {
            const text = await upstreamRes.text();
            const fileMatch = text.match(/^File\d+=(https?:\/\/[^\r\n]+)/im);
            if (fileMatch?.[1]) {
              res.writeHead(302, {
                'Access-Control-Allow-Origin': '*',
                Location: buildProxyUrl(fileMatch[1].trim()),
              });
              res.end();
              return;
            }
          }

          if (isM3u8) {
            let text = await upstreamRes.text();

            // Automatic HLS Radio Preroll Ad-Skipper:
            // If this is a radio HLS master playlist (e.g. hls-01-rusradio.hostingradio.ru/rusradio/playlist.m3u8)
            // or sub-playlist containing preroll ad segments (a0403699_*.ts), cycle the hlssid session 2x until clean l0_*.ts segments appear
            if (skipAd) {
              if (text.includes('#EXT-X-STREAM-INF')) {
                const subRel = text
                  .split(/\r?\n/)
                  .map((l) => l.trim())
                  .find((l) => l && !l.startsWith('#'));
                if (subRel) {
                  for (let cycle = 0; cycle < 3; cycle++) {
                    try {
                      const subUrl = new URL(subRel, finalUrl).toString();
                      const cHeader = getRadioCookieHeader(finalUrl);
                      const subCheck = await fetch(subUrl, {
                        headers: {
                          'User-Agent': effectiveUa,
                          ...(cHeader ? { Cookie: cHeader } : {}),
                        },
                      });
                      saveRadioResponseCookies(finalUrl, subCheck.headers);
                      const subTxt = await subCheck.text();
                      if (!/\ba\d+_[0-9a-f]+\.ts\b/i.test(subTxt)) {
                        break;
                      }
                      // Sub-playlist had preroll ad segments -> request a fresh master playlist with our cookie
                      const nextCookie = getRadioCookieHeader(finalUrl);
                      const nextMaster = await fetch(targetUrl, {
                        headers: {
                          'User-Agent': effectiveUa,
                          ...(nextCookie ? { Cookie: nextCookie } : {}),
                        },
                      });
                      saveRadioResponseCookies(finalUrl, nextMaster.headers);
                      if (nextMaster.ok) {
                        text = await nextMaster.text();
                      }
                    } catch {
                      break;
                    }
                  }
                }
              } else if (/\ba\d+_[0-9a-f]+\.ts\b/i.test(text)) {
                // Direct media playlist contains ad segments (a0..._*.ts): re-request parent master playlist to advance past preroll
                const masterUrl = finalUrl.replace(
                  /\/\d+\/playlist\.m3u8.*$/i,
                  '/playlist.m3u8'
                );
                for (let cycle = 0; cycle < 3; cycle++) {
                  try {
                    const cHeader = getRadioCookieHeader(finalUrl);
                    const mRes = await fetch(masterUrl, {
                      headers: {
                        'User-Agent': effectiveUa,
                        ...(cHeader ? { Cookie: cHeader } : {}),
                      },
                    });
                    saveRadioResponseCookies(finalUrl, mRes.headers);
                    const mTxt = await mRes.text();
                    const freshSubRel = mTxt
                      .split(/\r?\n/)
                      .map((l) => l.trim())
                      .find((l) => l && !l.startsWith('#'));
                    if (!freshSubRel) break;
                    const freshSubUrl = new URL(freshSubRel, masterUrl).toString();
                    const sRes = await fetch(freshSubUrl, {
                      headers: {
                        'User-Agent': effectiveUa,
                        ...(getRadioCookieHeader(finalUrl)
                          ? { Cookie: getRadioCookieHeader(finalUrl) }
                          : {}),
                      },
                    });
                    saveRadioResponseCookies(finalUrl, sRes.headers);
                    const sTxt = await sRes.text();
                    if (!/\ba\d+_[0-9a-f]+\.ts\b/i.test(sTxt)) {
                      text = sTxt;
                      break;
                    }
                  } catch {
                    break;
                  }
                }
              }
            }
            if (rawMode) {
              res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache, no-store',
              });
              res.end(text);
              return;
            }
            // If this is a simple Icecast/Shoutcast .m3u redirect file (no #EXT-X- HLS tags), redirect to the underlying audio stream
            if (!text.includes('#EXT-X-')) {
              const firstStreamLine = text
                .split(/\r?\n/)
                .map((l) => l.trim())
                .find((l) => /^https?:\/\//i.test(l));
              if (firstStreamLine && !/\.m3u8(\?|$)/i.test(firstStreamLine)) {
                res.writeHead(302, {
                  'Access-Control-Allow-Origin': '*',
                  Location: buildProxyUrl(firstStreamLine),
                });
                res.end();
                return;
              }
            }
            const hasSegmentOrVariant = (m3uText: string) =>
              m3uText
                .split(/\r?\n/)
                .some((l) => {
                  const t = l.trim();
                  return (t && !t.startsWith('#')) || /URI="[^"]+"/i.test(t);
                });
            if (text.includes('#EXT-X-') && !hasSegmentOrVariant(text)) {
              await new Promise((r) => setTimeout(r, 450));
              try {
                const retryRes = await fetch(targetUrl, {
                  method: 'GET',
                  headers: {
                    'User-Agent': effectiveUa,
                    Referer: refererHeader,
                    Origin: originHeader,
                    Accept: '*/*',
                  },
                  redirect: 'follow',
                });
                if (retryRes.ok) {
                  text = await retryRes.text();
                }
              } catch {
                // ignore retry error
              }
              if (!hasSegmentOrVariant(text)) {
                res.writeHead(503, {
                  'Access-Control-Allow-Origin': '*',
                  'Content-Type': 'text/plain; charset=utf-8',
                  'Cache-Control': 'no-cache, no-store',
                });
                res.end('Upstream HLS playlist has 0 active segments');
                return;
              }
            }
            const rawLines = text.split(/\r?\n/);
            const filteredLines: string[] = [];
            let skipNextUriLine = false;
            for (const line of rawLines) {
              const trimmed = line.trim();
              if (skipNextUriLine && trimmed && !trimmed.startsWith('#')) {
                skipNextUriLine = false;
                continue;
              }
              if (
                trimmed.startsWith('#EXT-X-MEDIA:') &&
                (trimmed.includes('GROUP-ID="failover-') ||
                  /TYPE=(SUBTITLES|CLOSED-CAPTIONS)/i.test(trimmed))
              ) {
                continue;
              }
              if (
                trimmed.startsWith('#EXT-X-STREAM-INF:') &&
                trimmed.includes('AUDIO="failover-')
              ) {
                skipNextUriLine = true;
                continue;
              }
              filteredLines.push(line);
            }
            const isOriginalHlsAudioMediaLine = (l: string): boolean => {
              const t = l.trim();
              if (!t.startsWith('#EXT-X-MEDIA:') || !/TYPE=AUDIO/i.test(t)) {
                return false;
              }
              if (/русский\s*\/\s*original/i.test(t)) return false;
              if (
                /LANGUAGE="(?:en|eng|fr|fra|fre|es|spa|de|deu|ger|it|ita|pt|por|ko|kor|ja|jpn|tr|tur|ro|ron|rum|zh|chi|zho|pl|pol|sv|swe|da|dan|no|nor|fi|fin|nl|nld|dut|cs|ces|cze|hu|hun|el|ell|gre|hi|hin|ar|ara|th|tha)(?:-[a-z0-9]+)?"/i.test(
                  t
                )
              ) {
                return true;
              }
              return /NAME="[^"]*(?:\beng|\borig|\benglish|\boriginal|\bv\.?o\.?|\bfra|\bfre|\bspa|\bdeu|\bger|\bita|\bpor|\bkor|\bjpn|\btur|\bron|\brum|оригинал|француз|испанск|немецк|итальян|португал|корейск|японск|турецк|китайск|польск|шведск|датск|норвеж|румынск|субтитр)[^"]*"/i.test(
                t
              );
            };
            const audioLinesCount = filteredLines.filter(
              (l) =>
                l.trim().startsWith('#EXT-X-MEDIA:') && /TYPE=AUDIO/i.test(l)
            ).length;
            const useExplicitAudioIdx =
              !wantOrigAudio && requestedAudioIdx >= 0 && requestedAudioIdx < audioLinesCount;
            const hasOriginalAudioTrack = filteredLines.some(
              isOriginalHlsAudioMediaLine
            );
            let promotedOriginalAudio = false;
            let currentAudioLineIdx = 0;
            const rewrittenLines = filteredLines.map((line) => {
              let currentLine = line;
              const trimmed = currentLine.trim();
              if (!trimmed) return currentLine;
              if (
                (useExplicitAudioIdx || hasOriginalAudioTrack) &&
                trimmed.startsWith('#EXT-X-MEDIA:') &&
                /TYPE=AUDIO/i.test(trimmed)
              ) {
                const thisAudioIdx = currentAudioLineIdx++;
                const shouldPromote = useExplicitAudioIdx
                  ? thisAudioIdx === requestedAudioIdx
                  : !promotedOriginalAudio &&
                  isOriginalHlsAudioMediaLine(trimmed);
                if (shouldPromote) {
                  promotedOriginalAudio = true;
                  currentLine = currentLine
                    .replace(/DEFAULT=NO/gi, 'DEFAULT=YES')
                    .replace(/AUTOSELECT=NO/gi, 'AUTOSELECT=YES');
                } else {
                  currentLine = currentLine
                    .replace(/DEFAULT=YES/gi, 'DEFAULT=NO')
                    .replace(/AUTOSELECT=YES/gi, 'AUTOSELECT=NO');
                }
              }
              if (trimmed.startsWith('#EXT-X-STREAM-INF:')) {
                currentLine = currentLine
                  .replace(/,?\s*SUBTITLES="[^"]*"/gi, '')
                  .replace(/,?\s*CLOSED-CAPTIONS="[^"]*"/gi, '');
              }
              if (trimmed.startsWith('#')) {
                return currentLine.replace(/URI="([^"]+)"/gi, (_m, uri) => {
                  return `URI="${buildProxyUrl(uri)}"`;
                });
              }
              return buildProxyUrl(trimmed);
            });

            let rewritten = rewrittenLines.join('\n');
            if (
              rewrittenLines.some((l) =>
                l.trim().startsWith('#EXT-X-STREAM-INF:')
              )
            ) {
              const headerLines: string[] = [];
              const variantPairs: Array<{
                infLine: string;
                uriLine: string;
                height: number;
                bandwidth: number;
              }> = [];
              for (let i = 0; i < rewrittenLines.length; i++) {
                const ln = rewrittenLines[i];
                const tr = ln.trim();
                if (tr.startsWith('#EXT-X-STREAM-INF:')) {
                  let uriLine = '';
                  while (i + 1 < rewrittenLines.length) {
                    const nextLn = rewrittenLines[i + 1];
                    const nextTr = nextLn.trim();
                    i++;
                    if (!nextTr) continue;
                    uriLine = nextLn;
                    break;
                  }
                  if (uriLine) {
                    const resMatch = tr.match(/RESOLUTION=(\d+)x(\d+)/i);
                    const bwMatch = tr.match(/(?:^|,)BANDWIDTH=(\d+)/i);
                    const w = resMatch ? Number(resMatch[1]) : 0;
                    const h = resMatch ? Number(resMatch[2]) : 0;
                    const width = w && h ? Math.max(w, h) : w;
                    const height = w && h ? Math.min(w, h) : h;
                    const bandwidth = bwMatch ? Number(bwMatch[1]) : 0;
                    variantPairs.push({
                      infLine: ln,
                      uriLine,
                      width,
                      height,
                      bandwidth,
                    });
                  } else {
                    headerLines.push(ln);
                  }
                } else {
                  headerLines.push(ln);
                }
              }
              if (variantPairs.length > 1) {
                variantPairs.sort(
                  (a, b) => b.height - a.height || b.bandwidth - a.bandwidth
                );
                const hdVariants = variantPairs.filter(
                  (p) => p.height >= 720 || p.width >= 1200
                );
                const selectedVariants = keepAllQualities
                  ? variantPairs
                  : hdVariants.length > 0
                    ? hdVariants
                    : [variantPairs[0]];
                rewritten = [
                  ...headerLines,
                  ...selectedVariants.flatMap((p) => [p.infLine, p.uriLine]),
                ].join('\n');
              }
            }

            if (/\/iptv\/[^/]+\/6997\/index\.m3u8/i.test(finalUrl) && ffmpegPath) {
              const segUrls = rawLines
                .map((l) => l.trim())
                .filter((l) => l && !l.startsWith('#'))
                .map((l) => {
                  try {
                    return new URL(l, finalUrl).toString();
                  } catch {
                    return '';
                  }
                })
                .filter((u) => /^https?:\/\//i.test(u));
              if (segUrls.length > 0) {
                const warmSegUrl = segUrls[Math.max(0, segUrls.length - 3)];
                if (
                  !transcodedTsCache.has(warmSegUrl) &&
                  !transcodedTsInFlight.has(warmSegUrl)
                ) {
                  const localPort = req.socket?.localPort || 8769;
                  fetch(
                    `http://127.0.0.1:${localPort}/api/tv-proxy?url=${encodeURIComponent(warmSegUrl)}`
                  ).catch(() => { });
                }
              }
            }

            res.writeHead(200, {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Private-Network': 'true',
              'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
              'Cache-Control': 'no-cache, no-store',
            });
            res.end(rewritten);
            return;
          }

          const isVideoTsSegment =
            /\.(ts|m4s|mp4|aac)(\?|$)/i.test(finalUrl) ||
            contentType.includes('mp2t') ||
            contentType.includes('video/');
          const isLiveAudioStream =
            !isVideoTsSegment &&
            (contentType.startsWith('audio/') ||
              contentType.includes('aac') ||
              contentType.includes('mpeg') ||
              contentType.includes('ogg') ||
              contentType.includes('octet-stream'));

          const outHeaders: Record<string, string> = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers':
              'Content-Length, Content-Range, Accept-Ranges, Content-Type',
            'Content-Type': sanitizeDevProxyContentType(
              upstreamRes.headers.get('content-type'),
              isLiveAudioStream ? 'audio/mpeg' : 'video/mp2t'
            ),
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': 'sandbox',
            'Cache-Control': isLiveAudioStream
              ? 'no-cache, no-store'
              : 'public, max-age=10',
          };
          const upstreamLen = upstreamRes.headers.get('content-length');
          const upstreamRange = upstreamRes.headers.get('content-range');
          const upstreamAcceptRanges = upstreamRes.headers.get('accept-ranges');
          if (upstreamLen && !isLiveAudioStream) {
            outHeaders['Content-Length'] = upstreamLen;
          }
          if (upstreamRange) {
            outHeaders['Content-Range'] = upstreamRange;
          }
          if (upstreamAcceptRanges) {
            outHeaders['Accept-Ranges'] = upstreamAcceptRanges;
          } else if (isVideoTsSegment) {
            outHeaders['Accept-Ranges'] = 'bytes';
          }
          if (isLiveAudioStream) {
            outHeaders['Connection'] = 'keep-alive';
          }

          if (req.method === 'HEAD' || !upstreamRes.body) {
            res.writeHead(upstreamRes.status, outHeaders);
            res.end();
            return;
          }

          res.writeHead(upstreamRes.status, outHeaders);
          const reader = upstreamRes.body.getReader();
          let streamCompleted = false;
          const onClientAbort = () => {
            if (!streamCompleted) {
              reader.cancel().catch(() => { });
              controller.abort();
            }
          };
          req.on('aborted', onClientAbort);
          res.on('close', onClientAbort);
          try {
            while (true) {
              let chunkTimer: ReturnType<typeof setTimeout> | null = null;
              const readPromise = reader.read();
              const result = isLiveAudioStream
                ? await readPromise
                : await Promise.race([
                    readPromise,
                    new Promise<{ done: true; value: undefined }>((_, reject) => {
                      chunkTimer = setTimeout(() => {
                        reader.cancel().catch(() => { });
                        controller.abort();
                        reject(new Error('Upstream chunk read idle timeout'));
                      }, 15_000);
                    }),
                  ]);
              if (chunkTimer) clearTimeout(chunkTimer);
              const { done, value } = result;
              if (done || res.writableEnded || res.destroyed) {
                streamCompleted = true;
                break;
              }
              if (value && value.byteLength > 0) {
                const canContinue = res.write(Buffer.from(value));
                if (!canContinue && !res.writableEnded && !res.destroyed) {
                  await new Promise<void>((resolve) => {
                    const doneWait = () => {
                      res.off('drain', doneWait);
                      res.off('close', doneWait);
                      resolve();
                    };
                    res.once('drain', doneWait);
                    res.once('close', doneWait);
                  });
                }
              }
            }
          } catch {
            // client closed connection or upstream ended
          } finally {
            streamCompleted = true;
            req.off('aborted', onClientAbort);
            res.off('close', onClientAbort);
            if (!res.writableEnded) res.end();
          }
        } catch (err) {
          if (!res.headersSent) {
            res.writeHead(502, {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'text/plain',
            });
          }
          res.end(
            `Proxy error: ${err instanceof Error ? err.message : 'Unknown'}`
          );
        }
      });

      server.middlewares.use('/api/iedem-vod', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': '*',
          });
          res.end();
          return;
        }
        try {
          const reqUrl = new URL(req.url || '', 'http://localhost');
          const posterUrl = reqUrl.searchParams.get('poster');
          if (posterUrl && /^https?:\/\//i.test(posterUrl)) {
            const imgRes = await fetchSafeDevExternalUrl(posterUrl, {
              signal: AbortSignal.timeout(8000),
            });
            if (!imgRes.ok) {
              res.writeHead(imgRes.status);
              res.end('Not found');
              return;
            }
            const baseCt = String(imgRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
            if (!baseCt.startsWith('image/') || baseCt === 'image/svg+xml') {
              res.writeHead(415, { 'Access-Control-Allow-Origin': '*' });
              res.end('Unsupported poster content type');
              return;
            }
            const buf = Buffer.from(await imgRes.arrayBuffer());
            res.writeHead(200, {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': baseCt,
              'X-Content-Type-Options': 'nosniff',
              'Content-Security-Policy': 'sandbox',
              'Cache-Control': 'public, max-age=604800',
            });
            res.end(buf);
            return;
          }

          const payload: Record<string, unknown> = {
            key: 'b55f67862ee6fe7-798a6b713ccb40d',
          };
          for (const [k, v] of reqUrl.searchParams.entries()) {
            if (k === 'poster') continue;
            if (k === 'fid' || k === 'offset' || k === 'limit' || k === 'genre' || k === 'vc') {
              payload[k] = Number(v);
            } else {
              payload[k] = v;
            }
          }

          const upstream = await fetch('http://895890bd73a7.jmeekos.com/api/v1/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'OTT-Play/1.0',
            },
            body: JSON.stringify(payload),
          });
          const text = await upstream.text();
          res.writeHead(upstream.status, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json; charset=utf-8',
          });
          res.end(text);
        } catch (err) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'iEdem VOD error',
            })
          );
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tvStreamProxyPlugin()],
  server: {
    host: true,
    port: 8769,
    strictPort: true,
    allowedHosts: true,
    watch: {
      ignored: [
        '**/.tv-*.json',
        '**/.tv-*.tmp',
        '**/.music-sync-*.json',
        '**/.music-sync-*.tmp',
        '**/*.tmp',
        '**/.filelist*/**',
        '**/.tmp*/**',
        '**/.chrome*/**',
        '**/dist/**',
      ],
    },
  },
  esbuild: {
    target: 'es2015',
  },
  build: {
    target: ['es2015', 'chrome58', 'safari11'],
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
  },
});

import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
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

      server.middlewares.use((req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
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
          /Web0S|WebOS|NetCast|SmartTV|Tizen|Large Screen|MSX/i.test(
            req.headers['user-agent'] || ''
          );

        if (isLanTvClient && !rawUrl.startsWith('/api/') && !rawUrl.startsWith('/msx/')) {
          const distDir = path.resolve(process.cwd(), 'dist');
          if (rawUrl === '/sw.js') {
            res.writeHead(200, {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/javascript; charset=utf-8',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            });
            res.end(
              "self.addEventListener('install',function(){self.skipWaiting()});self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.map(function(n){return caches.delete(n)}))}).then(function(){return self.registration.unregister()}))});"
            );
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
              res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Private-Network': 'true',
                'Cross-Origin-Resource-Policy': 'cross-origin',
                'Content-Type': mime,
                'Cache-Control': 'no-store, no-cache, must-revalidate',
              });
              res.end(fs.readFileSync(assetFile));
              return;
            }
          } else if (rawUrl === '/' || rawUrl === '/tv' || rawUrl.startsWith('/tv/') || rawUrl === '/index.html') {
            const distIndex = path.join(distDir, 'index.html');
            if (fs.existsSync(distIndex)) {
              const ver = Math.floor(fs.statSync(distIndex).mtimeMs);
              const rawHtml = fs.readFileSync(distIndex, 'utf-8');
              const freshHtml = rawHtml.replace(
                /(\/assets\/[^"'\s>]+\.(?:js|css))/g,
                `$1?v=${ver}`
              );
              console.log(`[LAN-TV] Serving compiled ES2015 bundle (v=${ver}) to ${hostHeader}${req.url} (${req.headers['user-agent'] || ''})`);
              res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Referrer-Policy': 'no-referrer',
              });
              res.end(freshHtml);
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
            (!cleanV.episodeProgressMap ||
              Object.keys(cleanV.episodeProgressMap).length === 0);
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
          if ((cleanV.updatedAt || 0) >= (prev.updatedAt || 0)) {
            merged[k] = {
              ...prev,
              ...cleanV,
              episodeProgressMap: mergedEpMap,
            };
          } else {
            merged[k] = {
              ...cleanV,
              ...prev,
              episodeProgressMap: mergedEpMap,
            };
          }
        }
        return merged;
      };

      let lastCloudSyncAtByProf: Record<string, number> = {};
      const syncProfileProgressWithCloud = async (
        profileId: string,
        forcePush = false
      ) => {
        const cleanId = (profileId || 'p1').replace(/[^a-zA-Z0-9_-]/g, '') || 'p1';
        const now = Date.now();
        if (!forcePush && now - (lastCloudSyncAtByProf[cleanId] || 0) < 12000) {
          return;
        }
        lastCloudSyncAtByProf[cleanId] = now;
        try {
          const targetFile = getTvProgressFileForProfile(cleanId);
          const localData = fs.existsSync(targetFile)
            ? JSON.parse(fs.readFileSync(targetFile, 'utf-8') || '{}')
            : {};
          const res = await fetch(
            `https://filmio.my/api/tv-progress?profileId=${encodeURIComponent(cleanId)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(localData),
            }
          );
          if (res.ok) {
            const cloudMerged = (await res.json()) as Record<string, any>;
            if (cloudMerged && typeof cloudMerged === 'object') {
              const finalMerged = mergeProgressEntriesMap(localData, cloudMerged);
              fs.writeFileSync(
                targetFile,
                JSON.stringify(finalMerged),
                'utf-8'
              );
            }
          }
        } catch {
          // ignore network errors when offline
        }
      };

      // Background bidirectional sync between local disk (.tv-watch-progress.json) and cloud (https://filmio.my)
      setInterval(() => {
        void syncProfileProgressWithCloud('p1', false);
      }, 25000);
      setTimeout(() => {
        void syncProfileProgressWithCloud('p1', true);
      }, 2500);

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
              fs.writeFileSync(
                targetProgressFile,
                JSON.stringify(current),
                'utf-8'
              );
            } catch {
              // ignore
            }
            fetch(
              `https://filmio.my/api/tv-progress?profileId=${encodeURIComponent(
                profileId
              )}&deleteId=${encodeURIComponent(deleteId)}`,
              { method: 'DELETE' }
            ).catch(() => {});
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
              const merged = mergeProgressEntriesMap(current, incoming);
              fs.writeFileSync(
                targetProgressFile,
                JSON.stringify(merged),
                'utf-8'
              );
              void syncProfileProgressWithCloud(profileId, true);
              res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-cache, no-store',
              });
              res.end(JSON.stringify(merged));
            } catch {
              res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
              });
              res.end(JSON.stringify(readDiskProgress()));
            }
          });
          return;
        }
        void syncProfileProgressWithCloud(profileId, false);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache, no-store',
        });
        res.end(JSON.stringify(readDiskProgress()));
      });

      const getTvSavedFileForProfile = (profileId: string) => {
        const cleanId = (profileId || 'p1').replace(/[^a-zA-Z0-9_-]/g, '') || 'p1';
        return path.resolve(__dirname, `.tv-saved-${cleanId}.json`);
      };

      server.middlewares.use('/api/tv-saved', (req, res) => {
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
        const targetSavedFile = getTvSavedFileForProfile(profileId);

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
            try {
              const incoming = JSON.parse(body || '[]');
              if (Array.isArray(incoming)) {
                fs.writeFileSync(
                  targetSavedFile,
                  JSON.stringify(incoming),
                  'utf-8'
                );
                fetch(
                  `https://filmio.my/api/tv-saved?profileId=${encodeURIComponent(
                    profileId
                  )}`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(incoming),
                  }
                ).catch(() => {});
              }
            } catch {
              // ignore
            }
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-cache, no-store',
            });
            res.end(JSON.stringify(readDiskSaved()));
          });
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache, no-store',
        });
        res.end(JSON.stringify(readDiskSaved()));
      });

      const tvProfilesFile = path.resolve(__dirname, '.tv-profiles.json');
      server.middlewares.use('/api/tv-profiles', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, X-Deleted-Profile-Ids'
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
                      parsedDel.filter((x) => typeof x === 'string')
                    );
                  }
                } catch {
                  // ignore
                }
                const existing = readProfiles() || [];
                const byId = new Map<string, Record<string, unknown>>();
                for (const p of existing) {
                  const id = typeof p?.id === 'string' ? p.id : '';
                  if (id && !deletedIds.has(id)) {
                    byId.set(id, p);
                  }
                }
                for (const p of incoming) {
                  const id = typeof p?.id === 'string' ? p.id : '';
                  if (!id || deletedIds.has(id)) continue;
                  const prev = byId.get(id);
                  const prevTs =
                    typeof prev?.updatedAt === 'number' ? prev.updatedAt : 0;
                  const nextTs =
                    typeof p?.updatedAt === 'number' ? p.updatedAt : 0;
                  if (!prev || nextTs >= prevTs) {
                    byId.set(id, p);
                  }
                }
                const merged = Array.from(byId.values());
                if (merged.length > 0) {
                  fs.writeFileSync(
                    tvProfilesFile,
                    JSON.stringify(merged),
                    'utf-8'
                  );
                  fetch('https://filmio.my/api/tv-profiles', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Deleted-Profile-Ids': deletedHeader,
                    },
                    body: JSON.stringify(merged),
                  }).catch(() => {});
                }
              }
            } catch {
              // ignore
            }
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-cache, no-store',
            });
            res.end(JSON.stringify(readProfiles()));
          });
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache, no-store',
        });
        res.end(JSON.stringify(readProfiles()));
      });

      // FileList.io Live Torrent Catalog, Resolver & Remux Streaming Engine
      server.middlewares.use(async (req, res, next) => {
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
            proc.on('error', () => {
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

          if (!rawTitle && streamUrl && /^https?:\/\//i.test(streamUrl)) {
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
          const season = Number(reqUrl.searchParams.get('season')) || 1;
          const episode = Number(reqUrl.searchParams.get('episode')) || 1;
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
                  : 'https://api.namy.ws/';
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

      server.middlewares.use('/api/tv-proxy', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
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
                const warmRes = await fetch(targetUrl, {
                  method: 'GET',
                  headers: {
                    'User-Agent': effectiveUa,
                    Referer: refererHeader,
                    Origin: originHeader,
                    Accept: '*/*',
                    ...(warmCookie ? { Cookie: warmCookie } : {}),
                  },
                  redirect: 'follow',
                  signal: warmCtrl.signal,
                });
                saveRadioResponseCookies(targetUrl, warmRes.headers);
                if (warmRes.body) {
                  const warmReader = warmRes.body.getReader();
                  await warmReader.read().catch(() => {});
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
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          const activeCookie = getRadioCookieHeader(targetUrl);
          const rangeHeader = req.headers.range;

          // VK / OK CDN Parallel Byte-Range Accelerator:
          // vkuser.net / okcdn.ru throttles each individual HTTP connection (zs=65) to ~220 KB/s (1.76 Mbps),
          // causing 1080p/4K streams (3.3–8 Mbps) to stall every ~20s. Clamped parallel Range slices boost throughput to 20–30 Mbps.
          const isVkThrottledBinary =
            req.method === 'GET' &&
            !rawMode &&
            /(vkuser\.net|okcdn\.ru|mycdn\.me|vkuservideo\.net)/i.test(targetUrl) &&
            !/\.(m3u8?|pls)(\?|$)/i.test(parsedTarget.pathname) &&
            !/\/video\/?$/i.test(parsedTarget.pathname);

          if (isVkThrottledBinary) {
            const accelCtrl = new AbortController();
            const onEarlyClose = () => {
              if (!res.writableEnded) accelCtrl.abort();
            };
            res.on('close', onEarlyClose);
            try {
              const headTimer = setTimeout(() => accelCtrl.abort(), 5000);
              const headRes = await fetch(targetUrl, {
                method: 'HEAD',
                headers: {
                  'User-Agent': effectiveUa,
                  Referer: refererHeader,
                  Origin: originHeader,
                  Accept: '*/*',
                },
                redirect: 'follow',
                signal: accelCtrl.signal,
              });
              clearTimeout(headTimer);

              const headCt = (
                headRes.headers.get('content-type') || ''
              ).toLowerCase();
              const totalBytes = Number(
                headRes.headers.get('content-length') || 0
              );

              if (
                headRes.ok &&
                totalBytes > 0 &&
                !headCt.includes('mpegurl') &&
                !headCt.includes('m3u')
              ) {
                const resolvedMediaUrl = headRes.url || targetUrl;
                const isTsSeg =
                  /\.(ts|m4s|aac)(\?|$)/i.test(parsedTarget.pathname) ||
                  headCt.includes('mp2t');
                const rangeMatch = String(rangeHeader || '').match(
                  /bytes=(\d+)-(\d*)/i
                );

                if (isTsSeg && !rangeMatch && totalBytes <= 25 * 1024 * 1024) {
                  const sliceSize = 262144; // 256 KB
                  const slices: Array<[number, number]> = [];
                  for (let s = 0; s < totalBytes; s += sliceSize) {
                    slices.push([s, Math.min(s + sliceSize - 1, totalBytes - 1)]);
                  }
                  const fetchSlice = async (
                    s: number,
                    e: number
                  ): Promise<Buffer> => {
                    for (let attempt = 0; attempt < 2; attempt++) {
                      const sr = await fetch(resolvedMediaUrl, {
                        method: 'GET',
                        headers: {
                          'User-Agent': effectiveUa,
                          Referer: refererHeader,
                          Origin: originHeader,
                          Accept: '*/*',
                          Range: `bytes=${s}-${e}`,
                        },
                        redirect: 'follow',
                        signal: accelCtrl.signal,
                      });
                      if (sr.ok || sr.status === 206) {
                        const buf = Buffer.from(await sr.arrayBuffer());
                        if (buf.length === e - s + 1) return buf;
                      }
                    }
                    throw new Error('VK TS slice mismatch');
                  };

                  const maxConc = 8;
                  const outBufs: Buffer[] = new Array(slices.length);
                  for (let i = 0; i < slices.length; i += maxConc) {
                    const batch = slices.slice(i, i + maxConc);
                    const batchRes = await Promise.all(
                      batch.map(([s, e]) => fetchSlice(s, e))
                    );
                    batchRes.forEach((b, idx) => {
                      outBufs[i + idx] = b;
                    });
                  }
                  const fullSeg = Buffer.concat(outBufs);
                  res.off('close', onEarlyClose);
                  res.writeHead(200, {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Expose-Headers':
                      'Content-Length, Content-Type, Accept-Ranges',
                    'Content-Type': headCt || 'video/mp2t',
                    'Content-Length': String(fullSeg.length),
                    'Accept-Ranges': 'bytes',
                    'Cache-Control': 'public, max-age=60',
                  });
                  res.end(fullSeg);
                  return;
                }

                // Progressive MP4 / WebM or explicit byte-range request: serve 206 Partial Content up to 4 MB window via parallel 512 KB slices
                const maxWindow = 4 * 1024 * 1024; // 4 MB
                const startByte = rangeMatch ? Number(rangeMatch[1]) : 0;
                if (startByte >= totalBytes) {
                  res.off('close', onEarlyClose);
                  res.writeHead(416, {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Range': `bytes */${totalBytes}`,
                  });
                  res.end();
                  return;
                }
                const requestedEnd =
                  rangeMatch && rangeMatch[2]
                    ? Number(rangeMatch[2])
                    : startByte + maxWindow - 1;
                const endByte = Math.min(
                  requestedEnd,
                  startByte + maxWindow - 1,
                  totalBytes - 1
                );
                const sliceSize = 524288; // 512 KB
                const slices: Array<[number, number]> = [];
                for (let s = startByte; s <= endByte; s += sliceSize) {
                  slices.push([s, Math.min(s + sliceSize - 1, endByte)]);
                }
                const fetchMp4Slice = async (
                  s: number,
                  e: number
                ): Promise<Buffer> => {
                  for (let attempt = 0; attempt < 2; attempt++) {
                    const sr = await fetch(resolvedMediaUrl, {
                      method: 'GET',
                      headers: {
                        'User-Agent': effectiveUa,
                        Referer: refererHeader,
                        Origin: originHeader,
                        Accept: '*/*',
                        Range: `bytes=${s}-${e}`,
                      },
                      redirect: 'follow',
                      signal: accelCtrl.signal,
                    });
                    if (sr.ok || sr.status === 206) {
                      const buf = Buffer.from(await sr.arrayBuffer());
                      if (buf.length === e - s + 1) return buf;
                    }
                  }
                  throw new Error('VK MP4 slice mismatch');
                };
                const maxConc = 8;
                const outBufs: Buffer[] = new Array(slices.length);
                for (let i = 0; i < slices.length; i += maxConc) {
                  const batch = slices.slice(i, i + maxConc);
                  const batchRes = await Promise.all(
                    batch.map(([s, e]) => fetchMp4Slice(s, e))
                  );
                  batchRes.forEach((b, idx) => {
                    outBufs[i + idx] = b;
                  });
                }
                const windowBuf = Buffer.concat(outBufs);
                res.off('close', onEarlyClose);
                res.writeHead(206, {
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Expose-Headers':
                    'Content-Length, Content-Range, Accept-Ranges, Content-Type',
                  'Content-Type': headCt || 'video/mp4',
                  'Content-Range': `bytes ${startByte}-${endByte}/${totalBytes}`,
                  'Content-Length': String(windowBuf.length),
                  'Accept-Ranges': 'bytes',
                  'Cache-Control': 'public, max-age=60',
                });
                res.end(windowBuf);
                return;
              }
            } catch {
              // Fall back cleanly to standard single-stream proxy below
            } finally {
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
            }${effectiveUa ? `&ua=${encodeURIComponent(effectiveUa)}` : ''}${skipAd ? '&skipAd=1' : ''}`;

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
            const audioLinesCount = filteredLines.filter(
              (l) =>
                l.trim().startsWith('#EXT-X-MEDIA:') && /TYPE=AUDIO/i.test(l)
            ).length;
            const useExplicitAudioIdx =
              requestedAudioIdx >= 0 && requestedAudioIdx < audioLinesCount;
            const hasOriginalAudioTrack = filteredLines.some(
              (l) =>
                l.trim().startsWith('#EXT-X-MEDIA:') &&
                /TYPE=AUDIO/i.test(l) &&
                (/LANGUAGE="en"/i.test(l) ||
                  /NAME="[^"]*(?:eng|orig)[^"]*"/i.test(l))
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
                    (/LANGUAGE="en"/i.test(trimmed) ||
                      /NAME="[^"]*(?:eng|orig)[^"]*"/i.test(trimmed));
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
                    const height = w && h ? Math.min(w, h) : h;
                    const bandwidth = bwMatch ? Number(bwMatch[1]) : 0;
                    variantPairs.push({
                      infLine: ln,
                      uriLine,
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
                rewritten = [
                  ...headerLines,
                  ...variantPairs.flatMap((p) => [p.infLine, p.uriLine]),
                ].join('\n');
              }
            }

            res.writeHead(200, {
              'Access-Control-Allow-Origin': '*',
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
            'Content-Type':
              upstreamRes.headers.get('content-type') ||
              (isLiveAudioStream ? 'audio/mpeg' : 'video/mp2t'),
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
              const { done, value } = await reader.read();
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
            const imgRes = await fetch(posterUrl);
            if (!imgRes.ok) {
              res.writeHead(imgRes.status);
              res.end('Not found');
              return;
            }
            const buf = Buffer.from(await imgRes.arrayBuffer());
            res.writeHead(200, {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': imgRes.headers.get('content-type') || 'image/jpeg',
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

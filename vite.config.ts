import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import zlib from 'node:zlib';

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
const EPG_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function normalizeEpgKey(raw: string, stripGenericWords = false): string {
  let s = (raw || '')
    .toLowerCase()
    .split('/')[0]
    .replace(/\.(ro|ru|md|uk|gb|us|de|fr|it|es|ua|by|kz)(@\w+)?$/i, '')
    .replace(/\(\s*(1080[pi]?|720[pi]?|576[pi]?|480[pi]?|4k|uhd|hd|sd|russia|romania|moldova|\d+)\s*\)/gi, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(hd|fhd|uhd|4k|sd|live|orig|50fps|romania|russia)\b/gi, ' ');

  if (stripGenericWords) {
    s = s.replace(/\b(tv|тв|канал|channel|телеканал)\b/gi, ' ');
  }

  return s.replace(/[^a-z0-9а-яё+]+/gi, '').trim();
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
  epgFeedCache.set(feedUrl, parsed);
  return parsed;
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
    const res = await fetch(streamUrl, {
      headers: {
        'Icy-MetaData': '1',
        'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
        Connection: 'close',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

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
    /^(?:rmc|rmc hits|rmc 80|rmc 90|radio monte carlo.*|virgin radio.*|radio 105.*|r101.*|autopromo.*|promo.*|spot.*|jingle.*|liner.*|sigla.*|notiziario.*|meteo.*|oroscopo.*|traffico.*|commercial.*|publicitate.*|reclama.*)$/i.test(
      s
    )
  ) {
    return true;
  }
  const normStation = stationName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normVal = s.replace(/[^a-z0-9]/g, '');
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
    /^(unknown|stream|offline|live|on air|reclama|publicitate|commercial|jingle|spot|реклама|новости)$/i.test(
      s
    )
  ) {
    return true;
  }
  if (
    /\b(publicitate|reclama|commercial break|рекламная пауза|реклама)\b/i.test(s)
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
          if (!hasAuthoritativeArtistAndTitle) {
            artist = matchedItem.artist?.name || artist;
            title = matchedItem.title || title;
          }
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
              if (!hasAuthoritativeArtistAndTitle) {
                artist = matchedItem.artistName || artist;
                title = matchedItem.trackName || title;
              }
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
    configureServer(server) {
      server.middlewares.use('/api/radio-meta', async (req, res) => {
        try {
          const reqUrl = new URL(req.url || '', 'http://localhost');
          const streamUrl = reqUrl.searchParams.get('url') || '';
          const stationName = reqUrl.searchParams.get('name') || '';
          let rawTitle = (reqUrl.searchParams.get('rawTitle') || '').trim();

          if (!rawTitle && streamUrl && /^https?:\/\//i.test(streamUrl)) {
            const icyTitle = await readIcyStreamTitle(streamUrl);
            if (icyTitle) {
              rawTitle = icyTitle;
            } else {
              const icecastTitle = await readIcecastStatusTitle(streamUrl);
              if (icecastTitle) {
                rawTitle = icecastTitle;
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
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache',
          });
          res.end(JSON.stringify({ track: rich }));
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
        try {
          const reqUrl = new URL(req.url || '', 'http://localhost');
          const kp = reqUrl.searchParams.get('kp') || '';
          const imdb = reqUrl.searchParams.get('imdb') || '';
          const season = Number(reqUrl.searchParams.get('season')) || 1;
          const episode = Number(reqUrl.searchParams.get('episode')) || 1;
          // @ts-expect-error .mjs dynamic import
          const mod = await import('./netlify/functions/vod-stream.mjs');
          const result = await mod.resolveVodStreamData({
            kp,
            imdb,
            season,
            episode,
          });
          res.writeHead(result.ok ? 200 : 404, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache',
          });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, {
            'Access-Control-Allow-Origin': '*',
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
          const targetUrl = reqUrl.searchParams.get('url');
          const customRef = reqUrl.searchParams.get('ref') || '';
          const customUa = reqUrl.searchParams.get('ua') || '';
          const rawMode = reqUrl.searchParams.get('raw') === '1';

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

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          const upstreamRes = await fetch(targetUrl, {
            method: 'GET',
            headers: {
              'User-Agent':
                customUa ||
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
              Referer: refererHeader,
              Origin: originHeader,
              Accept: '*/*',
            },
            redirect: 'follow',
            signal: controller.signal,
          });

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

          const isM3u8 =
            contentType.includes('mpegurl') ||
            contentType.includes('m3u') ||
            /\.m3u8(\?|$)/i.test(finalUrl);

          const extraParams = `${
            customRef ? `&ref=${encodeURIComponent(customRef)}` : ''
          }${customUa ? `&ua=${encodeURIComponent(customUa)}` : ''}`;

          const buildProxyUrl = (rawUri: string) => {
            try {
              const resolved = new URL(rawUri.trim(), finalUrl).toString();
              return `/api/tv-proxy?url=${encodeURIComponent(resolved)}${extraParams}`;
            } catch {
              return rawUri;
            }
          };

          if (isM3u8) {
            const text = await upstreamRes.text();
            if (rawMode) {
              res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache, no-store',
              });
              res.end(text);
              return;
            }
            const rewritten = text
              .split(/\r?\n/)
              .map((line) => {
                const trimmed = line.trim();
                if (!trimmed) return line;
                if (trimmed.startsWith('#')) {
                  return line.replace(/URI="([^"]+)"/gi, (_m, uri) => {
                    return `URI="${buildProxyUrl(uri)}"`;
                  });
                }
                return buildProxyUrl(trimmed);
              })
              .join('\n');

            res.writeHead(200, {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
              'Cache-Control': 'no-cache, no-store',
            });
            res.end(rewritten);
            return;
          }

          const arrayBuffer = await upstreamRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Content-Type':
              upstreamRes.headers.get('content-type') || 'video/mp2t',
            'Content-Length': String(buffer.byteLength),
            'Cache-Control': 'public, max-age=10',
          });
          res.end(buffer);
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
    },
  };
}

export default defineConfig({
  plugins: [react(), tvStreamProxyPlugin()],
  server: {
    port: 8769,
    strictPort: true,
  },
  build: {
    target: 'esnext',
  },
});

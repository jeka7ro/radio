import zlib from 'node:zlib';

const epgFeedCache = new Map();
const EPG_CACHE_TTL_MS = 15 * 60 * 1000;

export function normalizeEpgKey(raw, stripGenericWords = false) {
  let s = (raw || '')
    .toLowerCase()
    .split('/')[0]
    .replace(/\.(ro|ru|md|uk|gb|us|de|fr|it|es|ua|by|kz)(@\w+)?$/i, '')
    .replace(
      /\(\s*(1080[pi]?|720[pi]?|576[pi]?|480[pi]?|4k|uhd|hd|sd|russia|romania|moldova|\d+)\s*\)/gi,
      ' '
    )
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(hd|fhd|uhd|4k|sd|live|orig|50fps|romania|russia)\b/gi, ' ');

  if (stripGenericWords) {
    s = s.replace(/\b(tv|тв|канал|channel|телеканал)\b/gi, ' ');
  }

  return s.replace(/[^a-z0-9а-яё+]+/gi, '').trim();
}

function parseXmltvTimestamp(raw) {
  const m = raw
    .trim()
    .match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
  if (!m) return 0;
  const tz = m[7] ? `${m[7].slice(0, 3)}:${m[7].slice(3)}` : 'Z';
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${tz}`;
  return Date.parse(iso) || 0;
}

function decodeXmlEntities(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export async function fetchAndParseXmltvFeed(feedUrl) {
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

  const channels = {};
  const archiveChannels = {};
  const keyMap = {};

  const firstProgIdx = xml.indexOf('<programme ');
  const chSection = firstProgIdx > 0 ? xml.slice(0, firstProgIdx) : xml;

  const chRegex = /<channel\s+id="([^"]+)">([\s\S]*?)<\/channel>/g;
  let chMatch;
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
    let dnMatch;
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
    const minArchiveStop = now - 7 * 24 * 60 * 60 * 1000;
    const minLiveStop = now - 5 * 60 * 1000;
    const maxStart = now + 12 * 60 * 60 * 1000;
    const progRegex = /<programme\s+([^>]+)>([\s\S]*?)<\/programme>/g;
    progRegex.lastIndex = firstProgIdx;

    let progMatch;
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

      const item = {
        t: decodeXmlEntities(titleRaw.trim()),
        d: descRaw
          ? decodeXmlEntities(descRaw.trim()).slice(0, 260)
          : undefined,
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

  const parsed = {
    timestamp: now,
    channels,
    archiveChannels,
    keyMap,
  };
  epgFeedCache.set(feedUrl, parsed);
  return parsed;
}

export function getEpgFeedUrlsForCountry(countryCode) {
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
  const mapCode = {
    GB: 'UK1',
    UK: 'UK1',
    US: 'US2',
    CA: 'CA2',
    BE: 'BE2',
  };
  const suffix = mapCode[upper] || `${upper}1`;
  return [`https://epgshare01.online/epgshare01/epg_ripper_${suffix}.xml.gz`];
}

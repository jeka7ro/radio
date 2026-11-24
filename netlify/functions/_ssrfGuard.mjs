import dns from 'node:dns/promises';

const dnsCheckCache = new Map();
const DNS_CACHE_TTL_MS = 60_000;

export function isPrivateOrReservedIpv4(host) {
  const m = String(host || '')
    .trim()
    .match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = Number(m[3]);
  const d = Number(m[4]);
  if (a > 255 || b > 255 || c > 255 || d > 255) return true;
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

export function isPrivateOrReservedIp(ipRaw) {
  const ip = String(ipRaw || '')
    .replace(/^\[|\]$/g, '')
    .toLowerCase()
    .trim();
  if (!ip) return true;
  if (isPrivateOrReservedIpv4(ip)) return true;
  if (
    ip === '::' ||
    ip === '::1' ||
    ip === '0:0:0:0:0:0:0:0' ||
    ip === '0:0:0:0:0:0:0:1' ||
    /^f[cd][0-9a-f]{2}:/i.test(ip) ||
    /^fe[89ab][0-9a-f]:/i.test(ip) ||
    /^ff[0-9a-f]{2}:/i.test(ip)
  ) {
    return true;
  }
  if (ip.startsWith('::ffff:')) {
    const mapped = ip.slice(7);
    if (isPrivateOrReservedIpv4(mapped)) return true;
    const hexMatch = mapped.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (hexMatch) {
      const hi = parseInt(hexMatch[1], 16);
      const lo = parseInt(hexMatch[2], 16);
      const dotted = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
      if (isPrivateOrReservedIpv4(dotted)) return true;
    }
  }
  return false;
}

export function isDisallowedTargetUrl(parsedUrl, reqHost = '') {
  if (!parsedUrl || (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:')) {
    return true;
  }
  const host = String(parsedUrl.hostname || '')
    .replace(/^\[|\]$/g, '')
    .toLowerCase()
    .trim();
  if (!host || /\s/.test(host)) return true;

  const cleanReqHost = String(reqHost || '')
    .split(':')[0]
    .replace(/^\[|\]$/g, '')
    .toLowerCase()
    .trim();

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '0.0.0.0' ||
    host === 'metadata' ||
    host === 'metadata.google.internal' ||
    host.endsWith('.internal') ||
    host.endsWith('.local') ||
    isPrivateOrReservedIp(host)
  ) {
    return true;
  }

  const lowerPath = String(parsedUrl.pathname || '').toLowerCase();
  if (lowerPath.includes('/api/tv-proxy')) return true;

  const isSelfOrigin =
    host === 'filmio.my' ||
    host === 'www.filmio.my' ||
    host.endsWith('.netlify.app') ||
    (cleanReqHost && host === cleanReqHost);
  if (isSelfOrigin && lowerPath.startsWith('/api/')) {
    return true;
  }

  return false;
}

export async function isHostDnsSafe(hostname) {
  const host = String(hostname || '')
    .replace(/^\[|\]$/g, '')
    .toLowerCase()
    .trim();
  if (!host) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
    return !isPrivateOrReservedIp(host);
  }
  const now = Date.now();
  const cached = dnsCheckCache.get(host);
  if (cached && now - cached.ts < DNS_CACHE_TTL_MS) {
    return cached.safe;
  }
  try {
    const records = await dns.lookup(host, { all: true });
    const safe =
      Array.isArray(records) &&
      records.length > 0 &&
      records.every((r) => !isPrivateOrReservedIp(r.address));
    if (dnsCheckCache.size > 300) {
      dnsCheckCache.clear();
    }
    dnsCheckCache.set(host, { safe, ts: now });
    return safe;
  } catch {
    return false;
  }
}

export async function fetchSafeExternalUrl(
  targetUrl,
  fetchInit = {},
  reqHost = '',
  maxRedirects = 5
) {
  let currentUrl = targetUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    let parsed;
    try {
      parsed = new URL(currentUrl);
    } catch {
      throw new Error('Invalid proxy target URL');
    }
    if (isDisallowedTargetUrl(parsed, reqHost)) {
      throw new Error('Forbidden proxy target');
    }
    const dnsSafe = await isHostDnsSafe(parsed.hostname);
    if (!dnsSafe) {
      throw new Error('Forbidden proxy target (private DNS)');
    }
    const res = await fetch(currentUrl, {
      ...fetchInit,
      redirect: 'manual',
    });
    if (
      res.status >= 300 &&
      res.status < 400 &&
      res.headers.get('location') &&
      hop < maxRedirects
    ) {
      try {
        res.body?.cancel();
      } catch {
        // ignore
      }
      currentUrl = new URL(res.headers.get('location'), currentUrl).toString();
      continue;
    }
    return { res, finalUrl: res.url || currentUrl };
  }
  throw new Error('Too many proxy redirects');
}

export function sanitizeImageContentType(rawCt) {
  const base = String(rawCt || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (!base.startsWith('image/') || base === 'image/svg+xml') {
    return null;
  }
  return base;
}

export function sanitizeProxyContentType(rawCt, fallback = 'application/octet-stream') {
  const base = String(rawCt || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (!base) return fallback;
  if (
    base === 'text/html' ||
    base === 'application/xhtml+xml' ||
    base === 'image/svg+xml' ||
    base === 'text/javascript' ||
    base === 'application/javascript' ||
    base === 'application/x-javascript'
  ) {
    return 'application/octet-stream';
  }
  return rawCt;
}

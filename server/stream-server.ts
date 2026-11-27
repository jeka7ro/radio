import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { Readable } from 'node:stream';
import {
  handleFileListRequest,
  ensureFileListTrackerIpUnlocked,
  getHardwareAccelSummary,
} from '../src/server/filelistServer.ts';
import { handleYouTubeRequest } from '../src/server/youtubeServer.ts';
import {
  getRequestPublicOrigin,
  invokeWebHandlerOnNodeHttp,
} from './nodeHttpAdapter.ts';
// @ts-ignore — canonical Web Fetch Netlify functions reused natively on QNAP (0 MB Netlify egress)
import tvProxyHandler from '../netlify/functions/tv-proxy.mjs';
// @ts-ignore
import tvEpgHandler from '../netlify/functions/tv-epg.mjs';
// @ts-ignore
import tvEpgArchiveHandler from '../netlify/functions/tv-epg-archive.mjs';
// @ts-ignore
import radioMetaHandler from '../netlify/functions/radio-meta.mjs';
// @ts-ignore
import iedemVodHandler from '../netlify/functions/iedem-vod.mjs';

const PORT = Number(process.env.PORT || 8769);
const HOST = '0.0.0.0';
const TORRENT_CACHE_DIR = '/tmp/aether-torrents';
const DIST_DIR = path.resolve(process.cwd(), 'dist');
const CLOUD_API_ORIGIN = (process.env.FILMIO_CLOUD_API_ORIGIN || 'https://filmio.my').replace(/\/+$/, '');
const MAX_CACHE_GB = Math.max(2, Number(process.env.FILMIO_MAX_CACHE_GB || 100));
const MAX_CACHE_BYTES = MAX_CACHE_GB * 1024 * 1024 * 1024;
const HLS_MAX_AGE_MS = 45 * 60 * 1000;
const TORRENT_IDLE_PRUNE_AGE_MS = 12 * 60 * 60 * 1000;
const startedAt = Date.now();

const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
}

function getDirSizeBytes(targetPath: string): number {
  try {
    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) return stat.size;
    let total = 0;
    for (const entry of fs.readdirSync(targetPath)) {
      total += getDirSizeBytes(path.join(targetPath, entry));
    }
    return total;
  } catch {
    return 0;
  }
}

function cleanupTorrentCache(): void {
  try {
    if (!fs.existsSync(TORRENT_CACHE_DIR)) return;
    const now = Date.now();
    const entries = fs.readdirSync(TORRENT_CACHE_DIR);
    const remaining: Array<{ fullPath: string; mtimeMs: number; size: number }> = [];
    let totalBytes = 0;

    for (const name of entries) {
      const fullPath = path.join(TORRENT_CACHE_DIR, name);
      try {
        const stat = fs.statSync(fullPath);
        if (name.startsWith('hls_') && now - stat.mtimeMs > HLS_MAX_AGE_MS) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          continue;
        }
        const size = getDirSizeBytes(fullPath);
        totalBytes += size;
        remaining.push({ fullPath, mtimeMs: stat.mtimeMs, size });
      } catch {
        // ignore transient file races
      }
    }

    if (totalBytes > MAX_CACHE_BYTES) {
      remaining.sort((a, b) => a.mtimeMs - b.mtimeMs);
      for (const item of remaining) {
        if (totalBytes <= MAX_CACHE_BYTES * 0.75) break;
        if (now - item.mtimeMs < TORRENT_IDLE_PRUNE_AGE_MS && totalBytes < MAX_CACHE_BYTES * 1.1) {
          continue;
        }
        try {
          fs.rmSync(item.fullPath, { recursive: true, force: true });
          totalBytes -= item.size;
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore cleanup errors
  }
}

async function registerCloudBridgeOnce(): Promise<void> {
  const publicDomain = (process.env.RAILWAY_PUBLIC_DOMAIN || '').trim();
  const rawBridgeUrl =
    (process.env.FILMIO_BRIDGE_URL || '').trim() ||
    (publicDomain ? `https://${publicDomain}` : '');
  if (!rawBridgeUrl.startsWith('https://')) return;
  try {
    const res = await fetch(`${CLOUD_API_ORIGIN}/api/tv-bridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bridgeUrl: rawBridgeUrl }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      console.log(`[FilmioStream] Registered cloud bridge: ${rawBridgeUrl}`);
    }
  } catch (err) {
    console.warn(
      '[FilmioStream] Bridge sync skipped:',
      err instanceof Error ? err.message : String(err)
    );
  }
}

function serveMsxStartJson(req: http.IncomingMessage, res: http.ServerResponse): void {
  const origin = getRequestPublicOrigin(req, PORT);
  const payload = {
    name: 'Filmio',
    version: '1.1.0',
    parameter: `content:${origin}/msx/start.json`,
    action: `link:${origin}/tv`,
    headline: 'Filmio',
    icon: 'msx-blue:play-circle-filled',
    image: `${origin}/msx/logo.png`,
    launcher: {
      type: 'default',
      title: 'Filmio',
      icon: 'blank',
      image: `${origin}/msx/logo.png`,
      color: 'msx-black',
    },
    template: {
      type: 'separate',
      layout: '0,0,4,3',
      color: 'msx-glass',
    },
    items: [
      {
        title: 'Filmio',
        titleFooter: 'QNAP Local 4K • Seriale, TV Live & Muzică',
        image: `${origin}/msx/logo.png`,
        imageFiller: 'height-center',
        color: 'msx-black',
        action: `link:${origin}/tv`,
      },
    ],
  };
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload, null, 2));
}

async function proxyCloudApiRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  rawUrl: string
): Promise<void> {
  const targetUrl = `${CLOUD_API_ORIGIN}${rawUrl}`;
  const fwdHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const lk = k.toLowerCase();
    if (
      lk === 'host' ||
      lk === 'connection' ||
      lk === 'content-length' ||
      lk === 'accept-encoding' ||
      lk === 'origin' ||
      lk === 'referer'
    ) {
      continue;
    }
    if (typeof v === 'string') fwdHeaders[k] = v;
    else if (Array.isArray(v)) fwdHeaders[k] = v.join(', ');
  }

  let bodyBuf: Buffer | undefined;
  if (req.method && !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    bodyBuf = Buffer.concat(chunks);
  }

  const upstream = await fetch(targetUrl, {
    method: req.method || 'GET',
    headers: fwdHeaders,
    body: bodyBuf && bodyBuf.length > 0 ? new Uint8Array(bodyBuf) : undefined,
    redirect: 'follow',
  });

  const respHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };
  upstream.headers.forEach((val, key) => {
    const lk = key.toLowerCase();
    if (
      lk === 'transfer-encoding' ||
      lk === 'content-encoding' ||
      lk === 'content-length' ||
      lk === 'connection' ||
      lk.startsWith('access-control-')
    ) {
      return;
    }
    respHeaders[key] = val;
  });

  res.writeHead(upstream.status, respHeaders);
  if (req.method === 'HEAD' || !upstream.body) {
    res.end();
    return;
  }
  const nodeStream = Readable.fromWeb(upstream.body as any);
  nodeStream.on('error', () => {
    if (!res.writableEnded) res.end();
  });
  nodeStream.pipe(res);
}

const COMPRESSIBLE_EXTS = new Set([
  '.html',
  '.js',
  '.mjs',
  '.css',
  '.json',
  '.webmanifest',
  '.svg',
  '.txt',
  '.xml',
]);
const staticGzipCache = new Map<string, { mtimeMs: number; gz: Buffer }>();

function tryServeStaticApp(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string
): boolean {
  if (!fs.existsSync(DIST_DIR)) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  const cleanRel = decodeURIComponent(pathname).replace(/^\/+/, '');
  let filePath = cleanRel ? path.resolve(DIST_DIR, cleanRel) : path.join(DIST_DIR, 'index.html');
  if (!filePath.startsWith(DIST_DIR)) return false;

  let isFallbackIndex = false;
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // Only SPA-fallback for routes without a file extension (e.g. /, /tv, /radio)
    if (path.extname(cleanRel)) return false;
    filePath = path.join(DIST_DIR, 'index.html');
    isFallbackIndex = true;
    if (!fs.existsSync(filePath)) return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);
  const cacheControl =
    !isFallbackIndex && pathname.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache';

  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  const canGzip =
    COMPRESSIBLE_EXTS.has(ext) &&
    stat.size >= 1024 &&
    /\bgzip\b/i.test(acceptEncoding);

  if (canGzip) {
    let cached = staticGzipCache.get(filePath);
    if (!cached || cached.mtimeMs !== stat.mtimeMs) {
      const raw = fs.readFileSync(filePath);
      cached = {
        mtimeMs: stat.mtimeMs,
        gz: zlib.gzipSync(raw, { level: 6 }),
      };
      staticGzipCache.set(filePath, cached);
    }
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Encoding': 'gzip',
      Vary: 'Accept-Encoding',
      'Content-Length': String(cached.gz.length),
      'Cache-Control': cacheControl,
    });
    if (req.method === 'HEAD') {
      res.end();
      return true;
    }
    res.end(cached.gz);
    return true;
  }

  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': String(stat.size),
    'Cache-Control': cacheControl,
  });
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const rawUrl = req.url || '/';
  let pathname = '/';
  try {
    pathname = new URL(rawUrl, 'http://localhost').pathname;
  } catch {
    pathname = rawUrl.split('?')[0] || '/';
  }

  try {
    if (pathname === '/health') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(
        JSON.stringify({
          ok: true,
          service: 'filmio-stream',
          node: process.env.FILMIO_NODE_NAME || process.env.RAILWAY_REGION || 'local',
          maxCacheGb: MAX_CACHE_GB,
          fullEpisodeCache: process.env.FILMIO_FULL_EPISODE_CACHE === '1',
          hwAccel: getHardwareAccelSummary(),
          nativeTvProxy: true,
          nativeRoutes: ['tv-proxy', 'tv-epg', 'tv-epg-archive', 'radio-meta', 'iedem-vod'],
          hasLocalWebUi: fs.existsSync(path.join(DIST_DIR, 'index.html')),
          uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
        })
      );
      return;
    }

    if (
      pathname === '/msx/start.json' ||
      pathname === '/start.json' ||
      pathname === '/tv/start.json' ||
      pathname === '/tv/msx/start.json'
    ) {
      serveMsxStartJson(req, res);
      return;
    }

    if (pathname.startsWith('/api/filelist')) {
      const handled = await handleFileListRequest(req, res);
      if (handled) return;
    }

    if (pathname.startsWith('/api/youtube')) {
      const handled = await handleYouTubeRequest(req, res);
      if (handled) return;
    }

    if (pathname === '/api/tv-proxy') {
      await invokeWebHandlerOnNodeHttp(req, res, tvProxyHandler, {
        urlPath: rawUrl,
        defaultPort: PORT,
        extraHeaders: { 'X-Filmio-Proxy': 'qnap-local' },
      });
      return;
    }

    if (pathname === '/api/tv-epg') {
      await invokeWebHandlerOnNodeHttp(req, res, tvEpgHandler, {
        urlPath: rawUrl,
        defaultPort: PORT,
        extraHeaders: { 'X-Filmio-Runtime': 'qnap-local' },
      });
      return;
    }

    if (pathname === '/api/tv-epg-archive') {
      await invokeWebHandlerOnNodeHttp(req, res, tvEpgArchiveHandler, {
        urlPath: rawUrl,
        defaultPort: PORT,
        extraHeaders: { 'X-Filmio-Runtime': 'qnap-local' },
      });
      return;
    }

    if (pathname === '/api/radio-meta') {
      await invokeWebHandlerOnNodeHttp(req, res, radioMetaHandler, {
        urlPath: rawUrl,
        defaultPort: PORT,
        extraHeaders: { 'X-Filmio-Runtime': 'qnap-local' },
      });
      return;
    }

    if (pathname === '/api/iedem-vod') {
      await invokeWebHandlerOnNodeHttp(req, res, iedemVodHandler, {
        urlPath: rawUrl,
        defaultPort: PORT,
        extraHeaders: { 'X-Filmio-Runtime': 'qnap-local' },
      });
      return;
    }

    if (pathname.startsWith('/api/')) {
      const reqOrigin = String(req.headers.origin || '').toLowerCase();
      // If called cross-origin from https://filmio.my for /api/vod-stream, return 501 so filmio.my uses Netlify directly.
      if (pathname.startsWith('/api/vod-stream') && reqOrigin.includes('filmio.my')) {
        res.writeHead(501, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(
          JSON.stringify({
            ok: false,
            error: 'Route handled by Filmio frontend/Netlify',
          })
        );
        return;
      }
      // For local LAN clients (LG TV on http://192.168.2.92:8769/tv), proxy sync/proxy/VOD routes to https://filmio.my
      await proxyCloudApiRequest(req, res, rawUrl);
      return;
    }

    if (tryServeStaticApp(req, res, pathname)) {
      return;
    }

    if (pathname === '/') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(
        JSON.stringify({
          ok: true,
          service: 'filmio-stream',
          node: process.env.FILMIO_NODE_NAME || 'local',
          maxCacheGb: MAX_CACHE_GB,
          hwAccel: getHardwareAccelSummary(),
          uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
        })
      );
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Not found' }));
  } catch (err) {
    console.error('[FilmioStream] Unhandled request error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : 'Internal server error',
        })
      );
    } else if (!res.writableEnded) {
      res.end();
    }
  }
});

// Prevent Node 22's default 5-minute requestTimeout from dropping long 4K streams.
server.requestTimeout = 0;
server.headersTimeout = 60_000;
server.keepAliveTimeout = 65_000;

const cleanupInterval = setInterval(cleanupTorrentCache, 15 * 60 * 1000);
cleanupInterval.unref();

server.listen(PORT, HOST, () => {
  console.log(
    `[FilmioStream] Listening on http://${HOST}:${PORT} (node=${process.env.FILMIO_NODE_NAME || 'local'}, maxCache=${MAX_CACHE_GB}GB, hwAccel=${getHardwareAccelSummary()}, localUI=${fs.existsSync(path.join(DIST_DIR, 'index.html'))})`
  );
  ensureFileListTrackerIpUnlocked(true)
    .then((unlocked) => {
      console.log(`[FilmioStream] FileList tracker IP unlock: ${unlocked ? 'OK' : 'pending'}`);
    })
    .catch((err) => {
      console.warn(
        '[FilmioStream] FileList IP unlock warning:',
        err instanceof Error ? err.message : String(err)
      );
    });
  void registerCloudBridgeOnce();
});

function shutdown(signal: string): void {
  console.log(`[FilmioStream] Received ${signal}, shutting down...`);
  clearInterval(cleanupInterval);
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 4000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

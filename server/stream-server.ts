import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {
  handleFileListRequest,
  ensureFileListTrackerIpUnlocked,
} from '../src/server/filelistServer.ts';
import { handleYouTubeRequest } from '../src/server/youtubeServer.ts';

const PORT = Number(process.env.PORT || 8769);
const HOST = '0.0.0.0';
const TORRENT_CACHE_DIR = '/tmp/aether-torrents';
const MAX_CACHE_GB = Math.max(2, Number(process.env.FILMIO_MAX_CACHE_GB || 25));
const MAX_CACHE_BYTES = MAX_CACHE_GB * 1024 * 1024 * 1024;
const HLS_MAX_AGE_MS = 45 * 60 * 1000;
const TORRENT_IDLE_PRUNE_AGE_MS = 30 * 60 * 1000;
const startedAt = Date.now();

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
        if (totalBytes <= MAX_CACHE_BYTES * 0.7) break;
        if (now - item.mtimeMs < TORRENT_IDLE_PRUNE_AGE_MS) continue;
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
    const res = await fetch('https://filmio.my/api/tv-bridge', {
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
    if (pathname === '/health' || pathname === '/') {
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
          uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
        })
      );
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

    // Return 501 (not 404) so vodStreamClient falls back to Netlify /api/vod-stream cleanly.
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
    `[FilmioStream] Listening on http://${HOST}:${PORT} (node=${process.env.FILMIO_NODE_NAME || 'local'}, maxCache=${MAX_CACHE_GB}GB)`
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

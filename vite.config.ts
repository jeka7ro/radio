import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { invokeWebHandlerOnNodeHttp } from './server/nodeHttpAdapter.ts';
// @ts-ignore — canonical isomorphic continuity & Web Fetch handlers shared with Netlify + QNAP
import { dedupeAndMergeProgressMaps } from './src/shared/continuitySync.mjs';
// @ts-ignore
import tvProxyHandler from './netlify/functions/tv-proxy.mjs';
// @ts-ignore
import tvEpgHandler from './netlify/functions/tv-epg.mjs';
// @ts-ignore
import tvEpgArchiveHandler from './netlify/functions/tv-epg-archive.mjs';
// @ts-ignore
import radioMetaHandler from './netlify/functions/radio-meta.mjs';
// @ts-ignore
import iedemVodHandler from './netlify/functions/iedem-vod.mjs';

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
        const cleanedBase = { ...(baseMap || {}) };
        const sanitizedIncoming: Record<string, any> = {};
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
              delete cleanedBase[k];
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
          sanitizedIncoming[k] = cleanV;
        }
        return dedupeAndMergeProgressMaps(cleanedBase, sanitizedIncoming);
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
        await invokeWebHandlerOnNodeHttp(req, res, radioMetaHandler, {
          mountPrefix: '/api/radio-meta',
          extraHeaders: { 'X-Filmio-Runtime': 'vite-dev' },
        });
      });

      server.middlewares.use('/api/tv-epg-archive', async (req, res) => {
        await invokeWebHandlerOnNodeHttp(req, res, tvEpgArchiveHandler, {
          mountPrefix: '/api/tv-epg-archive',
          extraHeaders: { 'X-Filmio-Runtime': 'vite-dev' },
        });
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
        await invokeWebHandlerOnNodeHttp(req, res, tvEpgHandler, {
          mountPrefix: '/api/tv-epg',
          extraHeaders: { 'X-Filmio-Runtime': 'vite-dev' },
        });
      });

      server.middlewares.use('/api/tv-proxy', async (req, res) => {
        await invokeWebHandlerOnNodeHttp(req, res, tvProxyHandler, {
          mountPrefix: '/api/tv-proxy',
          extraHeaders: { 'X-Filmio-Proxy': 'vite-dev' },
        });
      });

      server.middlewares.use('/api/iedem-vod', async (req, res) => {
        await invokeWebHandlerOnNodeHttp(req, res, iedemVodHandler, {
          mountPrefix: '/api/iedem-vod',
          extraHeaders: { 'X-Filmio-Runtime': 'vite-dev' },
        });
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

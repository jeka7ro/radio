const CACHE_NAME = 'aether-radio-v11';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/favicon.svg',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

function openOfflineDbSw() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('aether_offline_media_db_v1', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getOfflineItemSw(id) {
  const db = await openOfflineDbSw();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readonly');
    const req = tx.objectStore('items').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function getOfflineBlobSw(key) {
  const db = await openOfflineDbSw();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('blobs', 'readonly');
    const req = tx.objectStore('blobs').get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function precacheShellAndBundles(cache) {
  try {
    await cache.addAll(STATIC_ASSETS);
    const res = await fetch('/index.html', { cache: 'no-store' });
    if (res && res.ok) {
      await cache.put('/index.html', res.clone());
      await cache.put('/', res.clone());
      const html = await res.text();
      const assetMatches = html.match(/\/assets\/[^"'\s>]+/g) || [];
      for (const assetPath of assetMatches) {
        try {
          await cache.add(assetPath);
        } catch {
          // ignore individual asset error
        }
      }
    }
  } catch {
    // ignore offline install error
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => precacheShellAndBundles(cache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Serve downloaded Offline HLS manifests & .ts segments directly from IndexedDB for iOS native AVPlayer
  if (url.pathname.startsWith('/offline-hls/')) {
    event.respondWith(
      (async () => {
        try {
          const parts = url.pathname
            .replace(/^\/offline-hls\//, '')
            .split('/')
            .filter(Boolean);
          const itemId = decodeURIComponent(parts[0] || '');
          const subPath = parts.slice(1).join('/');
          const encId = encodeURIComponent(itemId);

          if (subPath.endsWith('.m3u8')) {
            const meta = await getOfflineItemSw(itemId);
            if (!meta) return new Response('Not found', { status: 404 });
            let manifest = '';
            if (subPath === 'master.m3u8') manifest = meta.masterM3u8 || '';
            else if (subPath === 'video.m3u8') manifest = meta.videoM3u8 || '';
            else if (subPath === 'audio.m3u8') manifest = meta.audioM3u8 || '';

            const rewritten = manifest.replace(
              new RegExp(
                `https://offline\\.local/${encId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`,
                'g'
              ),
              `${url.origin}/offline-hls/${encId}/`
            );
            return new Response(rewritten, {
              status: 200,
              headers: {
                'Content-Type': 'application/vnd.apple.mpegurl',
                'Cache-Control': 'no-store',
              },
            });
          }

          const segMatch = subPath.match(/^seg\/([va]_\d+)\.ts$/);
          if (segMatch && segMatch[1]) {
            const chunk = await getOfflineBlobSw(`${itemId}::${segMatch[1]}`);
            if (!chunk) return new Response('Segment not found', { status: 404 });
            const ab = chunk instanceof Blob ? await chunk.arrayBuffer() : chunk;
            return new Response(ab, {
              status: 200,
              headers: {
                'Content-Type': 'video/mp2t',
                'Content-Length': String(ab.byteLength),
                'Cache-Control': 'no-store',
              },
            });
          }

          return new Response('Invalid offline path', { status: 404 });
        } catch (err) {
          return new Response(String(err), { status: 500 });
        }
      })()
    );
    return;
  }

  // Never intercept live audio/video streams, local API endpoints, Vite dev modules, or non-GET requests
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname.startsWith('192.168.') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/msx/') ||
    url.pathname === '/start.json' ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    request.destination === 'audio' ||
    request.destination === 'video' ||
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.aac') ||
    url.pathname.endsWith('.m3u8') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.mp4') ||
    url.pathname.endsWith('.webm') ||
    url.pathname.endsWith('.ogg')
  ) {
    return;
  }

  // Network-first with cache fallback for Radio Browser API calls (countries & station lists)
  if (
    url.hostname.includes('api.radio-browser.info') &&
    !url.pathname.includes('/json/url/')
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Network-first for HTML navigation requests + store in cache so Airplane Mode works 100% offline
  if (
    request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/tv' ||
    url.pathname === '/index.html'
  ) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.ok) {
            const cloneForIndex = response.clone();
            const cloneForRoot = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', cloneForIndex);
              cache.put('/', cloneForRoot);
            });
          }
          return response;
        })
        .catch(async () => {
          const cachedIndex =
            (await caches.match('/index.html')) ||
            (await caches.match('/')) ||
            (await caches.match(request));
          return (
            cachedIndex ||
            new Response('Offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
          );
        })
    );
    return;
  }

  // Cache poster images so offline downloads keep their cover art in Airplane Mode
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const net = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || net;
      })
    );
    return;
  }

  // Stale-while-revalidate for static shell assets (/assets/*.js, /assets/*.css, icons, fonts)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});

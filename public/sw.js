const CACHE_NAME = 'aether-radio-v77';
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
  } catch {
    // ignore offline install error (bundles are cached lazily on fetch)
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

  // Serve downloaded Offline HLS manifests & .ts/.mp4 segments directly from IndexedDB for iOS native AVPlayer
  // (MUST run before the Range header bypass because iOS AVPlayer sends Range headers for offline segments!)
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

          const initMatch = subPath.match(/^seg\/([va]_init)\.mp4$/);
          const segMatch = subPath.match(/^seg\/([va]_\d+)\.ts$/);
          const keySuffix = initMatch?.[1] || segMatch?.[1] || '';
          if (keySuffix) {
            const chunk = await getOfflineBlobSw(`${itemId}::${keySuffix}`);
            if (!chunk) return new Response('Segment not found', { status: 404 });
            const ab = chunk instanceof Blob ? await chunk.arrayBuffer() : chunk;
            const total = ab.byteLength;
            const contentType = initMatch ? 'video/mp4' : 'video/mp2t';
            const rangeHeader = request.headers.get('range');
            if (rangeHeader && /^bytes=/i.test(rangeHeader)) {
              const [startStr, endStr] = rangeHeader.replace(/^bytes=/i, '').split('-');
              const start = Math.max(0, parseInt(startStr || '0', 10) || 0);
              const end = endStr
                ? Math.min(total - 1, parseInt(endStr, 10) || total - 1)
                : total - 1;
              const slice = ab.slice(start, end + 1);
              return new Response(slice, {
                status: 206,
                headers: {
                  'Content-Type': contentType,
                  'Content-Range': `bytes ${start}-${end}/${total}`,
                  'Accept-Ranges': 'bytes',
                  'Content-Length': String(slice.byteLength),
                  'Cache-Control': 'no-store',
                },
              });
            }
            return new Response(ab, {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes',
                'Content-Length': String(total),
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

  if (request.headers.has('range')) return;

  // Never intercept live audio/video streams, local API endpoints, Vite dev modules, or non-GET requests
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname.startsWith('192.168.') ||
    url.hostname.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(url.hostname) ||
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

  // Network-first with cache fallback for same-origin static shell assets so PWA launches always execute fresh deploys
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});

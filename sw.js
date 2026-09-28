/* Service Worker — Purchase Dashboard
   Strategi:
   - index.html & sw.js & browserconfig.xml : selalu network-first (biar update kode langsung tampil)
   - aset statis (ikon/manifest)            : cache-first (cepat & aman)
   - data Google Sheets (cross-origin)      : tidak pernah di-cache (selalu network) */
const CACHE = 'pfs-v15';
const STATIC = [
  './manifest.webmanifest',
  './browserconfig.xml',
  './icons/icon.svg?v=2',
  './icons/favicon.ico?v=2',
  './icons/icon-1024.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/icon-192-maskable.png',
  './icons/android-chrome-192x192.png?v=2',
  './icons/android-chrome-512x512.png',
  './icons/apple-touch-icon.png?v=2',
  './icons/mstile-150x150.png?v=2',
  './icons/favicon-16x16.png?v=2',
  './icons/favicon-32x32.png?v=2',
  './icons/favicon-48x48.png?v=2'
];
const NETWORK_FIRST = ['./', './index.html', './sw.js', './browserconfig.xml'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Data live (Google Sheets) -> jangan di-cache, selalu network */
  if (url.origin !== self.location.origin) return;

  /* Halaman utama & sw.js -> network-first (biar selalu dapat versi terbaru) */
  const path = url.pathname;
  if (path.endsWith('/index.html') || path.endsWith('/') || path.endsWith('/sw.js') || path.endsWith('/browserconfig.xml')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put('./index.html', clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  /* Aset statis -> cache-first */
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      });
    })
  );
});

/* Service Worker — Purchase Dashboard (stale-while-revalidate) */
const CACHE = 'pfs-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './browserconfig.xml',
  './icons/icon.svg',
  './icons/favicon.ico',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/android-chrome-192x192.png',
  './icons/android-chrome-512x512.png',
  './icons/apple-touch-icon.png',
  './icons/mstile-150x150.png',
  './icons/favicon-16x16.png',
  './icons/favicon-32x32.png',
  './icons/favicon-48x48.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Stale-while-revalidate for same-origin (app shell). Cross-origin (live
   Google Sheets data) always goes to network so the dashboard stays synced. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never cache the live data

  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      }).catch(() => cached || caches.match('./index.html'));
      return cached || network;
    })
  );
});

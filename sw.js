const CACHE_NAME = 'sakura-cinema-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './anilibria.html',
  './manifest.json',
  './css/styles.css',
  './css/anilibria.css',
  './js/app.js',
  './js/anilibria.js',
  './js/hls.min.js',
  './js/mirrors.js',
  './js/storage.js',
  './js/sakura-engine.js',
  './js/mascot.js',
  './assets/logo-dark.png',
  './assets/dream-chaser.mp4',
  './data/sites.json',
  './data/mirrors.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});

// Network first, cache only as the offline fallback: a fix to the game reaches every player on the next visit.
const CACHE_NAME = 'wordle-it-v4';
const ASSETS = [
  './',
  './index.html',
  './main.css',
  './main.js',
  './icons.js',
  './achievements.js',
  './firebase.js',
  './parole.txt',
  '/games/shared/arcade.css',
  '/games/shared/arcade.js',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

// drop the old Wordle caches (only ours: the other games share the origin)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('wordle-it-') && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});

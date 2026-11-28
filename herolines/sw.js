// Offline cache (network-first so updates show up immediately when online)
const CACHE = 'lanebreakers-v5';
const ASSETS = ['./', './index.html', './css/style.css', './manifest.webmanifest',
  './js/data.js', './js/util.js', './js/game.js', './js/abilities.js', './js/ai.js',
  './js/art.js', './js/heroart.js', './js/render.js', './js/audio.js', './js/ui.js', './js/main.js',
  './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok && new URL(e.request.url).origin === location.origin) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

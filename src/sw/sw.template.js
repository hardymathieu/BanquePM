// Service worker (SPEC §10.3): the app opens without a network once it has been opened online.
// Generated at build time (vite.config.ts) with the exact list of built files.
// It never touches /api/*: data is never cached here (the kid view keeps its own encrypted copy).
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `bpm-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bpm-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    // Network first, so a new version shows at once; the cached app shell when offline.
    event.respondWith(fetch(request).catch(() => caches.match('/', { cacheName: CACHE }).then((r) => r || Response.error())));
    return;
  }
  event.respondWith(caches.match(request, { cacheName: CACHE }).then((hit) => hit || fetch(request)));
});

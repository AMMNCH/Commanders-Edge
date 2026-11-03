// Commander's Edge service worker: makes the app open with no connection.
// Navigations are network-first (so updates land), static assets cache-first.
const CACHE = 'ce-v3';
// Paths are relative to the worker's scope so the app also works under a
// subpath (e.g. GitHub Pages project sites).
const SCOPE = new URL('./', self.location).pathname;
const SHELL = ['', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png'].map((p) => SCOPE + p);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');
  if (!sameOrigin && !isFont) return; // never cache API calls (Scryfall, Base44, ...)
  if (sameOrigin && url.pathname.includes('/api/')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      // Always ask the network for the newest page (skip the HTTP cache).
      fetch(req, { cache: 'no-store' })
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(SCOPE, copy)); return res; })
        .catch(() => caches.match(SCOPE))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});

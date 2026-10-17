// Service worker: lets the app open with no signal.
// The app's own files are NETWORK-FIRST: online you always get the newest
// code, and the cache is only the offline fallback, so a stale build can't
// stick. The Firebase SDK (versioned URLs on gstatic) is cache-first.
// Firestore/Auth traffic is never touched (Firestore has its own offline cache).
// BUILD must equal js/version.js (tests/build.test.mjs). Changing it changes this file's bytes,
// which is what makes phones install the new worker and refresh the offline copy.
const BUILD = '2026-10-17.1';
const CACHE = 'pb-' + BUILD;
const SHELL = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/version.js',
  'js/logic/update.js',
  'js/ui.js',
  'js/backend.js',
  'js/screens/home.js', 'js/screens/dates.js', 'js/screens/plan.js', 'js/screens/gifts.js', 'js/screens/profile.js',
  'js/screens/cycle.js', 'js/screens/arguments.js', 'js/screens/account.js', 'js/screens/settings.js', 'js/screens/card.js',
  'css/home.css', 'css/dates.css', 'css/plan.css', 'css/gifts.css', 'css/profile.css',
  'css/cycle.css', 'css/arguments.css', 'css/account.css', 'css/settings.css', 'css/card.css',
  'js/firebase-config.js',
  'js/logic/dates.js',
  'js/logic/ics.js',
  'js/logic/profile.js',
  'js/logic/holidays.js',
  'js/logic/home.js',
  'js/logic/suggest.js',
  'js/logic/nudges.js',
  'js/logic/history.js',
  'js/logic/weather.js',
  'data/drive-times.json',
  'js/logic/card.js',
  'data/ssc-deals.json',
  'js/logic/backup.js',
  'js/logic/capture.js',
  'js/logic/share.js',
  'js/logic/arguments.js',
  'js/logic/gifts.js',
  'js/logic/cycle.js',
  'js/logic/plan.js',
  'data/plan-stops.json',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache (GitHub Pages: max-age=600), so the offline
  // copy is the new build, not a 10-minute-old mix.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      try {
        // By URL: a navigate-mode Request can't be re-fetched with options
        // (that throws, which would silently serve the cached copy).
        const res = await fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' });
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      } catch (err) {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') return (await caches.match('index.html')) || Response.error();
        return Response.error();
      }
    })());
    return;
  }

  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })());
  }
});

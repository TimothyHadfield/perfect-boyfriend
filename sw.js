// Service worker: lets the app open with no signal.
// The app's own files are NETWORK-FIRST: online you always get the newest
// code, and the cache is only the offline fallback, so a stale build can't
// stick. The Firebase SDK (versioned URLs on gstatic) is cache-first.
// Firestore/Auth traffic is never touched (Firestore has its own offline cache).
const CACHE = 'pb-v2';
const SHELL = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/ui.js',
  'js/backend.js',
  'js/screens/home.js', 'js/screens/dates.js', 'js/screens/plan.js', 'js/screens/gifts.js', 'js/screens/profile.js',
  'js/screens/cycle.js', 'js/screens/arguments.js', 'js/screens/account.js', 'js/screens/settings.js',
  'css/home.css', 'css/dates.css', 'css/plan.css', 'css/gifts.css', 'css/profile.css',
  'css/cycle.css', 'css/arguments.css', 'css/account.css', 'css/settings.css',
  'js/firebase-config.js',
  'js/logic/dates.js',
  'js/logic/ics.js',
  'js/logic/profile.js',
  'js/logic/holidays.js',
  'js/logic/home.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
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

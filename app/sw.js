/* ============================================================
   sw.js — offline app shell (PRD §6 phase 8).

   Strategy, chosen for a BUILD-FREE app (no content hashes, so a
   cache-first shell would serve stale code after every deploy):

   - Same-origin (the shell): NETWORK-FIRST. Online users always get
     the freshly deployed files; the cache is only a fallback when the
     network is unreachable.
   - CDN assets (Alpine, JSZip, fonts, Firebase SDK): STALE-WHILE-
     REVALIDATE. These URLs are version-pinned, so serving the cached
     copy instantly is safe; the background refresh keeps them warm.
   - Everything else (Wikipedia, dictionary APIs, Firestore): NOT
     intercepted. Lookup results are already cached in localStorage
     (glossary.cache) and Firestore has its own offline persistence —
     a second cache layer here could only serve stale data.

   All URLs are relative so the same file works at localhost:8321/
   and under the GitHub Pages subpath (/glossary/).
   ============================================================ */
const SHELL_CACHE = 'glossary-shell-v1';
const CDN_CACHE = 'glossary-cdn-v1';

const SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'firebase.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

const CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.gstatic.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k.startsWith('glossary-') && k !== SHELL_CACHE && k !== CDN_CACHE)
          .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req));
  }
  // anything else falls through to the network untouched
});

/* No-cors requests (plain <script>/<link> tags) yield "opaque" responses
   with status 0 — res.ok is false for those, but they replay fine. */
function cacheable(res) {
  return res && (res.ok || res.type === 'opaque');
}

// how long the network gets before a cached copy wins — a flaky cellular
// link must degrade into the cached shell, never into a hanging white page
const NETWORK_TIMEOUT_MS = 5000;

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('sw-network-timeout')), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  // the fetch keeps running even when the cached copy wins the race below,
  // so a slow-but-alive network still refreshes the cache for next time
  const network = fetch(req).then((fresh) => {
    if (cacheable(fresh)) cache.put(req, fresh.clone());
    return fresh;
  });
  network.catch(() => {}); // the cache path may abandon this promise
  try {
    return await withTimeout(network, NETWORK_TIMEOUT_MS);
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    // a navigation to any route (e.g. a #/… deep link) falls back to the shell
    if (req.mode === 'navigate') {
      const shell = await cache.match('./');
      if (shell) return shell;
    }
    // nothing cached: a slow network is still better than a dead request
    return network;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CDN_CACHE);
  const hit = await cache.match(req);
  const refresh = fetch(req)
    .then(async (res) => { if (cacheable(res)) await cache.put(req, res.clone()); return res; })
    .catch(() => hit); // offline: the cached copy (or a rejected promise if none)
  return hit || refresh;
}

/**
 * Round seven, task R (third bullet): a hand-written service worker rather
 * than `@serwist/next` — this repo's `next build` runs on Turbopack by
 * default (no `--webpack` flag in `package.json`), and Turbopack does not
 * run webpack plugins, which is how `@serwist/next` generates its precache
 * manifest. Forcing the whole production build back onto webpack just for
 * one feature was a bigger, riskier change than this file. This is the
 * approach Next's own PWA guide documents for exactly this situation: a
 * plain `public/sw.js`, registered by hand, with no build-time manifest.
 *
 * Lives outside `src/` on purpose — it runs in the service worker global
 * scope (`self`, `caches`, no DOM), not in Next's module graph, so it is
 * plain untranspiled JS and untouched by `tsc`/`eslint src`.
 *
 * Scope, deliberately narrow:
 *   - Never cache `/api/*` — those requests are always let through live.
 *   - Precache the offline fallback pages (`/offline`, `/en/offline`) and
 *     the assets they reference, so a failed navigation has something real
 *     to show instead of the browser's own dinosaur page.
 *   - Runtime cache-first for `/_next/static/*` (content-hashed, immutable)
 *     and imagery/icons, so a returning visit is fast and partially usable
 *     offline even outside the fallback page.
 *   - Everything else passes straight through untouched.
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `mero-health-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `mero-health-runtime-${CACHE_VERSION}`;
const OFFLINE_URLS = ['/offline', '/en/offline'];

/**
 * Next's static asset filenames are content-hashed per build, so there is
 * no fixed list to precache — this fetches the offline document itself,
 * caches it, then pulls the `/_next/static/...` URLs it actually references
 * out of its own HTML so the page still has its styling and script when
 * served from cache with no network at all. Best-effort: a missing asset
 * degrades to an unstyled offline page, not a failed install.
 */
async function precacheOfflinePage(url, cache) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return;
  const html = await response.clone().text();
  await cache.put(url, response);

  const assetUrls = new Set();
  const pattern = /(?:href|src)="(\/_next\/static\/[^"]+)"/g;
  let match = pattern.exec(html);
  while (match) {
    assetUrls.add(match[1]);
    match = pattern.exec(html);
  }

  await Promise.all(
    Array.from(assetUrls).map(async (assetUrl) => {
      try {
        const assetResponse = await fetch(assetUrl, { cache: 'no-store' });
        if (assetResponse.ok) await cache.put(assetUrl, assetResponse);
      } catch {
        // Best effort — see the function comment above.
      }
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(['/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png']);
      await Promise.all(OFFLINE_URLS.map((url) => precacheOfflinePage(url, cache)));
      // Takes over immediately rather than waiting for every open tab to
      // close — combined with `clients.claim()` below and the registration
      // side's `updateViaCache: 'none'`, an edit to this file reaches an
      // open tab on its next navigation instead of staying stuck on the
      // service worker that was active when the tab first loaded.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, RUNTIME_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((name) => !keep.has(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

function offlineFallbackFor(requestUrl) {
  const { pathname } = new URL(requestUrl);
  return pathname === '/en' || pathname.startsWith('/en/') ? '/en/offline' : '/offline';
}

const RUNTIME_CACHEABLE_PREFIXES = ['/_next/static/', '/imagery/', '/icon', '/manifest.webmanifest'];

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // `no-store` forces an actual network round-trip. The default
          // cache mode lets the browser's own HTTP cache satisfy a
          // navigation (Next serves `s-maxage` on these) without ever
          // reaching the network, which would make this "network-first"
          // strategy silently serve a page that can be minutes stale, and
          // would hide a real offline state instead of showing the
          // fallback below.
          return await fetch(request, { cache: 'no-store' });
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const fallback = await cache.match(offlineFallbackFor(request.url));
          return fallback ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (RUNTIME_CACHEABLE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(
      (async () => {
        // The manifest and icons are also install-time precached into
        // `SHELL_CACHE` (so they're available immediately, not only after
        // being requested once) — check there first before falling into
        // the request-then-cache runtime strategy the hashed static assets
        // use.
        const shellCache = await caches.open(SHELL_CACHE);
        const shellHit = await shellCache.match(request);
        if (shellHit) return shellHit;

        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      })(),
    );
  }
});

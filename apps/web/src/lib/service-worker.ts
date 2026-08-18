/**
 * Round seven, task R (third bullet). `public/sw.js` is the actual service
 * worker (see its own comment for why it is hand-written rather than
 * `@serwist/next`); this module is just the decision of *whether* to
 * register it, kept pure and testable the same way `install-prompt.ts`
 * keeps `installPlatform` separate from the component that calls it.
 */

export const SERVICE_WORKER_URL = '/sw.js';

/**
 * Registration is skipped outside production so `next dev`'s own
 * fast-refreshing static assets are never shadowed by a runtime cache built
 * for content-hashed, immutable production filenames — a stale dev cache
 * would look like a broken hot-reload, not a working offline mode.
 */
export function shouldRegisterServiceWorker(env: {
  isProduction: boolean;
  hasServiceWorkerSupport: boolean;
}): boolean {
  return env.isProduction && env.hasServiceWorkerSupport;
}

export function registerServiceWorker(): void {
  if (
    !shouldRegisterServiceWorker({
      isProduction: process.env.NODE_ENV === 'production',
      hasServiceWorkerSupport: 'serviceWorker' in navigator,
    })
  ) {
    return;
  }

  // `updateViaCache: 'none'` stops the browser's HTTP cache from serving a
  // stale `sw.js` on the update check — without it, an edited service
  // worker can go unnoticed until the cached response itself expires, which
  // is exactly the "stale-forever" bug this task calls out.
  navigator.serviceWorker.register(SERVICE_WORKER_URL, { updateViaCache: 'none' }).catch(() => {
    // Best effort: a failed registration means this session has no offline
    // support, not a broken app — every feature already assumes a network.
  });
}

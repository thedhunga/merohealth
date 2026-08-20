import { describe, expect, it, vi } from 'vitest';

// `proxy.ts` calls `createMiddleware(routing)` at module load, which pulls in
// `next/server` — unresolvable under vitest. We only care about the exported
// `config.matcher`, so stub the middleware factory to a no-op.
vi.mock('next-intl/middleware', () => ({ default: () => () => undefined }));

import { config } from './proxy';

/**
 * The i18n middleware matcher must run on content paths but skip Next's
 * file-based metadata routes. `/icon` regressed once (see this file's git
 * history): served extensionless, it slipped past the `.*\..*` static-file
 * guard, so the middleware locale-routed the favicon and 404'd it site-wide.
 * These assertions pin the exclusion so a future matcher edit can't silently
 * break the browser-tab / Add-to-Home-Screen icons again.
 */
const matches = (pathname: string): boolean => new RegExp(`^${config.matcher[0]}$`).test(pathname);

describe('proxy middleware matcher', () => {
  it('runs on the localized content paths', () => {
    for (const path of ['/', '/en', '/get-care', '/en/get-care', '/individuals']) {
      expect(matches(path), path).toBe(true);
    }
  });

  it('skips the extensionless metadata routes', () => {
    for (const path of ['/icon', '/apple-icon']) {
      expect(matches(path), path).toBe(false);
    }
  });

  it('skips Next internals, the Expo /app build, and static files', () => {
    for (const path of ['/api/voice/token', '/_next/static/x.js', '/app', '/manifest.webmanifest']) {
      expect(matches(path), path).toBe(false);
    }
  });
});

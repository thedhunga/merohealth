import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Run on every path except Next internals, the Expo product build served at
  // /app, Next's extensionless metadata routes, and anything that looks like a
  // static file.
  //
  // `icon`/`apple-icon` come from `app/icon.tsx` / `app/apple-icon.tsx` and
  // are served *extensionless*, so the `.*\\..*` static-file guard misses
  // them. Without `icon` here the i18n middleware intercepts `/icon`,
  // locale-routing a favicon it has no locale variant of, and 404s the
  // browser-tab icon site-wide. `/apple-icon` only escapes today because it
  // happens to prefix-match the `/app` exclusion above — listing it
  // explicitly stops that coincidence from silently breaking the
  // Add-to-Home-Screen icon if `/app` is ever tightened. `manifest`,
  // `sitemap`, and `robots` are safe only because they carry an extension.
  //
  // Must stay an inline string literal: Next statically analyses this field
  // at build time and rejects a non-literal matcher. `proxy.test.ts` locks
  // in the exclusions.
  matcher: ['/((?!api|_next|_expo|app|icon|apple-icon|.*\\..*).*)'],
};

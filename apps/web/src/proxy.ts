import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Run on every path except Next internals, the Expo product build served at
  // /app, and anything that looks like a static file.
  matcher: ['/((?!api|_next|_expo|app|.*\\..*).*)'],
};

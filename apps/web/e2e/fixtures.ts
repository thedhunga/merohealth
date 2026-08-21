import { test as base, expect } from '@playwright/test';

/**
 * `journeys-production`'s `iphone` project has repeatedly failed with bare
 * "element not found" timeouts and no further explanation — the browser-side
 * cause (a console error, an uncaught exception, a failed request) only
 * lives inside the Playwright trace zip, and this environment's outbound
 * network policy cannot always reach the artifact storage host to pull it
 * down (confirmed 2026-08-21: a 403 at the proxy for
 * `productionresultssa0.blob.core.windows.net`). Echoing the browser's own
 * signals straight into the test's stdout means the *next* WebKit-only
 * failure explains itself in the CI job log directly, with no artifact
 * download required. Every spec imports `test`/`expect` from here instead of
 * `@playwright/test` so this applies uniformly with no per-file setup.
 */
export const test = base.extend<Record<string, never>>({
  page: async ({ page }, use) => {
    page.on('console', (message) => {
      if (message.type() === 'error') console.log(`[browser console.error] ${message.text()}`);
    });
    page.on('pageerror', (error) => {
      console.log(`[browser uncaught exception] ${error.message}`);
    });
    page.on('requestfailed', (request) => {
      console.log(`[browser request failed] ${request.method()} ${request.url()} — ${request.failure()?.errorText}`);
    });
    await use(page);
  },
});

export { expect };

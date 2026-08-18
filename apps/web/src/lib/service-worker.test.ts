import { describe, expect, it } from 'vitest';

import { shouldRegisterServiceWorker } from './service-worker';

describe('shouldRegisterServiceWorker', () => {
  it('registers only in production with service worker support', () => {
    expect(shouldRegisterServiceWorker({ isProduction: true, hasServiceWorkerSupport: true })).toBe(true);
  });

  it('skips in development, even with support, so it never shadows dev assets', () => {
    expect(shouldRegisterServiceWorker({ isProduction: false, hasServiceWorkerSupport: true })).toBe(false);
  });

  it('skips when the browser has no service worker support', () => {
    expect(shouldRegisterServiceWorker({ isProduction: true, hasServiceWorkerSupport: false })).toBe(false);
  });
});

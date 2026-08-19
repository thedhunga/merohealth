import { defineConfig, devices } from '@playwright/test';

/**
 * User-journey tests — real situations, phone first.
 *
 * Two ways to run:
 *   pnpm test:e2e                     → against a local dev server (started here)
 *   E2E_BASE_URL=https://… pnpm test:e2e  → against a deployed site (CI nightly
 *                                        runs this against production)
 *
 * Journeys that need a live research answer (a real Gemini call) are tagged
 * @live and skipped unless E2E_LIVE=1, so the deterministic journeys — safety
 * interception, containment, premium coming-soon, PWA, phone layout — always
 * run and always mean the same thing.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3100';
const isRemote = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'ne-NP',
  },
  projects: [
    // Mobile is the product. The phone project is the one that must pass.
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: isRemote
    ? undefined
    : {
        // CI has already built the app; locally, dev is what you want.
        command: process.env.CI ? 'pnpm exec next start --port 3100' : 'pnpm exec next dev --port 3100',
        url: 'http://localhost:3100',
        reuseExistingServer: true,
        timeout: 180_000,
      },
});

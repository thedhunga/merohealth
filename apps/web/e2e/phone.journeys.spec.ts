import { expect, test } from '@playwright/test';

import { expectNoHorizontalOverflow, expectTapTargets } from './helpers';

/**
 * The phone is the product. These run on the phone projects and describe
 * what a person with a mid-range Android on mobile data actually gets.
 */
test.describe('phone-first home', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone-only journey');

  test('first visit: the mic is the hero, the page is short, no video is downloaded', async ({ page }) => {
    const mp4Requests: string[] = [];
    page.on('request', (r) => {
      if (/\.mp4(\?|$)/.test(r.url())) mp4Requests.push(r.url());
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // A big, single, obvious way to talk — above the fold.
    const big = await page.evaluate(() => {
      const vh = window.innerHeight;
      return [...document.querySelectorAll<HTMLElement>('button,[role=button]')]
        .map((b) => {
          const r = b.getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) };
        })
        .filter((b) => b.w >= 88 && b.h >= 88 && b.top < vh);
    });
    expect(big.length, 'a ≥88px control above the fold').toBeGreaterThanOrEqual(1);

    // Short enough to be a home screen, not a brochure.
    const screens = await page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight);
    expect(screens, 'homepage height in phone screens').toBeLessThanOrEqual(3);

    await expect(page.locator('video')).toHaveCount(0);
    expect(mp4Requests, 'no video bytes on a phone').toEqual([]);
    await expectNoHorizontalOverflow(page);
    await expectTapTargets(page);
  });

  test('/get-care and /pricing meet the tap-target floor and never scroll sideways', async ({ page }) => {
    for (const path of ['/get-care', '/pricing']) {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
      await expectTapTargets(page);
    }
  });
});

test.describe('installable app (PWA)', () => {
  test('manifest, icons and theme colour are all served', async ({ page, request }) => {
    await page.goto('/');
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();
    const manifest = await request.get(manifestHref!);
    expect(manifest.ok()).toBe(true);
    const json = (await manifest.json()) as { display: string; icons: { src: string; sizes: string }[]; start_url: string };
    expect(json.display).toBe('standalone');
    expect(json.icons.some((i) => i.sizes === '512x512')).toBe(true);
    for (const icon of json.icons) {
      const res = await request.get(icon.src);
      expect(res.ok(), icon.src).toBe(true);
      expect(res.headers()['content-type']).toContain('image/png');
    }
    // Light and dark themes may each declare one.
    expect(await page.locator('meta[name="theme-color"]').count()).toBeGreaterThanOrEqual(1);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  });
});

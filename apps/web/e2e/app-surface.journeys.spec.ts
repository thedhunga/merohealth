import { expect, test } from '@playwright/test';

/**
 * `/app` is the Expo web export of `apps/mobile` — the actual product
 * surface the footer's "App Store"/"Google Play" links point at (see
 * `Footer.tsx`) until real store listings exist. It has had zero e2e
 * coverage since Round seven task PP first flagged the gap: the Next dev
 * server this suite runs against never served it, because nothing copied
 * `apps/mobile/dist` into `apps/web/public/app`. `scripts/build-mobile-web.sh`
 * (used by both `playwright.config.ts`'s local webServer and `ci.yml`) now
 * does that before these journeys run, so a broken `/app` route — a build
 * failure, a renamed route, a dead CTA — fails CI instead of silently
 * shipping a 404 behind a footer link.
 *
 * `apps/mobile` renders on web via `react-native-web`: `Pressable` becomes a
 * bare `<div tabindex="0">`, and until the accessibility sweep that added
 * `accessibilityRole="button"`/`"link"` to every Pressable across
 * `apps/mobile` it carried no ARIA role either, so `getByRole('button', …)`
 * could not find these controls and this spec used `getByText` instead. Now
 * that every interactive Pressable declares a role, `getByRole` is the
 * locator — using it here is itself the regression guard for that sweep: if
 * a future edit drops the role prop, these tests fail even though the text
 * is still on the page.
 */
test.describe('the /app product surface (apps/mobile web export)', () => {
  test('loads the real product demo, not a 404, with the primary voice CTA visible', async ({ page }) => {
    const response = await page.goto('/app');
    expect(response?.status()).toBe(200);

    await expect(
      page.getByRole('button', { name: 'स्वास्थ्य साथीसँग कुरा गर्नुहोस्' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'भिडियो कक्ष हेर्नुहोस्' })).toBeVisible();
  });

  test('the primary CTA reaches the AI companion demo — the surface the whole page exists to sell', async ({
    page,
  }) => {
    await page.goto('/app');
    await page.getByRole('button', { name: 'स्वास्थ्य साथीसँग कुरा गर्नुहोस्' }).click();

    await expect(page).toHaveURL(/\/app\/companion/);
    // The intake prompt, not just a route change — proves the tab actually
    // rendered rather than navigating to a blank/error screen.
    await expect(page.getByText('आज के भइरहेको छ?')).toBeVisible();
  });
});

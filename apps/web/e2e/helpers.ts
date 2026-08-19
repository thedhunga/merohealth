import { expect, type Page } from '@playwright/test';

/** Type a question on /get-care and submit it as a person would. */
export async function askOnGetCare(page: Page, message: string, locale: 'ne' | 'en' = 'ne') {
  await page.goto(locale === 'en' ? '/en/get-care' : '/get-care');
  const box = page.getByRole('textbox').first();
  await expect(box).toBeVisible();
  await box.fill(message);
  // Enter submits in the flow; the button is the fallback.
  await box.press('Enter');
  const submit = page.getByRole('button', { name: /सुरक्षित रूपमा जाँच्नुहोस्|Check safely|पठाउनुहोस्|Send/ });
  if (await submit.isVisible().catch(() => false)) await submit.click().catch(() => undefined);
}

/** Every interactive control on screen must meet the 44 px tap-target floor. */
export async function expectTapTargets(page: Page, minPx = 44) {
  const small = await page.evaluate((min) => {
    const els = [...document.querySelectorAll<HTMLElement>('a,button,[role=button],input,textarea,select')]
      // Skip links and screen-reader-only controls are hidden until focused;
      // their resting box is not a tap target.
      .filter((el) => !(el instanceof HTMLAnchorElement && el.getAttribute('href')?.startsWith('#')))
      .filter((el) => !String(el.className).split(/\s+/).some((c) => c === 'sr-only' || c.startsWith('sr-only')));
    return els
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { t: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((x) => x.w > 0 && x.h > 0 && (x.h < min || x.w < min));
  }, minPx);
  expect(small, `controls under ${minPx}px: ${JSON.stringify(small)}`).toEqual([]);
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow, 'page scrolls horizontally').toBe(false);
}

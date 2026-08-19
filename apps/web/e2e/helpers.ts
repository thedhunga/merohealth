import { expect, type Page } from '@playwright/test';

/**
 * Writes a pre-existing anonymous conversation to `localStorage` before the
 * page ever loads, matching `apps/web/src/lib/anonymous-history.ts`'s own
 * shape exactly. `page.addInitScript` runs before any page script, so the
 * value is already there when `HomeGate`/`GetCareFlow` read it on mount —
 * far more deterministic than performing the real ask-a-question flow just
 * to get a device into a "has history" state. `askedPrompts` defaults to
 * all three profile-prompt keys so a seeded "returning" device does not
 * also trip a profile prompt mid-journey; pass `[]` to test that path on
 * purpose.
 */
export async function seedAnonymousHistory(
  page: Page,
  exchanges: Array<{
    question: string;
    answer: string | null;
    outcome: 'answered' | 'emergency' | 'offTopic' | 'unavailable';
    language?: 'ne' | 'en';
  }>,
  askedPrompts: string[] = ['ageBand', 'askingFor', 'chronicCondition'],
) {
  const store = {
    version: 1,
    exchanges: exchanges.map((e, i) => ({
      id: `seed-${i}`,
      askedAt: new Date().toISOString(),
      language: e.language ?? 'ne',
      ...e,
    })),
    profile: { askedPrompts },
    usage: { monthKey: new Date().toISOString().slice(0, 7), secondsUsed: 0 },
  };
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    ['mero-health:anon-history', JSON.stringify(store)] as [string, string],
  );
}

/**
 * Intercepts `POST /api/companion/research` with a queue of canned
 * responses, one per call, in order — so a journey can exercise a real
 * multi-turn conversation without a live model call. The shape matches
 * `CompanionResearchResponse` (`apps/web/src/lib/companion-research.ts`).
 */
export async function mockResearchAnswers(
  page: Page,
  responses: Array<{ answer: string; advisory?: { kind: 'medicine' | 'advice'; medicines: string[] } }>,
) {
  let call = 0;
  await page.route('**/api/companion/research', async (route) => {
    const next = responses[Math.min(call, responses.length - 1)];
    call += 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        assessment: { riskLevel: 'LOW', interruptConversation: false },
        template: null,
        research: {
          provider: 'gemini-ungrounded',
          status: 'complete',
          answer: next.answer,
          citations: [],
          relatedQuestions: [],
          disclaimer: 'यो जानकारी अनुसन्धान र बुझाइका लागि मात्र हो, चिकित्सकीय सल्लाह होइन।',
          externalHealthHubUrl: null,
        },
        advisory: next.advisory ?? null,
        domain: 'HEALTH',
      }),
    });
  });
}

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

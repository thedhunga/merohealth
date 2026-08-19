import { expect, test } from '@playwright/test';

import { mockResearchAnswers, seedAnonymousHistory } from './helpers';

/**
 * Task U's second box: `docs/product/user-journey-gap.md` names three
 * personas — Sabina at 11 pm (already covered by
 * `safety.journeys.spec.ts`'s chest-pain test), a grandson asking on behalf
 * of his grandmother, and an English-speaking returnee. These two are new.
 * Each proves a real code path already read in the source, not a guess —
 * see the persona sections added to the gap doc alongside this file.
 */
test.describe('grandson asking for his grandmother', () => {
  test('a Nepali question about "हजुरआमा" gets an answer, then the one skippable question is "who is this for", not his own age', async ({
    page,
  }) => {
    await mockResearchAnswers(page, [
      { answer: 'घुँडाको दुखाइका लागि आराम गर्नुहोस् र चिसो-तातो सेकाइ गर्नुहोस्।' },
    ]);
    await page.goto('/get-care');

    const box = page.getByRole('textbox').first();
    const submit = page.getByRole('button', { name: /सुरक्षित रूपमा जाँच्नुहोस्|Check safely/ });
    await box.fill('हजुरआमालाई घुँडा दुखेको छ, के गर्ने?');
    await submit.click();

    await expect(page.getByText('घुँडाको दुखाइका लागि आराम गर्नुहोस्').first()).toBeVisible();

    // `nextProfilePrompt` (packages: apps/web/src/lib/profile-prompts.ts)
    // prioritises "who is this for" over age the moment `behalfWords`
    // matches — a grandmother is not one of the four named relations
    // ("आफ्नै", "बच्चा", "आमा/बुबा"), so this also proves "अरू कसैका लागि"
    // (other) is a real, reachable answer, not just a fallback that never
    // renders.
    const prompt = page.getByText('यो प्रश्न कसका लागि हो?');
    await expect(prompt).toBeVisible();
    await expect(page.getByText('तपाईंको उमेर कति हो?')).toHaveCount(0);

    await page.getByRole('button', { name: 'अरू कसैका लागि' }).click();
    await expect(prompt).toHaveCount(0);

    const stored = await page.evaluate(() => window.localStorage.getItem('mero-health:anon-history'));
    const parsed = JSON.parse(stored ?? '{}') as { profile?: { askingFor?: string; askedPrompts?: string[] } };
    expect(parsed.profile?.askingFor).toBe('other');
    expect(parsed.profile?.askedPrompts).toContain('askingFor');
  });
});

test.describe('English-speaking returnee', () => {
  test('a device with prior history sees the English home screen, not the marketing page, on /en', async ({
    page,
  }) => {
    await seedAnonymousHistory(page, [
      { question: 'What can I take for a fever?', answer: 'Rest and drink plenty of fluids.', outcome: 'answered', language: 'en' },
    ]);
    await page.goto('/en');

    // `homeVariant` (apps/web/src/lib/home-screen.ts) returns `'returning'`
    // for any device with history regardless of locale — only a first visit
    // branches on language. This is the one guarantee this journey exists to
    // lock in: an English reader who has already used the product once does
    // not get routed back to the full marketing pitch.
    const card = page.getByRole('button', { name: /Last conversation/ });
    await expect(card).toBeVisible();
    await expect(card).toContainText('What can I take for a fever?');
    await expect(card).toContainText('Rest and drink plenty of fluids.');
    await expect(page.getByText('Speak').first()).toBeVisible();

    // The full marketing homepage (`Testimonials`, `home.testimonials.heading`
    // in the messages files) is what a first-time /en visitor sees instead —
    // its absence here is the actual assertion that the returning-visitor
    // branch, not the marketing one, rendered.
    await expect(page.getByText('Helping people live their healthiest lives')).toHaveCount(0);

    await card.click();
    await expect(page).toHaveURL(/\/en\/get-care/);
  });
});

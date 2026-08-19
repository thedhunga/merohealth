import { expect, test } from '@playwright/test';

import { mockResearchAnswers, seedAnonymousHistory } from './helpers';

/**
 * Round seven built a returning-visitor home screen, a conversation thread,
 * an install prompt, a real dark theme and an offline page — task U's
 * standing rule ("no journey, not done") means each of those needs its own
 * real-situation Playwright coverage, not just the unit tests already
 * colocated with their source. `/api/companion/research` is mocked
 * throughout rather than gated behind `E2E_LIVE`: these journeys prove the
 * UI Round seven actually built, not the research provider's answer
 * quality — that is `premium-and-answers.journeys.spec.ts`'s job.
 */
test.describe('returning-visitor home screen (task O)', () => {
  test('a device with one prior answered exchange sees "पछिल्लो कुराकानी" and can reopen it', async ({ page }) => {
    await seedAnonymousHistory(page, [
      { question: 'ज्वरो आएको छ, के गर्ने?', answer: 'आराम गर्नुहोस् र धेरै पानी पिउनुहोस्।', outcome: 'answered' },
    ]);
    await page.goto('/');

    const card = page.getByRole('button', { name: /पछिल्लो कुराकानी/ });
    await expect(card).toBeVisible();
    await expect(card).toContainText('ज्वरो आएको छ');
    await expect(card).toContainText('आराम गर्नुहोस्');

    // The full marketing page (hero, service cards, footer sections) is not
    // what a returning visitor gets — the mic is still the hero, above it.
    await expect(page.getByText('बोल्नुहोस्').first()).toBeVisible();

    await card.click();
    await expect(page).toHaveURL(/\/get-care/);
  });

  test('an emergency exchange still counts as history, and shows its outcome label rather than a stored answer', async ({
    page,
  }) => {
    await seedAnonymousHistory(page, [
      { question: 'छाती दुखेको छ, सास फेर्न गाह्रो', answer: null, outcome: 'emergency' },
    ]);
    await page.goto('/');
    const card = page.getByRole('button', { name: /पछिल्लो कुराकानी/ });
    await expect(card).toContainText('आपतकालीन सहयोगतर्फ पठाइयो');
  });
});

test.describe('conversation mode thread (task P/Q)', () => {
  test('two typed turns render as chat bubbles, and the advisory appears only under the turn that earned it', async ({
    page,
  }) => {
    await mockResearchAnswers(page, [
      { answer: 'ज्वरोको लागि आराम गर्नुहोस् र धेरै तरल पदार्थ लिनुहोस्।' },
      {
        answer: 'ज्वरो घटाउन प्यारासिटामोल लिन सकिन्छ।',
        advisory: { kind: 'medicine', medicines: ['Paracetamol'] },
      },
    ]);

    await page.goto('/get-care');
    const box = page.getByRole('textbox').first();
    // A <textarea> does not submit its form on Enter (unlike <input>) — the
    // real submit control is the button, which is also what a person taps.
    const submit = page.getByRole('button', { name: /सुरक्षित रूपमा जाँच्नुहोस्|Check safely/ });

    await box.fill('मलाई ज्वरो आएको छ');
    await submit.click();

    const thread = page.getByRole('list', { name: /तपाईंको कुराकानी|Your conversation/ });
    const firstAnswer = thread.getByRole('listitem').filter({ hasText: 'आराम गर्नुहोस्' });
    await expect(firstAnswer).toBeVisible();
    // The first answer earned no advisory — its bubble must not carry one.
    await expect(firstAnswer.getByRole('note')).toHaveCount(0);

    await box.fill('औषधि खान मिल्छ?');
    await submit.click();

    const secondAnswer = thread.getByRole('listitem').filter({ hasText: 'प्यारासिटामोल लिन सकिन्छ' });
    await expect(secondAnswer.getByRole('note')).toBeVisible();
    await expect(secondAnswer.getByRole('note')).toContainText('चिकित्सक');
    // The advisory sits inside the second turn's own bubble, not the first's.
    await expect(firstAnswer.getByRole('note')).toHaveCount(0);

    // Four bubbles total: one user + one assistant turn, twice over.
    await expect(thread.getByRole('listitem')).toHaveCount(4);
    await expect(thread.getByRole('listitem').filter({ hasText: 'मलाई ज्वरो आएको छ' })).toHaveCount(1);
    await expect(thread.getByRole('listitem').filter({ hasText: 'औषधि खान मिल्छ' })).toHaveCount(1);
  });
});

test.describe('the second-answer reaction card (task R)', () => {
  test('after two answered turns, the sign-in suggestion shows — the install prompt cannot, since it shares the same trigger with no dismiss', async ({
    page,
  }) => {
    // A real finding from writing this journey, not a hypothetical: `InstallPrompt`
    // and `SignInSuggestion` (GetCareFlow.tsx) both fire on the exact same
    // `answeredCount >= 2` threshold, set in the same handler call, and
    // `SignInSuggestion` has no dismiss (unlike `UpsellCard`/`InstallPrompt`,
    // which both persist a dismissal forever). The render stack always
    // prefers `!suggestSignIn` for the install card, so once two answers
    // land, `SignInSuggestion` wins — permanently, for the rest of that
    // browser's history — and the install prompt this ledger's task R asked
    // for can never actually reach the screen. Logged as a real product gap
    // rather than fixed here: changing card priority or adding a dismiss is
    // a UX call for the owner, out of scope for "add journeys". This test
    // locks in the real, current behaviour so a silent regression (or a
    // silent "fix" that changes it without updating this test) is visible
    // either way.
    // No prior history, but the profile-prompt reaction (higher priority
    // than either sign-in or install) fires on this exact second answer too
    // unless every prompt key is pre-marked asked — seeded here so the test
    // isolates the sign-in/install race it's actually about.
    await seedAnonymousHistory(page, []);
    await mockResearchAnswers(page, [{ answer: 'पहिलो जवाफ।' }, { answer: 'दोस्रो जवाफ।' }]);
    await page.goto('/get-care');
    const box = page.getByRole('textbox').first();
    const submit = page.getByRole('button', { name: /सुरक्षित रूपमा जाँच्नुहोस्|Check safely/ });

    await box.fill('पहिलो प्रश्न');
    await submit.click();
    await expect(page.getByText('पहिलो जवाफ।').first()).toBeVisible();

    await box.fill('दोस्रो प्रश्न');
    await submit.click();
    await expect(page.getByText('दोस्रो जवाफ।').first()).toBeVisible();

    // The header nav carries its own "साइन इन" link on wide viewports, so
    // scope to the reaction card's own CTA by its distinct href rather than
    // risk a strict-mode ambiguity between the two.
    await expect(page.locator('a[href="/signin?next=/get-care"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /फोनमा राख्नुहोस्/ })).toHaveCount(0);
  });
});

test.describe('dark mode toggle persists (task T)', () => {
  test('toggling dark mode on /account survives a reload', async ({ page }) => {
    // /account is session-gated by a call to apps/api, which is not
    // deployed in this environment (see HANDOFF.md) — mocked here so the
    // journey exercises the real toggle rather than only the storage layer
    // `useTheme.test.ts` already covers in isolation.
    await page.route('**/v1/auth/me', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 'e2e-user',
          phone: '9800000000',
          role: 'PATIENT',
          locale: 'ne',
          patientProfileId: null,
          assuranceLevel: 'REGISTERED',
        }),
      });
    });

    await page.goto('/account');
    const toggle = page.locator('#account-theme-dark');
    await expect(toggle).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');

    // The native checkbox is `sr-only` — the visible switch pill sits on top
    // of it by design (same pattern as CorpusConsentToggle), so a real tap
    // never lands on the input itself either; `force` skips the pointer-
    // interception check rather than fighting the component's own styling.
    await toggle.click({ force: true });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('mero-theme'))).toBe('dark');

    // The real test of "persists": a cold reload re-applies it before paint,
    // from the inline init script in layout.tsx — not from React state.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('#account-theme-dark')).toBeChecked();
  });
});

test.describe('offline page (task R)', () => {
  test('/offline renders the fixed emergency template, not a blank error page', async ({ page }) => {
    await page.goto('/offline');
    await expect(page.getByRole('heading', { level: 1, name: /इन्टरनेट जडान छैन|No internet connection/ })).toBeVisible();
    await expect(page.getByText('आपतकालीन अवस्थामा')).toBeVisible();
    // The exact fixed safety template from packages/clinical-safety — never
    // paraphrased, since this is the one screen that must work with no
    // network and no model to fall back on.
    await expect(page.getByText(/यो आपतकालीन अवस्था हुन सक्छ/)).toBeVisible();
  });

  test('/en/offline renders the English emergency template', async ({ page }) => {
    await page.goto('/en/offline');
    await expect(page.getByRole('heading', { level: 1, name: 'No internet connection' })).toBeVisible();
    await expect(page.getByText(/This may be an emergency/)).toBeVisible();
  });
});

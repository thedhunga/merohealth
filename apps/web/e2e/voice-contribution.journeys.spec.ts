import { expect, test } from './fixtures';

import { mockCorpusConsent, mockSignedInSession, mockVoiceClipSubmit, mockVoiceRecorder } from './helpers';

/**
 * `/contribute` (Round six §M's third box) had zero e2e coverage — flagged
 * as the queue's one remaining lead across several runs (tasks YYY, ZZZ) and
 * repeatedly deferred as "a dedicated task... not a quick follow-on." It
 * turned out smaller than that framing: the session mock
 * `round-seven.journeys.spec.ts` already built for `/account` covers the
 * first gate outright, and consent-seeding is the same `page.route`
 * technique applied to a second endpoint. The one genuinely new piece is
 * `mockVoiceRecorder` (`helpers.ts`), faking `getUserMedia`/`MediaRecorder`
 * so the recording states are exercised for real rather than skipped.
 *
 * This route is deliberately not health content (`content/voice-contribution.ts`'s
 * own doc comment: "no factual claim to get wrong"), so unlike every other
 * journey file here, none of `clinical-safety`'s interception applies —
 * there is nothing to assert about it.
 */
test.describe('/contribute — session and consent gates', () => {
  test('an anonymous visitor is redirected to sign in, carrying the page they were trying to reach', async ({ page }) => {
    await page.route('**/v1/auth/me', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'UNAUTHENTICATED' }) });
    });

    await page.goto('/contribute');

    await expect(page).toHaveURL(/\/signin/);
    const url = new URL(page.url());
    expect(url.pathname).toBe('/signin');
    expect(url.searchParams.get('next')).toBe('/contribute');
  });

  test('a signed-in visitor with no Voice Contribution consent sees the consent gate, and granting it reveals the self-report form', async ({
    page,
  }) => {
    await mockSignedInSession(page);
    await mockCorpusConsent(page, false);
    await page.goto('/contribute');

    await expect(page.getByRole('heading', { name: 'आफ्नो आवाज योगदान गर्नुहोस्' })).toBeVisible();
    const grantButton = page.getByRole('button', { name: 'सहमत छु, अगाडि बढ्नुहोस्' });
    await expect(grantButton).toBeVisible();
    // Not yet the self-report form — the gate must actually block it.
    await expect(page.getByLabel('जिल्ला')).toHaveCount(0);

    await grantButton.click();

    await expect(page.getByLabel('जिल्ला')).toBeVisible();
    await expect(grantButton).toHaveCount(0);
  });
});

test.describe('/contribute — self-report and the recording tasks', () => {
  test('a consented visitor completes the self-report and reaches the first recording task', async ({ page }) => {
    await mockSignedInSession(page);
    await mockCorpusConsent(page, true);
    await page.goto('/contribute');

    await page.getByLabel('जिल्ला').fill('काठमाडौं');
    await page.getByLabel('मातृभाषा').selectOption({ label: 'नेपाली' });
    await page.getByLabel('उमेर').selectOption({ label: '२५–३४' });
    await page.getByRole('button', { name: 'अगाडि बढ्नुहोस्' }).click();

    await expect(page.getByRole('heading', { name: 'यो हरफ पढेर सुनाउनुहोस्' })).toBeVisible();
    await expect(page.getByText('आज आकाश खुल्ला छ र घाम लागेको छ।')).toBeVisible();
    await expect(page.getByRole('button', { name: 'रेकर्ड गर्नुहोस्' })).toBeVisible();
  });

  test('recording, reviewing and submitting all five tasks reaches the done panel', async ({ page }) => {
    await mockSignedInSession(page);
    await mockCorpusConsent(page, true);
    await mockVoiceClipSubmit(page);
    await mockVoiceRecorder(page);
    await page.goto('/contribute');

    await page.getByLabel('जिल्ला').fill('काठमाडौं');
    await page.getByLabel('मातृभाषा').selectOption({ label: 'नेपाली' });
    await page.getByLabel('उमेर').selectOption({ label: '२५–३४' });
    await page.getByRole('button', { name: 'अगाडि बढ्नुहोस्' }).click();

    for (let i = 0; i < 5; i += 1) {
      await page.getByRole('button', { name: 'रेकर्ड गर्नुहोस्' }).click();
      await expect(page.getByText(/रेकर्ड हुँदैछ/)).toBeVisible();

      await page.getByRole('button', { name: 'रोक्नुहोस्' }).click();
      await expect(page.locator('audio')).toBeVisible();

      await page.getByRole('button', { name: 'पेश गर्नुहोस्' }).click();
      // Each task unmounts (`key={currentTask.id}`) once its submit resolves —
      // wait for the recorded audio preview to clear before starting the next
      // one, otherwise a fast mock can race two tasks' "स्टार्ट" buttons.
      await expect(page.locator('audio')).toHaveCount(0);
    }

    await expect(page.getByRole('heading', { name: 'धन्यवाद' })).toBeVisible();
  });
});

test.describe('/contribute — English locale', () => {
  test('/en/contribute renders the consent gate in English', async ({ page }) => {
    await mockSignedInSession(page, { locale: 'en' });
    await mockCorpusConsent(page, false);
    await page.goto('/en/contribute');

    await expect(page.getByRole('heading', { name: 'Contribute your voice' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agree and continue' })).toBeVisible();
  });
});

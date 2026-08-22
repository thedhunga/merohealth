import { expect, test } from './fixtures';

import { mockSignedInSession, mockVoiceValidationQueue } from './helpers';

/**
 * `/validate` (Round six §M's Validation flow box, the crowd-verification
 * side of the corpus) had zero e2e coverage — `/contribute`'s sibling gap,
 * closed the same way its own journey was: `mockSignedInSession` covers the
 * session gate outright, and a queue-shaped route mock
 * (`mockVoiceValidationQueue`) drives `fetchNextClipToValidate` /
 * `fetchClipAudio` / `submitClipValidation` without a live API. Unlike
 * `/contribute` there is no consent gate here — `VoiceValidationView`'s own
 * doc comment explains why (judging someone else's already-consented clip is
 * not itself a new act of contributing).
 *
 * Also not health content, so `clinical-safety` interception does not apply
 * — same reasoning as `voice-contribution.journeys.spec.ts`.
 */
test.describe('/validate — session gate', () => {
  test('an anonymous visitor is redirected to sign in, carrying the page they were trying to reach', async ({ page }) => {
    await page.route('**/v1/auth/me', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'UNAUTHENTICATED' }) });
    });

    await page.goto('/validate');

    await expect(page).toHaveURL(/\/signin/);
    const url = new URL(page.url());
    expect(url.pathname).toBe('/signin');
    expect(url.searchParams.get('next')).toBe('/validate');
  });
});

test.describe('/validate — judging clips', () => {
  test('a signed-in visitor sees a clip to judge, and voting advances to the next one', async ({ page }) => {
    await mockSignedInSession(page);
    await mockVoiceValidationQueue(page, [
      { id: 'clip-1', taskKind: 'READ_PROMPT' },
      { id: 'clip-2', taskKind: 'FREE_SPEECH' },
    ]);
    await page.goto('/validate');

    await expect(page.getByRole('heading', { name: 'नेपाली रेकर्डिङ जाँच्न सघाउनुहोस्' })).toBeVisible();
    await expect(page.getByText('उनीहरूलाई यो हरफ पढेर सुनाउन भनिएको थियो')).toBeVisible();
    await expect(page.locator('audio')).toBeVisible();

    await page.getByRole('button', { name: 'ठीक' }).click();

    await expect(page.getByText('उनीहरूलाई यसको जवाफ आफ्नै शब्दमा दिन भनिएको थियो')).toBeVisible();
  });

  test('judging the last clip reaches the done panel', async ({ page }) => {
    await mockSignedInSession(page);
    await mockVoiceValidationQueue(page, [{ id: 'clip-1', taskKind: 'READ_PROMPT' }]);
    await page.goto('/validate');

    await expect(page.locator('audio')).toBeVisible();
    await page.getByRole('button', { name: 'गलत' }).click();

    await expect(page.getByRole('heading', { name: 'अहिलेलाई जाँच्नुपर्ने केही छैन' })).toBeVisible();
  });

  test('a clip someone else just resolved is skipped quietly, with no error banner', async ({ page }) => {
    await mockSignedInSession(page);
    await mockVoiceValidationQueue(page, [{ id: 'clip-1', taskKind: 'READ_PROMPT' }], 'CLIP_ALREADY_RESOLVED');
    await page.goto('/validate');

    await expect(page.locator('audio')).toBeVisible();
    await page.getByRole('button', { name: 'अस्पष्ट' }).click();

    // The queue is exhausted after this one clip, and the race is swallowed
    // silently (`RACE_ERROR_CODES` in `VoiceValidationView.tsx`) rather than
    // shown as an error — done panel, no error text.
    await expect(page.getByRole('heading', { name: 'अहिलेलाई जाँच्नुपर्ने केही छैन' })).toBeVisible();
    await expect(page.getByText('केही गडबड भयो — फेरि प्रयास गर्नुहोस्।')).toHaveCount(0);
  });
});

test.describe('/validate — English locale', () => {
  test('/en/validate renders the queue in English', async ({ page }) => {
    await mockSignedInSession(page, { locale: 'en' });
    await mockVoiceValidationQueue(page, [{ id: 'clip-1', taskKind: 'READ_PROMPT' }]);
    await page.goto('/en/validate');

    await expect(page.getByRole('heading', { name: 'Help check Nepali recordings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Right' })).toBeVisible();
  });
});

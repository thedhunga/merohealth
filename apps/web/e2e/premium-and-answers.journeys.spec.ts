import { expect, test } from './fixtures';

test.describe('premium is visible but not for sale (owner decision 2026-08-18)', () => {
  test('/pricing shows no rupee price for Plus/Pro, offers "be first", and the form works', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText(/छिट्टै आउँदैछ|Coming soon/).first()).toBeVisible();
    // No Plus/Pro price anywhere on the page.
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/रु\s?४९९|रु\s?१,४९९|Rs\s?499|Rs\s?1,499/);
    // Free CTA goes to the assistant, not a dead register page.
    const free = page.getByRole('link', { name: /नि:शुल्क सुरु गर्नुहोस्|Start free/ }).first();
    await expect(free).toHaveAttribute('href', /get-care/);
    // Register interest.
    await page.getByRole('textbox').first().fill('98 4123 4567');
    await page.getByRole('button', { name: /मलाई पहिलो बनाउनुहोस्|Make me first/ }).click();
    await expect(page.getByText(/तपाईं सूचीमा हुनुहुन्छ|You're on the list/)).toBeVisible();
    const stored = await page.evaluate(() => localStorage.getItem('mero-health:early-access'));
    expect(stored).toContain('"contact":"9841234567"');
  });

  test('a junk contact is refused kindly, empty is allowed', async ({ page }) => {
    await page.goto('/pricing');
    await page.getByRole('textbox').first().fill('12345');
    await page.getByRole('button', { name: /मलाई पहिलो बनाउनुहोस्|Make me first/ }).click();
    await expect(page.getByText(/कृपया १० अङ्कको|Please enter a 10-digit/)).toBeVisible();
    await page.getByRole('textbox').first().fill('');
    await page.getByRole('button', { name: /मलाई पहिलो बनाउनुहोस्|Make me first/ }).click();
    await expect(page.getByText(/तपाईं सूचीमा हुनुहुन्छ|You're on the list/)).toBeVisible();
  });
});

/**
 * @live — needs a real research answer (a Gemini call). Skipped unless
 * E2E_LIVE=1 so CI on a key-less runner stays green and meaningful.
 */
test.describe('answers @live', () => {
  test.skip(!process.env.E2E_LIVE, 'set E2E_LIVE=1 to exercise the live research provider');

  test('mother with a feverish child asks about paracetamol → Nepali answer with a medicine advisory', async ({ request }) => {
    const res = await request.post('/api/companion/research', {
      data: { message: 'बच्चालाई ज्वरो आउँदा सिटामोल दिन मिल्छ? कति दिने?', language: 'ne' },
    });
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as {
      domain: string;
      research: { status: string; answer: string | null; provider: string; diagnostic?: string } | null;
      advisory: { kind: string; medicines: string[] } | null;
    };
    expect(body.domain).toBe('HEALTH');
    // `diagnostic` (HealthResearch's own doc comment: "so a failing production
    // call can be diagnosed from its own response instead of from server logs
    // nobody is watching") is unused by anything else this request fixture has
    // — no `page`, so `fixtures.ts`'s console/error forwarding never runs here.
    // Passing it as the assertion message means a real provider failure names
    // its own upstream HTTP status and quota reason in the job log directly,
    // instead of the bare "Expected complete, Received unavailable" that sent
    // task AAA hunting through source for an explanation it could not get.
    expect(body.research?.status, `provider=${body.research?.provider} diagnostic=${body.research?.diagnostic}`).toBe(
      'complete',
    );
    expect(body.research?.answer ?? '').toMatch(/[ऀ-ॿ]/); // Devanagari
    expect(body.advisory?.kind).toBe('medicine');
    expect(body.advisory?.medicines.length).toBeGreaterThan(0);
  });

  test('a follow-up turn is answered in the context of the previous one', async ({ request }) => {
    const res = await request.post('/api/companion/research', {
      data: {
        message: 'उनी ६ महिनाकी मात्र छिन्, तै पनि दिन मिल्छ?',
        language: 'ne',
        turns: [
          { role: 'user', text: 'बच्चालाई ज्वरो आउँदा सिटामोल दिन मिल्छ?' },
          { role: 'assistant', text: 'हो, सामान्यतया प्यारासिटामोल दिन मिल्छ, तर उमेर र तौल अनुसार मात्रा फरक हुन्छ।' },
        ],
      },
    });
    const body = (await res.json()) as {
      research: { status: string; answer: string | null; provider: string; diagnostic?: string } | null;
    };
    expect(body.research?.status, `provider=${body.research?.provider} diagnostic=${body.research?.diagnostic}`).toBe(
      'complete',
    );
    expect(body.research?.answer ?? '').toMatch(/महिना|शिशु|बच्चा/);
  });
});

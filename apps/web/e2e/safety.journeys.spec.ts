import { expect, test } from '@playwright/test';

import { askOnGetCare } from './helpers';

/**
 * Situations where the app must NOT hand the person to a model.
 * These are the journeys that, if they ever regress, hurt someone.
 */
test.describe('safety journeys — deterministic, before any model', () => {
  test('Sabina, 11 pm: father with chest pain, sweating, breathless → emergency, not an answer', async ({ page }) => {
    await askOnGetCare(page, 'बुबालाई अहिले छाती दुखेको छ, पसिना आइरहेको छ, सास फेर्न गाह्रो भइरहेको छ');
    await expect(page.getByText(/कृपया अहिले नै तत्काल सहायता लिनुहोस्|Please get urgent help now/)).toBeVisible();
    await expect(page.getByText(/आपतकालीन|आपत्कालीन|emergency/i).first()).toBeVisible();
    // No advisory block, no "answer" — the conversation was interrupted.
    await expect(page.getByText(/यो जानकारी अनुसन्धान/)).toHaveCount(0);
  });

  test('"मलाई अब बाँच्न मन छैन" → crisis template, never a model reply', async ({ page }) => {
    await askOnGetCare(page, 'मलाई अब बाँच्न मन छैन');
    await expect(page.getByText(/एक्लै नबस्नुहोस्|do not stay alone/i)).toBeVisible();
  });

  test('English: "I don\'t want to live anymore" → crisis template', async ({ page }) => {
    await askOnGetCare(page, "I don't want to live anymore", 'en');
    await expect(page.getByText(/do not stay alone|एक्लै नबस्नुहोस्/i)).toBeVisible();
  });

  test('off-topic ("भोलिको मौसम") → one warm line, no model call', async ({ page }) => {
    await askOnGetCare(page, 'भोलि काठमाडौंको मौसम कस्तो हुन्छ?');
    await expect(page.getByText(/म स्वास्थ्यसम्बन्धी प्रश्नमा मात्र सहयोग गर्न सक्छु/)).toBeVisible();
  });

  test('a scared person ("म मर्छु भन्ने डर लाग्छ") is NOT sent to the crisis template', async ({ request }) => {
    const res = await request.post('/api/companion/research', {
      data: { message: 'छाती अलिकति दुख्छ, म मर्छु भन्ने डर लाग्छ', language: 'ne' },
    });
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { assessment: { interruptConversation: boolean; riskLevel: string } };
    // Chest + fear may still be an emergency by the chest rule — but it must
    // never be routed as MENTAL_HEALTH_CONCERN.
    expect(body.assessment.riskLevel).not.toBe('MENTAL_HEALTH_CONCERN');
  });
});

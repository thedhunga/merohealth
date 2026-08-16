import { afterEach, describe, expect, it, vi } from 'vitest';
import { PerplexityHealthService } from './perplexity-health.service.js';

describe('PerplexityHealthService', () => {
  // No PERPLEXITY_API_KEY in the test environment, so every call resolves via
  // the 'setup-required' branch without a network call — exercising exactly
  // the disclaimer text assembled before the early return.
  it('returns the English disclaimer for en', async () => {
    const result = await new PerplexityHealthService().research('What is diabetes?', 'en');
    expect(result.disclaimer).toBe(
      'General health information only. This is not a diagnosis or a treatment recommendation.',
    );
  });

  it('returns the Devanagari disclaimer for ne', async () => {
    const result = await new PerplexityHealthService().research('मधुमेह के हो?', 'ne');
    expect(result.disclaimer).toBe(
      'यो सामान्य स्वास्थ्य जानकारी मात्र हो। यो निदान वा उपचार सिफारिस होइन।',
    );
  });

  // Regression test: ne-Latn previously fell through to the Devanagari branch,
  // handing a Romanized-Nepali reader a script they may not be able to read.
  it('returns a Romanized-Nepali disclaimer for ne-Latn, not the Devanagari fallback', async () => {
    const result = await new PerplexityHealthService().research('madhumeh k ho?', 'ne-Latn');
    expect(result.disclaimer).toBe(
      'Yo samanya swasthya jankari matra ho. Yo nidan wa upachar sifaris hoina.',
    );
  });

  // The setup-required tests above never reach the network call, so the
  // catch block that is the only thing standing between a Perplexity outage
  // and a companion-route 500 had zero coverage — the API-side sibling of
  // the same gap fixed in apps/web/src/server/gemini-health.test.ts.
  describe('when the API key is configured but the network is down', () => {
    const originalKey = process.env['PERPLEXITY_API_KEY'];

    afterEach(() => {
      vi.unstubAllGlobals();
      if (originalKey === undefined) delete process.env['PERPLEXITY_API_KEY'];
      else process.env['PERPLEXITY_API_KEY'] = originalKey;
    });

    it('reports unavailable, keeps the disclaimer, and never throws', async () => {
      process.env['PERPLEXITY_API_KEY'] = 'test-key';
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

      const result = await new PerplexityHealthService().research('What is diabetes?', 'en');

      expect(result).toEqual({
        provider: 'perplexity-sonar',
        status: 'unavailable',
        answer: null,
        citations: [],
        relatedQuestions: [],
        disclaimer:
          'General health information only. This is not a diagnosis or a treatment recommendation.',
        externalHealthHubUrl: 'https://www.perplexity.ai/health',
      });
    });
  });
});

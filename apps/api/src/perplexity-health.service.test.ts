import { describe, expect, it } from 'vitest';
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
});

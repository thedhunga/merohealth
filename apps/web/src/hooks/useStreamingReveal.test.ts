import { describe, expect, it } from 'vitest';
import { buildWordReveal, revealStepDelayMs } from './useStreamingReveal';

describe('buildWordReveal', () => {
  it('returns one growing prefix per word', () => {
    expect(buildWordReveal('lie down and rest')).toEqual([
      'lie ',
      'lie down ',
      'lie down and ',
      'lie down and rest',
    ]);
  });

  it('every prefix is an exact substring of the source text', () => {
    const text = 'दिनको तीन पटक पानी पिउनुहोस्।\nभोलि फेरि जाँच गर्नुहोस्।';
    const prefixes = buildWordReveal(text);
    for (const prefix of prefixes) {
      expect(text.startsWith(prefix)).toBe(true);
    }
    expect(prefixes.at(-1)).toBe(text);
  });

  it('preserves internal newlines rather than collapsing them to spaces', () => {
    const prefixes = buildWordReveal('first line\nsecond line');
    expect(prefixes.join('')).not.toContain('  ');
    expect(prefixes.at(-1)).toBe('first line\nsecond line');
  });

  it('returns the whole string as the only prefix for empty or whitespace-only text', () => {
    expect(buildWordReveal('')).toEqual(['']);
    expect(buildWordReveal('   ')).toEqual(['   ']);
  });

  it('returns a single prefix for one word', () => {
    expect(buildWordReveal('ठीक')).toEqual(['ठीक']);
  });
});

describe('revealStepDelayMs', () => {
  it('is zero for zero or one word — nothing to stream', () => {
    expect(revealStepDelayMs(0)).toBe(0);
    expect(revealStepDelayMs(1)).toBe(0);
  });

  it('keeps a short answer near-instant rather than crawling', () => {
    // 3 words * 28ms/word = 84ms, floored to the 240ms minimum total.
    expect(revealStepDelayMs(3)).toBeCloseTo(80, 0);
  });

  it('scales linearly with word count inside the min/max band', () => {
    // 20 words * 28ms/word = 560ms total, comfortably inside [240, 1400].
    expect(revealStepDelayMs(20)).toBeCloseTo(28, 5);
  });

  it('caps the total reveal duration for a long answer', () => {
    // 200 words * 28ms/word = 5600ms, capped to the 1400ms maximum total.
    expect(revealStepDelayMs(200)).toBeCloseTo(7, 1);
  });
});

import { describe, expect, it } from 'vitest';
import { shouldAnimateReveal } from './useReveal';

function mm(answers: Record<string, boolean>) {
  return (query: string) => ({ matches: answers[query] ?? false });
}

describe('shouldAnimateReveal', () => {
  it('animates when the browser has no reduced-motion preference', () => {
    expect(shouldAnimateReveal({ matchMedia: mm({ '(prefers-reduced-motion: reduce)': false }) })).toBe(true);
  });

  it('does not animate when prefers-reduced-motion is set', () => {
    expect(shouldAnimateReveal({ matchMedia: mm({ '(prefers-reduced-motion: reduce)': true }) })).toBe(false);
  });

  it('defaults to animate when matchMedia is unavailable', () => {
    expect(shouldAnimateReveal({})).toBe(true);
    expect(shouldAnimateReveal()).toBe(true);
  });
});

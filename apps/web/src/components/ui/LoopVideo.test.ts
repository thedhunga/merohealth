import { describe, expect, it } from 'vitest';

import { shouldPlayAmbientLoop } from './LoopVideo';

const mm = (answers: Record<string, boolean>) => (q: string) => ({ matches: answers[q] ?? false });

describe('shouldPlayAmbientLoop — never spend a phone\'s data on decoration', () => {
  it('plays on a wide screen with a good connection', () => {
    expect(
      shouldPlayAmbientLoop(768, {
        matchMedia: mm({ '(min-width: 768px)': true }),
        connection: { effectiveType: '4g' },
      }),
    ).toBe(true);
  });

  it('never plays at phone width', () => {
    expect(shouldPlayAmbientLoop(768, { matchMedia: mm({ '(min-width: 768px)': false }) })).toBe(false);
  });

  it('respects reduced motion even on desktop', () => {
    expect(
      shouldPlayAmbientLoop(768, {
        matchMedia: mm({ '(min-width: 768px)': true, '(prefers-reduced-motion: reduce)': true }),
      }),
    ).toBe(false);
  });

  it('respects Save-Data and slow connections', () => {
    const wide = mm({ '(min-width: 768px)': true });
    expect(shouldPlayAmbientLoop(768, { matchMedia: wide, connection: { saveData: true } })).toBe(false);
    expect(shouldPlayAmbientLoop(768, { matchMedia: wide, connection: { effectiveType: '3g' } })).toBe(false);
    expect(shouldPlayAmbientLoop(768, { matchMedia: wide, connection: { effectiveType: '2g' } })).toBe(false);
  });

  it('plays when the browser exposes no connection info (desktop Safari/Firefox)', () => {
    expect(shouldPlayAmbientLoop(768, { matchMedia: mm({ '(min-width: 768px)': true }) })).toBe(true);
  });

  it('is poster-only when matchMedia is unavailable (SSR)', () => {
    expect(shouldPlayAmbientLoop(768, {})).toBe(false);
  });
});

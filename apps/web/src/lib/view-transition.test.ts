import { describe, expect, it, vi } from 'vitest';
import { runWithViewTransition, shouldUseViewTransition } from './view-transition';

function mm(answers: Record<string, boolean>) {
  return (query: string) => ({ matches: answers[query] ?? false });
}

function fakeDocument(startViewTransition?: (run: () => void) => void) {
  return startViewTransition ? { startViewTransition } : {};
}

describe('shouldUseViewTransition', () => {
  it('is false without a `document` at all', () => {
    expect(shouldUseViewTransition()).toBe(false);
  });

  it('is false when the document has no startViewTransition (unsupported browser)', () => {
    expect(shouldUseViewTransition({ document: fakeDocument() })).toBe(false);
  });

  it('is true when supported and no reduced-motion preference is set', () => {
    const env = { document: fakeDocument(vi.fn()), matchMedia: mm({ '(prefers-reduced-motion: reduce)': false }) };
    expect(shouldUseViewTransition(env)).toBe(true);
  });

  it('is false under prefers-reduced-motion even when the API exists', () => {
    const env = { document: fakeDocument(vi.fn()), matchMedia: mm({ '(prefers-reduced-motion: reduce)': true }) };
    expect(shouldUseViewTransition(env)).toBe(false);
  });

  it('defaults to true when matchMedia is unavailable but the API exists', () => {
    expect(shouldUseViewTransition({ document: fakeDocument(vi.fn()) })).toBe(true);
  });
});

describe('runWithViewTransition', () => {
  it('runs immediately, without the API, when unsupported', () => {
    const run = vi.fn();
    runWithViewTransition(run, { document: fakeDocument() });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs immediately under prefers-reduced-motion, without calling startViewTransition', () => {
    const startViewTransition = vi.fn();
    const run = vi.fn();
    runWithViewTransition(run, {
      document: fakeDocument(startViewTransition),
      matchMedia: mm({ '(prefers-reduced-motion: reduce)': true }),
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it('hands `run` to startViewTransition directly when no flushSync is given', () => {
    const startViewTransition = vi.fn((callback: () => void) => callback());
    const run = vi.fn();
    runWithViewTransition(run, {
      document: fakeDocument(startViewTransition),
      matchMedia: mm({ '(prefers-reduced-motion: reduce)': false }),
    });
    expect(startViewTransition).toHaveBeenCalledWith(run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('routes `run` through flushSync, inside startViewTransition, when flushSync is given', () => {
    const startViewTransition = vi.fn((callback: () => void) => callback());
    const flushSync = vi.fn((callback: () => void) => callback());
    const run = vi.fn();
    runWithViewTransition(run, {
      document: fakeDocument(startViewTransition),
      matchMedia: mm({ '(prefers-reduced-motion: reduce)': false }),
      flushSync,
    });
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(flushSync).toHaveBeenCalledWith(run);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

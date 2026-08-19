import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  consumeCareListenIntent,
  consumeCareQuestion,
  storeCareListenIntent,
  storeCareQuestion,
} from '@/lib/get-care-session';

/** Same hand-rolled storage fake `install-prompt.test.ts` uses for `localStorage`. */
function createFakeSessionStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  } as unknown as Storage;
}

describe('get-care session handoff', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { sessionStorage: createFakeSessionStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('carries the question from the home screen to /get-care exactly once', () => {
    expect(storeCareQuestion('ज्वरो आएको छ')).toBe(true);
    expect(consumeCareQuestion()).toBe('ज्वरो आएको छ');
    // One-shot: a second read finds nothing, so a page refresh never replays a stale question.
    expect(consumeCareQuestion()).toBe('');
  });

  it('returns an empty question when nothing was ever stored', () => {
    expect(consumeCareQuestion()).toBe('');
  });

  it('carries the listen intent from the mic-hero tap exactly once', () => {
    expect(storeCareListenIntent()).toBe(true);
    expect(consumeCareListenIntent()).toBe(true);
    // One-shot: a second read (e.g. navigating back to /get-care later) must not restart listening.
    expect(consumeCareListenIntent()).toBe(false);
  });

  it('returns no listen intent when nothing was ever stored', () => {
    expect(consumeCareListenIntent()).toBe(false);
  });

  it('degrades quietly when sessionStorage throws (private mode/quota)', () => {
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
        removeItem: () => {
          throw new Error('blocked');
        },
      },
    });

    expect(() => storeCareQuestion('ज्वरो आएको छ')).not.toThrow();
    expect(storeCareQuestion('ज्वरो आएको छ')).toBe(false);
    expect(consumeCareQuestion()).toBe('');
    expect(() => storeCareListenIntent()).not.toThrow();
    expect(storeCareListenIntent()).toBe(false);
    expect(consumeCareListenIntent()).toBe(false);
  });
});

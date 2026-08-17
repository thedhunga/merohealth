import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearPendingProfileConfirmation,
  readPendingProfileConfirmation,
  recordExchange,
  stashPendingProfileConfirmation,
} from '@/lib/anonymous-history';

/**
 * Same hand-rolled `localStorage` fake `history-api.test.ts` already uses —
 * `apps/web` has no jsdom, and these three functions only ever touch
 * `getItem`/`setItem`/`removeItem`.
 */
function createFakeLocalStorage(): Storage {
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

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: createFakeLocalStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pending profile confirmation', () => {
  it('round-trips exactly the confirmable fields', () => {
    stashPendingProfileConfirmation({ ageBand: '40to60', askingFor: 'parent', conditions: ['diabetes'], askedPrompts: ['ageBand'] });

    expect(readPendingProfileConfirmation()).toEqual({ ageBand: '40to60', askingFor: 'parent', conditions: ['diabetes'] });
  });

  it('never stashes when nothing was actually offered', () => {
    stashPendingProfileConfirmation({ askedPrompts: ['ageBand'] });

    expect(readPendingProfileConfirmation()).toBeNull();
  });

  it('clears so the card is never offered twice', () => {
    stashPendingProfileConfirmation({ ageBand: '18to40', askedPrompts: [] });

    clearPendingProfileConfirmation();

    expect(readPendingProfileConfirmation()).toBeNull();
  });

  it('reads null when nothing was ever stashed', () => {
    expect(readPendingProfileConfirmation()).toBeNull();
  });
});

describe('recordExchange outage behaviour — round five task H', () => {
  it('does not throw when localStorage.setItem fails (quota or private mode), so the conversation continues in memory', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
        removeItem: () => {},
      },
    });

    expect(() =>
      recordExchange({
        question: 'दुई दिनदेखि ज्वरो छ',
        answer: 'आराम गर्नुहोस्।',
        language: 'ne',
        outcome: 'answered',
        conversationId: 'conv-1',
        spokenIn: true,
      }),
    ).not.toThrow();
  });
});

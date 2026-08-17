import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAfterMigration,
  clearPendingProfileConfirmation,
  dismissUpsell,
  hasExhaustedTrialMinutes,
  isUpsellDismissed,
  readPendingProfileConfirmation,
  recordExchange,
  recordVoiceUsageSeconds,
  remainingTrialMinutes,
  snapshotForMigration,
  stashPendingProfileConfirmation,
  voiceUsageSecondsThisMonth,
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

describe('upsell dismissal — round six task L', () => {
  it('is not dismissed until dismissUpsell is called', () => {
    expect(isUpsellDismissed()).toBe(false);

    dismissUpsell();

    expect(isUpsellDismissed()).toBe(true);
  });

  it('treats a localStorage failure as not dismissed, never as dismissed', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError');
        },
        setItem: () => {},
        removeItem: () => {},
      },
    });

    expect(isUpsellDismissed()).toBe(false);
  });

  it('does not throw when setItem fails (quota or private mode)', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
        removeItem: () => {},
      },
    });

    expect(() => dismissUpsell()).not.toThrow();
  });
});

describe('voice usage metering — round six task L', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads zero when nothing has ever been recorded', () => {
    expect(voiceUsageSecondsThisMonth()).toBe(0);
  });

  it('accumulates seconds recorded within the same month', () => {
    recordVoiceUsageSeconds(30);
    recordVoiceUsageSeconds(45);

    expect(voiceUsageSecondsThisMonth()).toBe(75);
  });

  it('ignores non-positive or non-finite seconds rather than corrupting the counter', () => {
    recordVoiceUsageSeconds(10);
    recordVoiceUsageSeconds(0);
    recordVoiceUsageSeconds(-5);
    recordVoiceUsageSeconds(Number.NaN);

    expect(voiceUsageSecondsThisMonth()).toBe(10);
  });

  it('resets to zero once the calendar month rolls over, and starts a fresh bucket rather than adding to the stale one', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T00:00:00.000Z'));
    recordVoiceUsageSeconds(120);
    expect(voiceUsageSecondsThisMonth()).toBe(120);

    vi.setSystemTime(new Date('2026-09-01T00:00:00.000Z'));
    expect(voiceUsageSecondsThisMonth()).toBe(0);

    recordVoiceUsageSeconds(30);
    expect(voiceUsageSecondsThisMonth()).toBe(30);
  });

  it('does not throw when localStorage.setItem fails (quota or private mode)', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
        removeItem: () => {},
      },
    });

    expect(() => recordVoiceUsageSeconds(30)).not.toThrow();
  });

  it('travels inside snapshotForMigration and is gone from the device after clearAfterMigration, exactly like exchanges and profile', () => {
    recordVoiceUsageSeconds(90);

    expect(snapshotForMigration().store.usage.secondsUsed).toBe(90);

    clearAfterMigration();

    expect(voiceUsageSecondsThisMonth()).toBe(0);
  });

  describe('trial-minute allowance, TRIAL_MINUTES_FREE unset (the default — owner has not configured it in this test env)', () => {
    it('is null rather than a guessed remaining figure', () => {
      recordVoiceUsageSeconds(600);

      expect(remainingTrialMinutes()).toBeNull();
    });

    it('is never reported as exhausted when there is no known allowance to exhaust', () => {
      recordVoiceUsageSeconds(100_000);

      expect(hasExhaustedTrialMinutes()).toBe(false);
    });
  });

  // `TRIAL_MINUTES_FREE` is read once at module load from
  // `NEXT_PUBLIC_TRIAL_MINUTES_FREE` (`content/pricing.ts`), same as every
  // other freemium config value — see `pricing.test.ts`'s own
  // `FREEMIUM_VOICE_CONFIG` describe for the identical reset-and-reimport
  // shape this mirrors.
  describe('trial-minute allowance, TRIAL_MINUTES_FREE set to 10', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.stubEnv('NEXT_PUBLIC_TRIAL_MINUTES_FREE', '10');
      vi.stubGlobal('window', { localStorage: createFakeLocalStorage() });
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('counts down as minutes are used', async () => {
      const mod = await import('@/lib/anonymous-history');
      mod.recordVoiceUsageSeconds(5 * 60);

      expect(mod.remainingTrialMinutes()).toBe(5);
    });

    it('floors at zero rather than going negative once usage exceeds the allowance', async () => {
      const mod = await import('@/lib/anonymous-history');
      mod.recordVoiceUsageSeconds(20 * 60);

      expect(mod.remainingTrialMinutes()).toBe(0);
      expect(mod.hasExhaustedTrialMinutes()).toBe(true);
    });

    it('is not exhausted before the allowance is actually used up', async () => {
      const mod = await import('@/lib/anonymous-history');
      mod.recordVoiceUsageSeconds(3 * 60);

      expect(mod.hasExhaustedTrialMinutes()).toBe(false);
    });
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

import { describe, expect, it } from 'vitest';
import { InMemoryHistoryStore } from './in-memory-history.store.js';

const EXCHANGE = {
  askedAt: '2026-08-14T10:00:00.000Z',
  question: 'आमालाई टाउको दुख्यो',
  answer: 'आराम गर्नुहोस् र पानी पिउनुहोस्।',
  language: 'ne',
  outcome: 'answered' as const,
};

describe('InMemoryHistoryStore.migrate', () => {
  it('records a first-time anonymousId and reports it was not already migrated', async () => {
    const store = new InMemoryHistoryStore();

    const result = await store.migrate({
      userId: 'sunita',
      anonymousId: 'anon-1',
      exchanges: [EXCHANGE],
      profile: { askingFor: 'mother' },
    });

    expect(result).toEqual({ alreadyMigrated: false });
    expect(store.migrations).toHaveLength(1);
    expect(store.migrations[0]?.userId).toBe('sunita');
  });

  it('is idempotent on anonymousId — a second migrate for the same anonymousId does not insert again', async () => {
    const store = new InMemoryHistoryStore();
    await store.migrate({ userId: 'sunita', anonymousId: 'anon-1', exchanges: [EXCHANGE], profile: {} });

    const second = await store.migrate({ userId: 'sunita', anonymousId: 'anon-1', exchanges: [EXCHANGE], profile: {} });

    expect(second).toEqual({ alreadyMigrated: true });
    expect(store.migrations).toHaveLength(1);
  });

  it('treats different anonymousIds as independent migrations', async () => {
    const store = new InMemoryHistoryStore();
    await store.migrate({ userId: 'sunita', anonymousId: 'anon-1', exchanges: [], profile: {} });

    const result = await store.migrate({ userId: 'sunita', anonymousId: 'anon-2', exchanges: [], profile: {} });

    expect(result).toEqual({ alreadyMigrated: false });
    expect(store.migrations).toHaveLength(2);
  });
});

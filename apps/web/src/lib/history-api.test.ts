import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { history, profile, recordExchange, updateProfile } from '@/lib/anonymous-history';
import { migrateAnonymousHistory } from '@/lib/history-api';

/**
 * No jsdom in this project (`apps/web` has never needed a DOM — see the
 * ledger's own note that browser checks are done by hand, not rendered).
 * `anonymous-history.ts` only ever calls three `localStorage` methods, so a
 * hand-rolled fake is enough to exercise it under plain Node, the same
 * "smallest fake that satisfies the port" rule `InMemoryHistoryStore`
 * (`apps/api`) follows for `HistoryStore`.
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

function mockFetchOnce(status: number) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve({ ok: true, alreadyMigrated: false }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: createFakeLocalStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('migrateAnonymousHistory', () => {
  it('makes no network call when there is nothing to migrate — no exchanges, no profile hint', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await migrateAnonymousHistory();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the exact snapshotForMigration() shape, then clears local history, on success', async () => {
    recordExchange({ question: 'आमालाई टाउको दुख्यो', answer: 'आराम गर्नुहोस्।', language: 'ne', outcome: 'answered' });
    updateProfile({ askingFor: 'mother' });
    const fetchMock = mockFetchOnce(200);

    await migrateAnonymousHistory();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/history/migrate');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    const body = JSON.parse(init.body as string) as { anonymousId: string; store: { exchanges: unknown[]; profile: { askingFor?: string } } };
    expect(typeof body.anonymousId).toBe('string');
    expect(body.store.exchanges).toHaveLength(1);
    expect(body.store.profile.askingFor).toBe('mother');
    // Migration confirmed — local copy is gone.
    expect(history()).toEqual([]);
    expect(profile().askingFor).toBeUndefined();
  });

  it('leaves localStorage intact on a 500 — a lost server response must never lose the person’s questions', async () => {
    recordExchange({ question: 'आमालाई टाउको दुख्यो', answer: null, language: 'ne', outcome: 'emergency' });
    mockFetchOnce(500);

    await migrateAnonymousHistory();

    expect(history()).toHaveLength(1);
  });

  it('leaves localStorage intact when fetch itself rejects, not just on a server error status', async () => {
    recordExchange({ question: 'आमालाई टाउको दुख्यो', answer: 'आराम गर्नुहोस्।', language: 'ne', outcome: 'answered' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await migrateAnonymousHistory();

    expect(history()).toHaveLength(1);
  });
});

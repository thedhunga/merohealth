import { describe, expect, it } from 'vitest';
import { HistoryService } from './history.service.js';
import { InMemoryHistoryStore } from './in-memory-history.store.js';

describe('HistoryService.migrate', () => {
  it('delegates to the store and returns its idempotency result unchanged', async () => {
    const store = new InMemoryHistoryStore();
    const service = new HistoryService(store);

    const first = await service.migrate({ userId: 'sunita', anonymousId: 'anon-1', exchanges: [], profile: {} });
    const second = await service.migrate({ userId: 'sunita', anonymousId: 'anon-1', exchanges: [], profile: {} });

    expect(first).toEqual({ alreadyMigrated: false });
    expect(second).toEqual({ alreadyMigrated: true });
  });
});

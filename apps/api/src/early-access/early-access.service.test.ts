import { describe, expect, it } from 'vitest';
import { EarlyAccessRateLimiter } from './early-access-rate-limiter.js';
import { InMemoryEarlyAccessStore } from './in-memory-early-access.store.js';
import { EarlyAccessService } from './early-access.service.js';

function buildService(store = new InMemoryEarlyAccessStore()) {
  return { service: new EarlyAccessService(store, new EarlyAccessRateLimiter()), store };
}

describe('EarlyAccessService.register', () => {
  it('creates a row for a first-time contact', async () => {
    const { service, store } = buildService();

    const result = await service.register({ contact: '9812345678', source: 'pricing', registeredAt: new Date() }, '1.2.3.4');

    expect(result).toEqual({ outcome: 'created' });
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]?.userId).toBeNull();
  });

  it('is idempotent for a repeated contact', async () => {
    const { service } = buildService();
    await service.register({ contact: '9812345678', source: 'pricing', registeredAt: new Date() }, '1.2.3.4');

    const second = await service.register({ contact: '9812345678', source: 'pricing', registeredAt: new Date() }, '1.2.3.4');

    expect(second).toEqual({ outcome: 'alreadyRegistered' });
  });

  it('creates a fresh row every time when no contact is given', async () => {
    const { service, store } = buildService();
    await service.register({ contact: null, source: 'other', registeredAt: new Date() }, '1.2.3.4');
    await service.register({ contact: null, source: 'other', registeredAt: new Date() }, '1.2.3.4');

    expect(store.rows).toHaveLength(2);
  });

  it('rate-limits repeated calls from the same key', async () => {
    const { service } = buildService();
    for (let i = 0; i < 5; i++) {
      await service.register({ contact: null, source: 'other', registeredAt: new Date() }, '1.2.3.4');
    }

    await expect(service.register({ contact: null, source: 'other', registeredAt: new Date() }, '1.2.3.4')).rejects.toMatchObject({
      status: 429,
    });
  });
});

describe('EarlyAccessService.linkToUser', () => {
  it('links an existing anonymous row to the account', async () => {
    const { service, store } = buildService();
    await service.register({ contact: '9812345678', source: 'pricing', registeredAt: new Date() }, '1.2.3.4');

    await service.linkToUser({ contact: '9812345678', source: 'pricing', registeredAt: new Date(), userId: 'sunita' });

    expect(store.rows[0]?.userId).toBe('sunita');
  });

  it('creates a fresh row for someone who signs in without ever registering anonymously', async () => {
    const { service, store } = buildService();

    await service.linkToUser({ contact: '9812345678', source: 'pricing', registeredAt: new Date(), userId: 'sunita' });

    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]?.userId).toBe('sunita');
  });

  it('is not rate-limited', async () => {
    const { service } = buildService();
    for (let i = 0; i < 10; i++) {
      await service.linkToUser({ contact: null, source: 'other', registeredAt: new Date(), userId: `user-${i}` });
    }
    // No throw — the loop completing is the assertion.
  });
});

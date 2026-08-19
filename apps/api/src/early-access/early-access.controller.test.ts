import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { EarlyAccessRateLimiter } from './early-access-rate-limiter.js';
import { EarlyAccessController } from './early-access.controller.js';
import { EarlyAccessService } from './early-access.service.js';
import { InMemoryEarlyAccessStore } from './in-memory-early-access.store.js';

function buildController(store = new InMemoryEarlyAccessStore()) {
  return { controller: new EarlyAccessController(new EarlyAccessService(store, new EarlyAccessRateLimiter())), store };
}

const VALID_BODY = { contact: '9812345678', source: 'pricing', registeredAt: '2026-08-19T10:00:00.000Z' };

describe('EarlyAccessController.register', () => {
  it('registers a contact and returns ok', async () => {
    const { controller, store } = buildController();

    const result = await controller.register(VALID_BODY, { ip: '1.2.3.4' });

    expect(result).toEqual({ ok: true, alreadyRegistered: false });
    expect(store.rows[0]?.contact).toBe('9812345678');
    expect(store.rows[0]?.userId).toBeNull();
  });

  it('canonicalises a contact typed with +977 and spacing', async () => {
    const { controller, store } = buildController();

    await controller.register({ ...VALID_BODY, contact: '+977 981-234-5678' }, { ip: '1.2.3.4' });

    expect(store.rows[0]?.contact).toBe('9812345678');
  });

  it('accepts a request with no contact at all', async () => {
    const { controller, store } = buildController();

    const result = await controller.register({ source: 'other', registeredAt: '2026-08-19T10:00:00.000Z' }, { ip: '1.2.3.4' });

    expect(result).toEqual({ ok: true, alreadyRegistered: false });
    expect(store.rows[0]?.contact).toBeNull();
  });

  it('reports alreadyRegistered on a repeated contact', async () => {
    const { controller } = buildController();
    await controller.register(VALID_BODY, { ip: '1.2.3.4' });

    const second = await controller.register(VALID_BODY, { ip: '1.2.3.4' });

    expect(second).toEqual({ ok: true, alreadyRegistered: true });
  });

  it('rejects a contact that is neither a Nepali mobile nor an email', async () => {
    const { controller } = buildController();
    await expect(controller.register({ ...VALID_BODY, contact: 'nope' }, { ip: '1.2.3.4' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a source outside the known set', async () => {
    const { controller } = buildController();
    await expect(controller.register({ ...VALID_BODY, source: 'made-up' }, { ip: '1.2.3.4' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a body with no registeredAt', async () => {
    const { controller } = buildController();
    await expect(controller.register({ source: 'pricing' }, { ip: '1.2.3.4' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rate-limits repeated requests from the same IP', async () => {
    const { controller } = buildController();
    for (let i = 0; i < 5; i++) {
      await controller.register({ source: 'other', registeredAt: '2026-08-19T10:00:00.000Z' }, { ip: '9.9.9.9' });
    }

    await expect(
      controller.register({ source: 'other', registeredAt: '2026-08-19T10:00:00.000Z' }, { ip: '9.9.9.9' }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('falls back to the socket remote address when ip is absent', async () => {
    const { controller, store } = buildController();

    await controller.register(VALID_BODY, { socket: { remoteAddress: '10.0.0.1' } });

    expect(store.rows).toHaveLength(1);
  });
});

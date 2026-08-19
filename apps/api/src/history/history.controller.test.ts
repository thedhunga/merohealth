import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { EarlyAccessRateLimiter } from '../early-access/early-access-rate-limiter.js';
import { EarlyAccessService } from '../early-access/early-access.service.js';
import { InMemoryEarlyAccessStore } from '../early-access/in-memory-early-access.store.js';
import { HistoryController } from './history.controller.js';
import { HistoryService } from './history.service.js';
import { InMemoryHistoryStore } from './in-memory-history.store.js';

function currentUser(subjectId: string): CurrentUserResult {
  return {
    subjectId,
    user: { id: subjectId, phone: null, role: 'PATIENT', locale: 'ne', assuranceLevel: 'REGISTERED' },
    patientProfileId: null,
    assuranceLevel: 'REGISTERED',
  };
}

const VALID_BODY = {
  anonymousId: 'anon-1',
  store: {
    version: 1,
    exchanges: [
      {
        id: 'local-id-1',
        askedAt: '2026-08-14T10:00:00.000Z',
        question: 'आमालाई टाउको दुख्यो',
        answer: 'आराम गर्नुहोस्।',
        language: 'ne',
        outcome: 'answered',
      },
    ],
    profile: { askingFor: 'mother', askedPrompts: ['age-band'] },
  },
};

function buildController(store = new InMemoryHistoryStore(), earlyAccessStore = new InMemoryEarlyAccessStore()) {
  return {
    controller: new HistoryController(new HistoryService(store), new EarlyAccessService(earlyAccessStore, new EarlyAccessRateLimiter())),
    store,
    earlyAccessStore,
  };
}

describe('HistoryController.migrate', () => {
  it('takes the owning user from @CurrentUser(), never from the request body, and attaches the exchanges to that user', async () => {
    const { controller, store } = buildController();

    const result = await controller.migrate(currentUser('sunita'), VALID_BODY);

    expect(result).toEqual({ ok: true, alreadyMigrated: false });
    expect(store.migrations).toHaveLength(1);
    expect(store.migrations[0]?.userId).toBe('sunita');
    expect(store.migrations[0]?.anonymousId).toBe('anon-1');
    expect(store.migrations[0]?.exchanges).toHaveLength(1);
    expect(store.migrations[0]?.profile).toEqual({ askingFor: 'mother' });
  });

  it('is idempotent — the same anonymousId migrated twice reports alreadyMigrated on the second call', async () => {
    const { controller } = buildController();
    await controller.migrate(currentUser('sunita'), VALID_BODY);

    const second = await controller.migrate(currentUser('sunita'), VALID_BODY);

    expect(second).toEqual({ ok: true, alreadyMigrated: true });
  });

  it('accepts an empty exchange list and an empty profile — a visitor who signed in without ever asking anything', async () => {
    const { controller, store } = buildController();

    const result = await controller.migrate(currentUser('sunita'), {
      anonymousId: 'anon-empty',
      store: { version: 1, exchanges: [], profile: { askedPrompts: [] } },
    });

    expect(result).toEqual({ ok: true, alreadyMigrated: false });
    expect(store.migrations[0]?.exchanges).toEqual([]);
  });

  it('rejects a body with no anonymousId before it ever reaches the service', async () => {
    const { controller } = buildController();
    await expect(
      controller.migrate(currentUser('sunita'), { store: VALID_BODY.store }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a store version other than 1', async () => {
    const { controller } = buildController();
    await expect(
      controller.migrate(currentUser('sunita'), { anonymousId: 'anon-1', store: { ...VALID_BODY.store, version: 2 } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts an offTopic outcome — round five task I added this alongside answered/emergency/unavailable', async () => {
    const { controller, store } = buildController();
    const body = {
      anonymousId: 'anon-1',
      store: {
        version: 1,
        exchanges: [{ ...VALID_BODY.store.exchanges[0], answer: null, outcome: 'offTopic' }],
        profile: {},
      },
    };

    const result = await controller.migrate(currentUser('sunita'), body);

    expect(result).toEqual({ ok: true, alreadyMigrated: false });
    expect(store.migrations[0]?.exchanges[0]?.outcome).toBe('offTopic');
  });

  it('carries conversationId and spokenIn through migration — round five task H', async () => {
    const { controller, store } = buildController();
    const body = {
      anonymousId: 'anon-1',
      store: {
        version: 1,
        exchanges: [{ ...VALID_BODY.store.exchanges[0], conversationId: 'conv-1', spokenIn: true }],
        profile: {},
      },
    };

    await controller.migrate(currentUser('sunita'), body);

    expect(store.migrations[0]?.exchanges[0]?.conversationId).toBe('conv-1');
    expect(store.migrations[0]?.exchanges[0]?.spokenIn).toBe(true);
  });

  it('accepts an exchange with neither field — pre-task-H entries still migrate', async () => {
    const { controller, store } = buildController();

    const result = await controller.migrate(currentUser('sunita'), VALID_BODY);

    expect(result).toEqual({ ok: true, alreadyMigrated: false });
    expect(store.migrations[0]?.exchanges[0]?.conversationId).toBeUndefined();
  });

  it('rejects an exchange with an out-of-range outcome value', async () => {
    const { controller } = buildController();
    const body = {
      anonymousId: 'anon-1',
      store: {
        version: 1,
        exchanges: [{ ...VALID_BODY.store.exchanges[0], outcome: 'made-up' }],
        profile: {},
      },
    };
    await expect(controller.migrate(currentUser('sunita'), body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('links a matching early-access record to the signed-in account — round six L′', async () => {
    const { controller, earlyAccessStore } = buildController();
    await earlyAccessStore.register({ contact: '9812345678', source: 'pricing', registeredAt: new Date(), userId: null });
    const body = {
      ...VALID_BODY,
      earlyAccess: { contact: '9812345678', source: 'pricing', registeredAt: '2026-08-18T10:00:00.000Z' },
    };

    await controller.migrate(currentUser('sunita'), body);

    expect(earlyAccessStore.rows[0]?.userId).toBe('sunita');
  });

  it('creates an early-access row for someone who never registered anonymously', async () => {
    const { controller, earlyAccessStore } = buildController();
    const body = {
      ...VALID_BODY,
      earlyAccess: { contact: null, source: 'other', registeredAt: '2026-08-18T10:00:00.000Z' },
    };

    await controller.migrate(currentUser('sunita'), body);

    expect(earlyAccessStore.rows).toHaveLength(1);
    expect(earlyAccessStore.rows[0]?.userId).toBe('sunita');
  });

  it('migrates history normally when there is no earlyAccess field at all', async () => {
    const { controller, store, earlyAccessStore } = buildController();

    const result = await controller.migrate(currentUser('sunita'), VALID_BODY);

    expect(result).toEqual({ ok: true, alreadyMigrated: false });
    expect(store.migrations).toHaveLength(1);
    expect(earlyAccessStore.rows).toHaveLength(0);
  });

  it('rejects an earlyAccess block with a made-up source', async () => {
    const { controller } = buildController();
    const body = { ...VALID_BODY, earlyAccess: { contact: null, source: 'made-up', registeredAt: '2026-08-18T10:00:00.000Z' } };

    await expect(controller.migrate(currentUser('sunita'), body)).rejects.toBeInstanceOf(BadRequestException);
  });
});

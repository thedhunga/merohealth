import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PrismaHistoryStore } from './prisma-history.store.js';
import type { MigrateHistoryInput } from './history-store.js';

/**
 * `PrismaHistoryStore` was the last untested `Prisma*Store` adapter in
 * `apps/api` (the `auth`/`early-access`/`family` siblings each already had
 * one). Its `migrate` method has the most branching of the group: the
 * `$transaction` array conditionally includes the `historyExchange.createMany`
 * op at all, `jsonProfile` conditionally builds each field, and every
 * optional exchange field is spread rather than set-to-null under
 * `exactOptionalPropertyTypes`. A fake `PrismaService.client` stands in for
 * a live database — `historyMigration.create`/`historyExchange.createMany`
 * are spied on to inspect exactly what gets built, and `$transaction` itself
 * is a bare `vi.fn()` since the store only branches on whether it resolves
 * or rejects, never on what it resolves to.
 */
function fakePrisma(overrides: {
  create?: ReturnType<typeof vi.fn>;
  createMany?: ReturnType<typeof vi.fn>;
  transaction?: ReturnType<typeof vi.fn>;
}): PrismaService {
  return {
    client: {
      historyMigration: {
        create: overrides.create ?? vi.fn().mockReturnValue('migration-op'),
      },
      historyExchange: {
        createMany: overrides.createMany ?? vi.fn().mockReturnValue('exchange-op'),
      },
      $transaction: overrides.transaction ?? vi.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaService;
}

const baseInput: MigrateHistoryInput = {
  userId: 'user-1',
  anonymousId: 'anon-1',
  profile: {},
  exchanges: [],
};

describe('PrismaHistoryStore', () => {
  describe('migrate', () => {
    it('writes the migration row and every exchange inside a single $transaction call', async () => {
      const create = vi.fn().mockReturnValue('migration-op');
      const createMany = vi.fn().mockReturnValue('exchange-op');
      const $transaction = vi.fn().mockResolvedValue([]);
      const store = new PrismaHistoryStore(fakePrisma({ create, createMany, transaction: $transaction }));

      const result = await store.migrate({
        userId: 'user-1',
        anonymousId: 'anon-1',
        profile: { ageBand: '30-40' },
        exchanges: [
          {
            askedAt: '2026-01-01T00:00:00.000Z',
            question: 'q1',
            answer: 'a1',
            language: 'ne',
            outcome: 'answered',
            conversationId: 'conv-1',
            spokenIn: true,
          },
        ],
      });

      expect(create).toHaveBeenCalledWith({
        data: { userId: 'user-1', anonymousId: 'anon-1', profileSnapshot: { ageBand: '30-40' } },
      });
      expect(createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: 'user-1',
            askedAt: new Date('2026-01-01T00:00:00.000Z'),
            question: 'q1',
            answer: 'a1',
            language: 'ne',
            outcome: 'answered',
            conversationId: 'conv-1',
            spokenIn: true,
          },
        ],
      });
      expect($transaction).toHaveBeenCalledWith(['migration-op', 'exchange-op']);
      expect(result).toEqual({ alreadyMigrated: false });
    });

    it('skips the historyExchange.createMany op entirely when there are no exchanges to migrate', async () => {
      const createMany = vi.fn().mockReturnValue('exchange-op');
      const $transaction = vi.fn().mockResolvedValue([]);
      const store = new PrismaHistoryStore(fakePrisma({ createMany, transaction: $transaction }));

      await store.migrate(baseInput);

      expect(createMany).not.toHaveBeenCalled();
      expect($transaction).toHaveBeenCalledWith(['migration-op']);
    });

    it('omits profileSnapshot entirely when the anonymous profile offered nothing, rather than writing null', async () => {
      const create = vi.fn().mockReturnValue('migration-op');
      const store = new PrismaHistoryStore(fakePrisma({ create }));

      await store.migrate(baseInput);

      expect(create).toHaveBeenCalledWith({ data: { userId: 'user-1', anonymousId: 'anon-1' } });
    });

    it('treats an empty conditions array as nothing offered, same as an absent field', async () => {
      const create = vi.fn().mockReturnValue('migration-op');
      const store = new PrismaHistoryStore(fakePrisma({ create }));

      await store.migrate({ ...baseInput, profile: { conditions: [] } });

      expect(create).toHaveBeenCalledWith({ data: { userId: 'user-1', anonymousId: 'anon-1' } });
    });

    it('builds profileSnapshot from only the fields actually offered, in askingFor/conditions combination', async () => {
      const create = vi.fn().mockReturnValue('migration-op');
      const store = new PrismaHistoryStore(fakePrisma({ create }));

      await store.migrate({ ...baseInput, profile: { askingFor: 'mother', conditions: ['diabetes', 'hypertension'] } });

      expect(create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          anonymousId: 'anon-1',
          profileSnapshot: { askingFor: 'mother', conditions: ['diabetes', 'hypertension'] },
        },
      });
    });

    it('omits conversationId and spokenIn from an exchange row when the client never sent them', async () => {
      const createMany = vi.fn().mockReturnValue('exchange-op');
      const store = new PrismaHistoryStore(fakePrisma({ createMany }));

      await store.migrate({
        ...baseInput,
        exchanges: [{ askedAt: '2026-01-01T00:00:00.000Z', question: 'q', answer: null, language: 'en', outcome: 'unavailable' }],
      });

      expect(createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: 'user-1',
            askedAt: new Date('2026-01-01T00:00:00.000Z'),
            question: 'q',
            answer: null,
            language: 'en',
            outcome: 'unavailable',
          },
        ],
      });
    });

    it('includes an explicit spokenIn: false rather than treating it as absent', async () => {
      const createMany = vi.fn().mockReturnValue('exchange-op');
      const store = new PrismaHistoryStore(fakePrisma({ createMany }));

      await store.migrate({
        ...baseInput,
        exchanges: [
          { askedAt: '2026-01-01T00:00:00.000Z', question: 'q', answer: 'a', language: 'ne', outcome: 'answered', spokenIn: false },
        ],
      });

      const [callArg] = createMany.mock.calls[0] as [{ data: Array<{ spokenIn?: boolean }> }];
      expect(callArg.data[0]?.spokenIn).toBe(false);
    });

    it('batches every exchange into one createMany call, each mapped independently', async () => {
      const createMany = vi.fn().mockReturnValue('exchange-op');
      const store = new PrismaHistoryStore(fakePrisma({ createMany }));

      await store.migrate({
        ...baseInput,
        exchanges: [
          { askedAt: '2026-01-01T00:00:00.000Z', question: 'q1', answer: 'a1', language: 'ne', outcome: 'answered' },
          { askedAt: '2026-01-02T00:00:00.000Z', question: 'q2', answer: null, language: 'en', outcome: 'emergency' },
        ],
      });

      expect(createMany).toHaveBeenCalledTimes(1);
      const [callArg] = createMany.mock.calls[0] as [{ data: unknown[] }];
      expect(callArg.data).toHaveLength(2);
    });

    it('reports alreadyMigrated rather than throwing when the transaction fails on the anonymousId unique constraint', async () => {
      const $transaction = vi.fn().mockRejectedValue({ code: 'P2002' });
      const store = new PrismaHistoryStore(fakePrisma({ transaction: $transaction }));

      const result = await store.migrate(baseInput);

      expect(result).toEqual({ alreadyMigrated: true });
    });

    it('rethrows a Prisma error whose code is not the unique-constraint violation', async () => {
      const $transaction = vi.fn().mockRejectedValue({ code: 'P2003' });
      const store = new PrismaHistoryStore(fakePrisma({ transaction: $transaction }));

      await expect(store.migrate(baseInput)).rejects.toEqual({ code: 'P2003' });
    });

    it('rethrows a plain error with no Prisma error code at all', async () => {
      const $transaction = vi.fn().mockRejectedValue(new Error('connection reset'));
      const store = new PrismaHistoryStore(fakePrisma({ transaction: $transaction }));

      await expect(store.migrate(baseInput)).rejects.toThrow('connection reset');
    });
  });
});

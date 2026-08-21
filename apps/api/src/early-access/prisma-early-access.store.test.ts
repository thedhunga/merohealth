import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PrismaEarlyAccessStore } from './prisma-early-access.store.js';

/**
 * `PrismaEarlyAccessStore` was one of the six untested `Prisma*Store`
 * adapters in `apps/api` (see `PrismaFamilyGrantsStore`'s test for the
 * first). Its `register` method has the richest branching of the
 * remaining five: a create-then-catch race against the database's own
 * unique constraint on `contact`, with three distinct outcomes depending
 * on whether the conflicting row is already linked to an account. A fake
 * `PrismaService.client` stands in for a live database — the create/
 * updateMany call args and the thrown/caught error shape are what this
 * file actually exercises.
 */
function fakePrisma(overrides: {
  create?: ReturnType<typeof vi.fn>;
  updateMany?: ReturnType<typeof vi.fn>;
  findMany?: ReturnType<typeof vi.fn>;
}): PrismaService {
  return {
    client: {
      earlyAccess: {
        create: overrides.create ?? vi.fn(),
        updateMany: overrides.updateMany ?? vi.fn(),
        findMany: overrides.findMany ?? vi.fn(),
      },
    },
  } as unknown as PrismaService;
}

function uniqueConstraintError(): unknown {
  return { code: 'P2002', message: 'Unique constraint failed on the fields: (`contact`)' };
}

describe('PrismaEarlyAccessStore', () => {
  describe('register', () => {
    it('creates a row and reports "created" when the contact is not already taken', async () => {
      const create = vi.fn().mockResolvedValue({});
      const store = new PrismaEarlyAccessStore(fakePrisma({ create }));
      const registeredAt = new Date('2026-08-21T00:00:00.000Z');

      const result = await store.register({ contact: 'sabina@example.com', source: 'pricing', registeredAt, userId: null });

      expect(result).toEqual({ outcome: 'created' });
      expect(create).toHaveBeenCalledWith({
        data: { contact: 'sabina@example.com', source: 'pricing', registeredAt },
      });
    });

    it('omits userId from the write entirely for an anonymous registration, rather than sending null', async () => {
      const create = vi.fn().mockResolvedValue({});
      const store = new PrismaEarlyAccessStore(fakePrisma({ create }));

      await store.register({ contact: null, source: 'get-care', registeredAt: new Date('2026-08-21T00:00:00.000Z'), userId: null });

      const [callArg] = create.mock.calls[0] as [{ data: Record<string, unknown> }];
      expect('userId' in callArg.data).toBe(false);
    });

    it('includes userId in the write for an authenticated registration', async () => {
      const create = vi.fn().mockResolvedValue({});
      const store = new PrismaEarlyAccessStore(fakePrisma({ create }));

      await store.register({
        contact: 'arjun@example.com',
        source: 'other',
        registeredAt: new Date('2026-08-21T00:00:00.000Z'),
        userId: 'user-1',
      });

      const [callArg] = create.mock.calls[0] as [{ data: Record<string, unknown> }];
      expect(callArg.data['userId']).toBe('user-1');
    });

    it('links an existing anonymous row to the account when an authenticated call races the same contact', async () => {
      const create = vi.fn().mockRejectedValue(uniqueConstraintError());
      const updateMany = vi.fn().mockResolvedValue({ count: 1 });
      const store = new PrismaEarlyAccessStore(fakePrisma({ create, updateMany }));

      const result = await store.register({
        contact: 'sabina@example.com',
        source: 'pricing',
        registeredAt: new Date('2026-08-21T00:00:00.000Z'),
        userId: 'user-1',
      });

      expect(result).toEqual({ outcome: 'linked' });
      expect(updateMany).toHaveBeenCalledWith({
        where: { contact: 'sabina@example.com', userId: null },
        data: { userId: 'user-1' },
      });
    });

    it('reports "alreadyRegistered", not "linked", when the conflicting contact is already linked to a different account', async () => {
      const create = vi.fn().mockRejectedValue(uniqueConstraintError());
      // No anonymous row (userId: null) matched the contact, so the conditional update claims nothing.
      const updateMany = vi.fn().mockResolvedValue({ count: 0 });
      const store = new PrismaEarlyAccessStore(fakePrisma({ create, updateMany }));

      const result = await store.register({
        contact: 'sabina@example.com',
        source: 'pricing',
        registeredAt: new Date('2026-08-21T00:00:00.000Z'),
        userId: 'user-1',
      });

      expect(result).toEqual({ outcome: 'alreadyRegistered' });
    });

    it('reports "alreadyRegistered" for a conflicting anonymous retry, without attempting to link', async () => {
      const create = vi.fn().mockRejectedValue(uniqueConstraintError());
      const updateMany = vi.fn();
      const store = new PrismaEarlyAccessStore(fakePrisma({ create, updateMany }));

      const result = await store.register({
        contact: 'sabina@example.com',
        source: 'pricing',
        registeredAt: new Date('2026-08-21T00:00:00.000Z'),
        userId: null,
      });

      expect(result).toEqual({ outcome: 'alreadyRegistered' });
      expect(updateMany).not.toHaveBeenCalled();
    });

    it('never attempts to link when the input has no contact, even if create() rejects', async () => {
      // A contact-less registration can never hit the unique-constraint branch in practice (no dedupe
      // key), but this guards the `input.contact && input.userId` condition directly regardless.
      const create = vi.fn().mockRejectedValue(uniqueConstraintError());
      const updateMany = vi.fn();
      const store = new PrismaEarlyAccessStore(fakePrisma({ create, updateMany }));

      const result = await store.register({
        contact: null,
        source: 'pricing',
        registeredAt: new Date('2026-08-21T00:00:00.000Z'),
        userId: 'user-1',
      });

      expect(result).toEqual({ outcome: 'alreadyRegistered' });
      expect(updateMany).not.toHaveBeenCalled();
    });

    it('rethrows an error that is not a unique-constraint violation', async () => {
      const create = vi.fn().mockRejectedValue(new Error('connection reset'));
      const store = new PrismaEarlyAccessStore(fakePrisma({ create }));

      await expect(
        store.register({ contact: 'sabina@example.com', source: 'pricing', registeredAt: new Date('2026-08-21T00:00:00.000Z'), userId: null }),
      ).rejects.toThrow('connection reset');
    });
  });

  describe('list', () => {
    it('returns rows oldest-first with source cast to the EarlyAccessSource union', async () => {
      const findMany = vi.fn().mockResolvedValue([
        {
          id: 'ea-1',
          contact: 'sabina@example.com',
          source: 'pricing',
          registeredAt: new Date('2026-08-21T00:00:00.000Z'),
          userId: 'user-1',
        },
      ]);
      const store = new PrismaEarlyAccessStore(fakePrisma({ findMany }));

      const result = await store.list();

      expect(findMany).toHaveBeenCalledWith({ orderBy: { registeredAt: 'asc' } });
      expect(result).toEqual([
        {
          id: 'ea-1',
          contact: 'sabina@example.com',
          source: 'pricing',
          registeredAt: new Date('2026-08-21T00:00:00.000Z'),
          userId: 'user-1',
        },
      ]);
    });
  });
});

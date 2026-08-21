import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PrismaSubscriptionGrantStore } from './prisma-subscription-grant.store.js';

/**
 * The last untested `Prisma*Store` adapter with real logic (`auth`'s is a
 * pure passthrough not worth a test). `grantPlusMonths` has two branches
 * task EEE's own log entry flagged as the reason to test this one next:
 * extend-from-later-of-now-or-existing-period date math, and a
 * never-downgrade tier comparison. Both depend on `new Date()` called
 * inside the method itself, so `now` is pinned with fake timers rather than
 * threaded in — there is no injection point to fake around.
 */
function fakePrisma(overrides: {
  findUnique?: ReturnType<typeof vi.fn>;
  upsert?: ReturnType<typeof vi.fn>;
}): PrismaService {
  return {
    client: {
      subscription: {
        findUnique: overrides.findUnique ?? vi.fn(),
        upsert: overrides.upsert ?? vi.fn().mockResolvedValue(undefined),
      },
    },
  } as unknown as PrismaService;
}

const NOW = new Date('2026-08-21T00:00:00.000Z');

describe('PrismaSubscriptionGrantStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('no existing subscription', () => {
    it('upserts a fresh PLUS row extending months from now', async () => {
      const findUnique = vi.fn().mockResolvedValue(null);
      const upsert = vi.fn().mockResolvedValue(undefined);
      const store = new PrismaSubscriptionGrantStore(fakePrisma({ findUnique, upsert }));

      await store.grantPlusMonths('owner-1', 3);

      expect(findUnique).toHaveBeenCalledWith({ where: { ownerId: 'owner-1' } });
      expect(upsert).toHaveBeenCalledWith({
        where: { ownerId: 'owner-1' },
        create: {
          ownerId: 'owner-1',
          tier: 'PLUS',
          currentPeriodStart: NOW,
          currentPeriodEnd: new Date('2026-11-21T00:00:00.000Z'),
        },
        update: { tier: 'PLUS', currentPeriodEnd: new Date('2026-11-21T00:00:00.000Z') },
      });
    });
  });

  describe('lapsed subscription (currentPeriodEnd in the past)', () => {
    it('extends from now, not the stale period end', async () => {
      const findUnique = vi.fn().mockResolvedValue({
        tier: 'FREE',
        currentPeriodEnd: new Date('2026-01-01T00:00:00.000Z'),
      });
      const upsert = vi.fn().mockResolvedValue(undefined);
      const store = new PrismaSubscriptionGrantStore(fakePrisma({ findUnique, upsert }));

      await store.grantPlusMonths('owner-2', 1);

      const [call] = upsert.mock.calls[0] as [{ update: { currentPeriodEnd: Date } }];
      expect(call.update.currentPeriodEnd).toEqual(new Date('2026-09-21T00:00:00.000Z'));
    });
  });

  describe('active subscription (currentPeriodEnd in the future)', () => {
    it('extends from the existing period end, not from now', async () => {
      const findUnique = vi.fn().mockResolvedValue({
        tier: 'PLUS',
        currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
      });
      const upsert = vi.fn().mockResolvedValue(undefined);
      const store = new PrismaSubscriptionGrantStore(fakePrisma({ findUnique, upsert }));

      await store.grantPlusMonths('owner-3', 2);

      const [call] = upsert.mock.calls[0] as [{ update: { currentPeriodEnd: Date } }];
      expect(call.update.currentPeriodEnd).toEqual(new Date('2026-12-01T00:00:00.000Z'));
    });
  });

  describe('currentPeriodEnd not yet set', () => {
    it('treats a null currentPeriodEnd as lapsed and extends from now', async () => {
      const findUnique = vi.fn().mockResolvedValue({ tier: 'FREE', currentPeriodEnd: null });
      const upsert = vi.fn().mockResolvedValue(undefined);
      const store = new PrismaSubscriptionGrantStore(fakePrisma({ findUnique, upsert }));

      await store.grantPlusMonths('owner-4', 1);

      const [call] = upsert.mock.calls[0] as [{ update: { currentPeriodEnd: Date } }];
      expect(call.update.currentPeriodEnd).toEqual(new Date('2026-09-21T00:00:00.000Z'));
    });
  });

  describe('tier never downgrades', () => {
    it('keeps an existing PRO subscription at PRO rather than dropping it to PLUS', async () => {
      const findUnique = vi.fn().mockResolvedValue({
        tier: 'PRO',
        currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
      });
      const upsert = vi.fn().mockResolvedValue(undefined);
      const store = new PrismaSubscriptionGrantStore(fakePrisma({ findUnique, upsert }));

      await store.grantPlusMonths('owner-5', 1);

      const [call] = upsert.mock.calls[0] as [{ update: { tier: string } }];
      expect(call.update.tier).toBe('PRO');
    });

    it('moves an existing FREE subscription up to PLUS', async () => {
      const findUnique = vi.fn().mockResolvedValue({
        tier: 'FREE',
        currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
      });
      const upsert = vi.fn().mockResolvedValue(undefined);
      const store = new PrismaSubscriptionGrantStore(fakePrisma({ findUnique, upsert }));

      await store.grantPlusMonths('owner-6', 1);

      const [call] = upsert.mock.calls[0] as [{ update: { tier: string } }];
      expect(call.update.tier).toBe('PLUS');
    });

    it('leaves an existing PLUS subscription at PLUS', async () => {
      const findUnique = vi.fn().mockResolvedValue({
        tier: 'PLUS',
        currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
      });
      const upsert = vi.fn().mockResolvedValue(undefined);
      const store = new PrismaSubscriptionGrantStore(fakePrisma({ findUnique, upsert }));

      await store.grantPlusMonths('owner-7', 1);

      const [call] = upsert.mock.calls[0] as [{ update: { tier: string } }];
      expect(call.update.tier).toBe('PLUS');
    });
  });

  describe('month-end rollover', () => {
    it('rolls into the next month rather than clamping when the target month is shorter', async () => {
      vi.setSystemTime(new Date('2026-01-31T00:00:00.000Z'));
      const findUnique = vi.fn().mockResolvedValue(null);
      const upsert = vi.fn().mockResolvedValue(undefined);
      const store = new PrismaSubscriptionGrantStore(fakePrisma({ findUnique, upsert }));

      await store.grantPlusMonths('owner-8', 1);

      // JS `Date#setMonth` rolls Jan 31 + 1 month into Mar 3 (Feb has 28 days
      // in 2026), rather than clamping to Feb 28 — this test documents that
      // inherited behaviour rather than asserting a rounder-looking date.
      const [call] = upsert.mock.calls[0] as [{ create: { currentPeriodEnd: Date } }];
      expect(call.create.currentPeriodEnd).toEqual(new Date('2026-03-03T00:00:00.000Z'));
    });
  });
});

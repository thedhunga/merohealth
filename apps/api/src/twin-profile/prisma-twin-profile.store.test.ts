import { describe, expect, it, vi } from 'vitest';
import type { TwinFact } from '@swasthya/shared-types';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PrismaTwinProfileStore } from './prisma-twin-profile.store.js';

/**
 * `PrismaTwinProfileStore` was the last of the six untested `Prisma*Store`
 * adapters in `apps/api` (see `PrismaFamilyGrantsStore`'s test for the
 * first) — picked over the sixth, `PrismaAuthStore`, because that one is a
 * pure Prisma-to-domain passthrough with no branch to exercise, while this
 * one has three: the empty-facts early return, the `recordedAt` string →
 * `Date` conversion, and passing `createMany`'s own `count` through rather
 * than trusting `input.facts.length`.
 */
function fakePrisma(createMany: ReturnType<typeof vi.fn>): PrismaService {
  return {
    client: {
      subjectTwinFact: { createMany },
    },
  } as unknown as PrismaService;
}

function fact(overrides: Partial<TwinFact> = {}): TwinFact {
  return {
    id: 'fact-1',
    kind: 'ALLERGY',
    label: 'Penicillin',
    value: 'Penicillin',
    provenance: 'PATIENT_REPORTED',
    verification: 'PATIENT_CONFIRMED',
    sensitivity: 'STANDARD',
    recordedAt: '2026-08-21T00:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

describe('PrismaTwinProfileStore', () => {
  describe('confirmFacts', () => {
    it('returns created: 0 without calling createMany when there are no facts', async () => {
      const createMany = vi.fn();
      const store = new PrismaTwinProfileStore(fakePrisma(createMany));

      const result = await store.confirmFacts({ userId: 'user-1', facts: [] });

      expect(result).toEqual({ created: 0 });
      expect(createMany).not.toHaveBeenCalled();
    });

    it('maps every fact field into one createMany call, converting recordedAt to a Date', async () => {
      const createMany = vi.fn().mockResolvedValue({ count: 1 });
      const store = new PrismaTwinProfileStore(fakePrisma(createMany));
      const input = fact();

      await store.confirmFacts({ userId: 'user-1', facts: [input] });

      expect(createMany).toHaveBeenCalledWith({
        data: [
          {
            id: input.id,
            userId: 'user-1',
            kind: input.kind,
            label: input.label,
            value: input.value,
            provenance: input.provenance,
            verification: input.verification,
            sensitivity: input.sensitivity,
            recordedAt: new Date(input.recordedAt),
            version: input.version,
          },
        ],
      });
    });

    it('batches multiple facts into a single createMany call, not one per fact', async () => {
      const createMany = vi.fn().mockResolvedValue({ count: 2 });
      const store = new PrismaTwinProfileStore(fakePrisma(createMany));

      await store.confirmFacts({
        userId: 'user-1',
        facts: [fact({ id: 'fact-1' }), fact({ id: 'fact-2', kind: 'CONDITION' })],
      });

      expect(createMany).toHaveBeenCalledTimes(1);
      const [callArg] = createMany.mock.calls[0] as [{ data: { id: string }[] }];
      expect(callArg.data.map((row) => row.id)).toEqual(['fact-1', 'fact-2']);
    });

    it("returns createMany's own count rather than trusting input.facts.length", async () => {
      // A mismatch shouldn't happen in practice (every fact carries its own caller-generated id, no
      // dedupe key for Prisma to silently skip a row on) but the store must still report what the
      // database actually did, not what was asked for.
      const createMany = vi.fn().mockResolvedValue({ count: 1 });
      const store = new PrismaTwinProfileStore(fakePrisma(createMany));

      const result = await store.confirmFacts({
        userId: 'user-1',
        facts: [fact({ id: 'fact-1' }), fact({ id: 'fact-2' })],
      });

      expect(result).toEqual({ created: 1 });
    });
  });
});

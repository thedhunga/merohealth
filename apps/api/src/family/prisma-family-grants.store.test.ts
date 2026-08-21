import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PrismaFamilyGrantsStore } from './prisma-family-grants.store.js';

/**
 * `PrismaFamilyGrantsStore` was the only `Prisma*Store` adapter in
 * `apps/api` with no test at all — its sibling `InMemoryFamilyGrantsStore`
 * has one, but the mapping this file actually does (`Date` → ISO string,
 * and `toEnrolment`'s partial-pair guard) was unexercised. A fake
 * `PrismaService.client` stands in for a live database: every method here
 * is a thin query-plus-map, so asserting on the query args passed to the
 * fake and the shape mapped back is enough to cover it without a real
 * Postgres.
 */
function fakePrisma(overrides: {
  delegationGrant?: Partial<Record<'findMany' | 'create' | 'findUnique' | 'update', ReturnType<typeof vi.fn>>>;
  guardianshipGrant?: Partial<Record<'findMany', ReturnType<typeof vi.fn>>>;
}): PrismaService {
  return {
    client: {
      delegationGrant: {
        findMany: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        ...overrides.delegationGrant,
      },
      guardianshipGrant: {
        findMany: vi.fn(),
        ...overrides.guardianshipGrant,
      },
    },
  } as unknown as PrismaService;
}

const delegationRow = {
  id: 'd-1',
  granterId: 'janaki',
  delegateId: 'arjun',
  scopes: ['VIEW_RECORD'],
  grantedAt: new Date('2026-01-01T00:00:00.000Z'),
  expiresAt: new Date('2026-12-31T00:00:00.000Z'),
  revokedAt: null,
  enrolmentMethod: null,
  enrolmentRecordedBy: null,
};

describe('PrismaFamilyGrantsStore', () => {
  describe('guardianshipsFor', () => {
    it('scopes the query to the requested guardian and maps Date columns to ISO strings', async () => {
      const findMany = vi.fn().mockResolvedValue([
        {
          id: 'g-1',
          wardId: 'roshani',
          guardianId: 'sunita',
          grounds: 'MINOR',
          grantedAt: new Date('2014-03-10T00:00:00.000Z'),
          expiresAt: new Date('2032-03-10T00:00:00.000Z'),
          revokedAt: null,
        },
      ]);
      const store = new PrismaFamilyGrantsStore(fakePrisma({ guardianshipGrant: { findMany } }));

      const result = await store.guardianshipsFor('sunita');

      expect(findMany).toHaveBeenCalledWith({ where: { guardianId: 'sunita' } });
      expect(result).toEqual([
        {
          id: 'g-1',
          wardId: 'roshani',
          guardianId: 'sunita',
          grounds: 'MINOR',
          grantedAt: '2014-03-10T00:00:00.000Z',
          expiresAt: '2032-03-10T00:00:00.000Z',
          revokedAt: null,
        },
      ]);
    });

    it('maps a set revokedAt to its ISO string rather than dropping it', async () => {
      const findMany = vi.fn().mockResolvedValue([
        {
          id: 'g-2',
          wardId: 'roshani',
          guardianId: 'sunita',
          grounds: 'MINOR',
          grantedAt: new Date('2014-03-10T00:00:00.000Z'),
          expiresAt: new Date('2032-03-10T00:00:00.000Z'),
          revokedAt: new Date('2026-06-01T00:00:00.000Z'),
        },
      ]);
      const store = new PrismaFamilyGrantsStore(fakePrisma({ guardianshipGrant: { findMany } }));

      const results = await store.guardianshipsFor('sunita');

      expect(results).toHaveLength(1);
      expect(results[0]?.revokedAt).toBe('2026-06-01T00:00:00.000Z');
    });
  });

  describe('delegationsFor / delegationsGrantedBy', () => {
    it('scopes delegationsFor by delegateId and delegationsGrantedBy by granterId', async () => {
      const findMany = vi.fn().mockResolvedValue([delegationRow]);
      const store = new PrismaFamilyGrantsStore(fakePrisma({ delegationGrant: { findMany } }));

      await store.delegationsFor('arjun');
      expect(findMany).toHaveBeenLastCalledWith({ where: { delegateId: 'arjun' } });

      await store.delegationsGrantedBy('janaki');
      expect(findMany).toHaveBeenLastCalledWith({ where: { granterId: 'janaki' } });
    });
  });

  describe('createDelegation', () => {
    it('converts ISO strings to Date, spreads scopes into a new array, and maps enrolment fields to null when absent', async () => {
      const create = vi.fn().mockResolvedValue(delegationRow);
      const store = new PrismaFamilyGrantsStore(fakePrisma({ delegationGrant: { create } }));
      const grant = {
        id: 'd-1',
        granterId: 'janaki',
        delegateId: 'arjun',
        scopes: ['VIEW_RECORD'] as const,
        grantedAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-12-31T00:00:00.000Z',
        revokedAt: null,
        enrolment: null,
      };

      const returned = await store.createDelegation(grant);

      expect(create).toHaveBeenCalledWith({
        data: {
          id: 'd-1',
          granterId: 'janaki',
          delegateId: 'arjun',
          scopes: ['VIEW_RECORD'],
          grantedAt: new Date('2026-01-01T00:00:00.000Z'),
          expiresAt: new Date('2026-12-31T00:00:00.000Z'),
          revokedAt: null,
          enrolmentMethod: null,
          enrolmentRecordedBy: null,
        },
      });
      // scopes must be a new array, not the same reference createDelegation was called with.
      const [callArg] = create.mock.calls[0] as [{ data: { scopes: unknown } }];
      expect(callArg.data.scopes).not.toBe(grant.scopes);
      expect(returned.enrolment).toBeNull();
    });

    it('carries an assisted-enrolment consent through to the enrolmentMethod/enrolmentRecordedBy columns', async () => {
      const create = vi.fn().mockResolvedValue({
        ...delegationRow,
        enrolmentMethod: 'WITNESSED',
        enrolmentRecordedBy: 'clinic-front-desk',
      });
      const store = new PrismaFamilyGrantsStore(fakePrisma({ delegationGrant: { create } }));
      const grant = {
        id: 'd-1',
        granterId: 'janaki',
        delegateId: 'arjun',
        scopes: ['VIEW_RECORD'] as const,
        grantedAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-12-31T00:00:00.000Z',
        revokedAt: null,
        enrolment: { method: 'WITNESSED' as const, recordedBy: 'clinic-front-desk' },
      };

      const returned = await store.createDelegation(grant);

      const [callArg] = create.mock.calls[0] as [{ data: { enrolmentMethod: unknown; enrolmentRecordedBy: unknown } }];
      expect(callArg.data.enrolmentMethod).toBe('WITNESSED');
      expect(callArg.data.enrolmentRecordedBy).toBe('clinic-front-desk');
      expect(returned.enrolment).toEqual({ method: 'WITNESSED', recordedBy: 'clinic-front-desk' });
    });
  });

  describe('findDelegation', () => {
    it('resolves by id and returns null when no row matches', async () => {
      const findUnique = vi.fn().mockResolvedValueOnce(delegationRow).mockResolvedValueOnce(null);
      const store = new PrismaFamilyGrantsStore(fakePrisma({ delegationGrant: { findUnique } }));

      expect(await store.findDelegation('d-1')).toEqual(
        expect.objectContaining({ id: 'd-1', granterId: 'janaki', delegateId: 'arjun' }),
      );
      expect(findUnique).toHaveBeenCalledWith({ where: { id: 'd-1' } });
      expect(await store.findDelegation('no-such-id')).toBeNull();
    });
  });

  describe('saveDelegation', () => {
    it('writes every field back by id, not a narrower partial update', async () => {
      const update = vi.fn().mockResolvedValue({ ...delegationRow, revokedAt: new Date('2026-06-01T00:00:00.000Z') });
      const store = new PrismaFamilyGrantsStore(fakePrisma({ delegationGrant: { update } }));
      const revoked = {
        id: 'd-1',
        granterId: 'janaki',
        delegateId: 'arjun',
        scopes: ['VIEW_RECORD'] as const,
        grantedAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-12-31T00:00:00.000Z',
        revokedAt: '2026-06-01T00:00:00.000Z',
        enrolment: null,
      };

      const returned = await store.saveDelegation(revoked);

      expect(update).toHaveBeenCalledWith({
        where: { id: 'd-1' },
        data: {
          granterId: 'janaki',
          delegateId: 'arjun',
          scopes: ['VIEW_RECORD'],
          grantedAt: new Date('2026-01-01T00:00:00.000Z'),
          expiresAt: new Date('2026-12-31T00:00:00.000Z'),
          revokedAt: new Date('2026-06-01T00:00:00.000Z'),
          enrolmentMethod: null,
          enrolmentRecordedBy: null,
        },
      });
      expect(returned.revokedAt).toBe('2026-06-01T00:00:00.000Z');
    });
  });

  describe('enrolment mapping (toEnrolment, via delegationsFor)', () => {
    it('maps a fully-null enrolment pair to null', async () => {
      const findMany = vi.fn().mockResolvedValue([delegationRow]);
      const store = new PrismaFamilyGrantsStore(fakePrisma({ delegationGrant: { findMany } }));

      const results = await store.delegationsFor('arjun');

      expect(results).toHaveLength(1);
      expect(results[0]?.enrolment).toBeNull();
    });

    it('maps a fully-set enrolment pair to an AssistedEnrolmentConsent', async () => {
      const findMany = vi.fn().mockResolvedValue([
        { ...delegationRow, enrolmentMethod: 'CLINICIAN_ATTESTED', enrolmentRecordedBy: 'dr-shrestha' },
      ]);
      const store = new PrismaFamilyGrantsStore(fakePrisma({ delegationGrant: { findMany } }));

      const results = await store.delegationsFor('arjun');

      expect(results).toHaveLength(1);
      expect(results[0]?.enrolment).toEqual({ method: 'CLINICIAN_ATTESTED', recordedBy: 'dr-shrestha' });
    });

    it('throws a data-integrity error rather than guessing when only one half of the enrolment pair is set', async () => {
      const findMany = vi.fn().mockResolvedValue([{ ...delegationRow, enrolmentMethod: 'WRITTEN', enrolmentRecordedBy: null }]);
      const store = new PrismaFamilyGrantsStore(fakePrisma({ delegationGrant: { findMany } }));

      await expect(store.delegationsFor('arjun')).rejects.toThrow(/partially-set enrolment pair/);
    });

    it('also throws when recordedBy is set but method is null', async () => {
      const findMany = vi.fn().mockResolvedValue([{ ...delegationRow, enrolmentMethod: null, enrolmentRecordedBy: 'someone' }]);
      const store = new PrismaFamilyGrantsStore(fakePrisma({ delegationGrant: { findMany } }));

      await expect(store.delegationsFor('arjun')).rejects.toThrow(/partially-set enrolment pair/);
    });
  });
});

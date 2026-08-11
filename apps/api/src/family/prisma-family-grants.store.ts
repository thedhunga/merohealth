import { Injectable } from '@nestjs/common';
import type { AssistedEnrolmentConsent, ConsentMethod, DelegationGrant, GuardianshipGrant } from '@swasthya/family';
import { PrismaService } from '../prisma/prisma.service.js';
import type { FamilyGrantsStore } from './family-grants.store.js';

/**
 * The real `FamilyGrantsStore`, backing it with the tables the migration
 * accompanying this task added to `packages/database`'s schema.
 * `@swasthya/database`'s public surface (`src/index.ts`) only re-exports
 * `PrismaClient` and the enum unions, not per-model row types — the same
 * reason `PrismaAuthStore` never imports one either — so the row shape is
 * left to inference from `findMany`'s own return type rather than a named
 * import. The only real mapping work is Prisma's `DateTime` → the ISO
 * strings `GuardianshipGrant`/`DelegationGrant` are typed with, and
 * reassembling `DelegationGrant.enrolment` from the two nullable columns it
 * is stored as — see `toEnrolment` below for why that pairing is asserted
 * rather than trusted.
 */
@Injectable()
export class PrismaFamilyGrantsStore implements FamilyGrantsStore {
  constructor(private readonly prisma: PrismaService) {}

  async guardianshipsFor(guardianId: string): Promise<readonly GuardianshipGrant[]> {
    const rows = await this.prisma.client.guardianshipGrant.findMany({ where: { guardianId } });
    return rows.map((row) => ({
      id: row.id,
      wardId: row.wardId,
      guardianId: row.guardianId,
      grounds: row.grounds,
      grantedAt: row.grantedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    }));
  }

  async delegationsFor(delegateId: string): Promise<readonly DelegationGrant[]> {
    const rows = await this.prisma.client.delegationGrant.findMany({ where: { delegateId } });
    return rows.map(toDelegationGrant);
  }

  async delegationsGrantedBy(granterId: string): Promise<readonly DelegationGrant[]> {
    const rows = await this.prisma.client.delegationGrant.findMany({ where: { granterId } });
    return rows.map(toDelegationGrant);
  }

  /**
   * `grant.id` is already a caller-generated uuid (`randomUUID()` in
   * `FamilyGrantsService.createDelegation`), so this is a plain insert, not
   * an upsert — there is no path that creates the same grant twice.
   */
  async createDelegation(grant: DelegationGrant): Promise<DelegationGrant> {
    const row = await this.prisma.client.delegationGrant.create({
      data: {
        id: grant.id,
        granterId: grant.granterId,
        delegateId: grant.delegateId,
        scopes: [...grant.scopes],
        grantedAt: new Date(grant.grantedAt),
        expiresAt: new Date(grant.expiresAt),
        revokedAt: grant.revokedAt ? new Date(grant.revokedAt) : null,
        enrolmentMethod: grant.enrolment?.method ?? null,
        enrolmentRecordedBy: grant.enrolment?.recordedBy ?? null,
      },
    });
    return toDelegationGrant(row);
  }

  async findDelegation(id: string): Promise<DelegationGrant | null> {
    const row = await this.prisma.client.delegationGrant.findUnique({ where: { id } });
    return row ? toDelegationGrant(row) : null;
  }

  /**
   * `FamilyGrantsService.revokeDelegation` is the only caller today and only
   * ever changes `revokedAt`, but this writes every field back rather than a
   * narrower `{ revokedAt }` update — the same "persist what the domain
   * function produced, verbatim" contract `createDelegation` already follows
   * for the grant it receives.
   */
  async saveDelegation(grant: DelegationGrant): Promise<DelegationGrant> {
    const row = await this.prisma.client.delegationGrant.update({
      where: { id: grant.id },
      data: {
        granterId: grant.granterId,
        delegateId: grant.delegateId,
        scopes: [...grant.scopes],
        grantedAt: new Date(grant.grantedAt),
        expiresAt: new Date(grant.expiresAt),
        revokedAt: grant.revokedAt ? new Date(grant.revokedAt) : null,
        enrolmentMethod: grant.enrolment?.method ?? null,
        enrolmentRecordedBy: grant.enrolment?.recordedBy ?? null,
      },
    });
    return toDelegationGrant(row);
  }
}

/** Shared by `delegationsFor` and `createDelegation` so the row shape has exactly one place to map from Prisma's `DateTime`/enrolment columns. */
function toDelegationGrant(row: {
  id: string;
  granterId: string;
  delegateId: string;
  scopes: DelegationGrant['scopes'];
  grantedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  enrolmentMethod: ConsentMethod | null;
  enrolmentRecordedBy: string | null;
}): DelegationGrant {
  return {
    id: row.id,
    granterId: row.granterId,
    delegateId: row.delegateId,
    scopes: row.scopes,
    grantedAt: row.grantedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    enrolment: toEnrolment(row),
  };
}

/**
 * `enrolmentMethod`/`enrolmentRecordedBy` are stored as a nullable pair
 * (schema.prisma's own comment on `DelegationGrant` says why: both null or
 * both set, never one alone), so a row where only one is set is a data
 * integrity bug this mapping must not paper over by guessing — silently
 * dropping the method, or inventing a `recordedBy`, would misrepresent
 * whether assisted enrolment happened, which `enrolment`'s own doc comment
 * in `packages/family` says a UI must never do.
 */
function toEnrolment(row: {
  id: string;
  enrolmentMethod: ConsentMethod | null;
  enrolmentRecordedBy: string | null;
}): AssistedEnrolmentConsent | null {
  const { enrolmentMethod, enrolmentRecordedBy } = row;
  if (enrolmentMethod === null && enrolmentRecordedBy === null) return null;
  if (enrolmentMethod !== null && enrolmentRecordedBy !== null) {
    return { method: enrolmentMethod, recordedBy: enrolmentRecordedBy };
  }
  throw new Error(`DelegationGrant ${row.id} has a partially-set enrolment pair — data integrity bug`);
}

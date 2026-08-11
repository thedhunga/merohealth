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
    return rows.map((row) => ({
      id: row.id,
      granterId: row.granterId,
      delegateId: row.delegateId,
      scopes: row.scopes,
      grantedAt: row.grantedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
      enrolment: toEnrolment(row),
    }));
  }
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

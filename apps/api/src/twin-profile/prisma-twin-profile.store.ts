import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ConfirmTwinProfileInput, TwinProfileStore } from './twin-profile-store.js';

/**
 * The real `TwinProfileStore`, backing it with `SubjectTwinFact` — see that
 * model's doc comment in `schema.prisma` for why it is a separate table from
 * the dormant, `patientId`-scoped `TwinFact` model rather than a reuse of it.
 * Every fact already carries its own caller-generated `id`
 * (`TwinProfileService` builds each one via `confirmPatientReportedFact`),
 * so this is a plain `createMany`, never an upsert — confirming the same
 * profile twice from two tabs simply creates two sets of facts, which is an
 * accepted, rare cost of keeping this endpoint idempotency-free rather than
 * inventing a second uniqueness key nothing else needs.
 */
@Injectable()
export class PrismaTwinProfileStore implements TwinProfileStore {
  constructor(private readonly prisma: PrismaService) {}

  async confirmFacts(input: ConfirmTwinProfileInput): Promise<{ created: number }> {
    if (input.facts.length === 0) return { created: 0 };
    const { count } = await this.prisma.client.subjectTwinFact.createMany({
      data: input.facts.map((fact) => ({
        id: fact.id,
        userId: input.userId,
        kind: fact.kind,
        label: fact.label,
        value: fact.value,
        provenance: fact.provenance,
        verification: fact.verification,
        sensitivity: fact.sensitivity,
        recordedAt: new Date(fact.recordedAt),
        version: fact.version,
      })),
    });
    return { created: count };
  }
}

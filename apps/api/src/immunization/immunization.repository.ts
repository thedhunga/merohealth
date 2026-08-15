import { Injectable } from '@nestjs/common';
import type { ImmunizationRecord } from '@swasthya/shared-types';

/**
 * Process-local stand-in for a real store, same convention
 * `ClinicalSummaryRepository`/`ReferralsRepository` already set: the
 * service/controller code above this does not change once the in-memory map
 * is swapped for real persistence, only this file does.
 */
@Injectable()
export class ImmunizationRepository {
  readonly #records = new Map<string, ImmunizationRecord>();

  save(record: ImmunizationRecord): ImmunizationRecord {
    this.#records.set(record.id, record);
    return record;
  }

  find(id: string): ImmunizationRecord | null {
    return this.#records.get(id) ?? null;
  }

  list(patientId?: string): ImmunizationRecord[] {
    return [...this.#records.values()].filter((record) => patientId === undefined || record.patientId === patientId);
  }
}

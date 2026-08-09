import { Injectable } from '@nestjs/common';
import type { PatientRecord } from '@swasthya/shared-types';

/**
 * Process-local stand-in for a real store, same convention `RecordsRepository`
 * and `CredentialingRepository` already set: the service/controller code
 * above this does not change once the in-memory map is swapped for real
 * persistence, only this file does.
 */
@Injectable()
export class PatientRegistryRepository {
  readonly #patients = new Map<string, PatientRecord>();

  save(record: PatientRecord): PatientRecord {
    this.#patients.set(record.id, record);
    return record;
  }

  find(id: string): PatientRecord | null {
    return this.#patients.get(id) ?? null;
  }

  list(): PatientRecord[] {
    return [...this.#patients.values()];
  }
}

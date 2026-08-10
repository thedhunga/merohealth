import { Injectable } from '@nestjs/common';
import type { Prescription } from '@swasthya/shared-types';

/**
 * Process-local stand-in for a real store, same convention
 * `ClinicalSummaryRepository`/`ClinicalChartingRepository` already set: the
 * service/controller code above this does not change once the in-memory map
 * is swapped for real persistence, only this file does.
 */
@Injectable()
export class PrescribingRepository {
  readonly #prescriptions = new Map<string, Prescription>();

  save(prescription: Prescription): Prescription {
    this.#prescriptions.set(prescription.id, prescription);
    return prescription;
  }

  find(id: string): Prescription | null {
    return this.#prescriptions.get(id) ?? null;
  }

  list(patientId?: string): Prescription[] {
    return [...this.#prescriptions.values()].filter(
      (prescription) => patientId === undefined || prescription.patientId === patientId,
    );
  }
}

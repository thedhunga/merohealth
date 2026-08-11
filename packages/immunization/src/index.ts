import type {
  ImmunizationRecord,
  ImmunizationStatus,
  RecordClinicianAdministeredImmunizationInput,
  RecordPatientReportedImmunizationInput,
} from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * Immunization
 *
 * clinical-suite.md capability map row 18: "Immunization records ... Nepal
 * EPI schedule, not US registries." Pure domain layer only, matching every
 * sibling clinical-suite module's own split — see
 * `apps/api/src/immunization/immunization.service.ts` for how
 * `encounterId` is resolved through `clinical-charting`'s port. `patientId`/
 * `encounterId` are accepted here as already-resolved opaque ids, the same
 * split `packages/clinical-summary` already established.
 *
 * See `shared-types`' own header comment on this section for why
 * `vaccineName` is free text rather than a catalogue lookup: no real Nepal
 * EPI schedule dataset exists in this repo, and inventing one would be
 * exactly the fabrication the standing constraints forbid.
 * ------------------------------------------------------------------ */

export class ImmunizationRecordAlreadyVoidedError extends Error {
  constructor(id: string) {
    super(`Immunization record ${id} is already voided`);
    this.name = 'ImmunizationRecordAlreadyVoidedError';
  }
}

/** A patient's own report of a past immunization — `UNVERIFIED`, the same standing `ClinicalSummaryItem`'s own patient-reported items get. */
export function recordPatientReportedImmunization(
  id: string,
  input: RecordPatientReportedImmunizationInput,
  now: string,
): ImmunizationRecord {
  return {
    id,
    patientId: input.patientId,
    vaccineName: input.vaccineName,
    doseNumber: input.doseNumber,
    administeredOn: input.administeredOn,
    provenance: 'PATIENT_REPORTED',
    verification: 'UNVERIFIED',
    administeredByEncounterId: null,
    administeredByClinicianId: null,
    status: 'ACTIVE',
    voidReason: null,
    recordedAt: now,
    updatedAt: now,
    version: 1,
  };
}

/**
 * A dose a clinician entered during a real, open encounter —
 * `CLINICIAN_VERIFIED` from the moment it exists, mirroring
 * `recordClinicianAuthoredItem`'s own reasoning: the person who administered
 * it is also the one who would otherwise have to verify it.
 */
export function recordClinicianAdministeredImmunization(
  id: string,
  patientId: string,
  encounterId: string,
  input: RecordClinicianAdministeredImmunizationInput,
  now: string,
): ImmunizationRecord {
  return {
    id,
    patientId,
    vaccineName: input.vaccineName,
    doseNumber: input.doseNumber,
    administeredOn: input.administeredOn,
    provenance: 'CLINICIAN_ADMINISTERED',
    verification: 'CLINICIAN_VERIFIED',
    administeredByEncounterId: encounterId,
    administeredByClinicianId: input.clinicianId,
    status: 'ACTIVE',
    voidReason: null,
    recordedAt: now,
    updatedAt: now,
    version: 1,
  };
}

function assertNotVoided(record: ImmunizationRecord): void {
  const status: ImmunizationStatus = record.status;
  if (status === 'VOIDED') throw new ImmunizationRecordAlreadyVoidedError(record.id);
}

/**
 * Corrects a mis-entered record (wrong patient, wrong vaccine) — rejected on
 * an already-voided record rather than silently idempotent, matching
 * `resolveItem`'s own "a caller relying on this throwing to detect whether
 * it did anything" reasoning.
 */
export function voidImmunizationRecord(record: ImmunizationRecord, reason: string, now: string): ImmunizationRecord {
  assertNotVoided(record);
  return { ...record, status: 'VOIDED', voidReason: reason, updatedAt: now, version: record.version + 1 };
}

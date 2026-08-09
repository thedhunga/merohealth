import type {
  ClinicalSummaryItem,
  RecordClinicianSummaryItemInput,
  RecordPatientReportedSummaryItemInput,
} from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * Clinical summary
 *
 * clinical-suite.md capability map row 4: "Problem list, allergies,
 * medications ... Extends digital-twin with clinician-authored provenance."
 * This package is the pure domain layer only — `patientId`/`encounterId`
 * are accepted as already-resolved opaque ids, the same split
 * `clinical-charting`'s own package already established for
 * `patientId`/`clinicianId` against patient-registry. Resolving an
 * `encounterId` against a real, open `clinical-charting` encounter is an
 * API-boundary concern (see
 * `apps/api/src/clinical-summary/clinical-summary.service.ts`), not this
 * package's job.
 * ------------------------------------------------------------------ */

export class ClinicalSummaryItemAlreadyResolvedError extends Error {
  constructor(id: string) {
    super(`Clinical summary item ${id} is already resolved`);
    this.name = 'ClinicalSummaryItemAlreadyResolvedError';
  }
}

/**
 * A patient's own report of a condition, allergy or medication — the
 * `digital-twin` companion's own vocabulary (`PATIENT_REPORTED` /
 * `UNVERIFIED`), just scoped to a patient-registry patient rather than a
 * device's signed-in owner.
 */
export function recordPatientReportedItem(
  id: string,
  input: RecordPatientReportedSummaryItemInput,
  now: string,
): ClinicalSummaryItem {
  return {
    id,
    patientId: input.patientId,
    kind: input.kind,
    label: input.label,
    value: input.value,
    status: 'ACTIVE',
    provenance: 'PATIENT_REPORTED',
    verification: 'UNVERIFIED',
    authoredByEncounterId: null,
    authoredByClinicianId: null,
    recordedAt: now,
    updatedAt: now,
    version: 1,
  };
}

/**
 * The capability row's namesake extension: an item a clinician wrote during
 * a real encounter is `CLINICIAN_AUTHORED` and, because the person who
 * authored it is also the one who would otherwise have to verify it,
 * `CLINICIAN_VERIFIED` from the moment it exists — unlike a patient-reported
 * item, there is no separate confirmation step for this codebase to invent.
 */
export function recordClinicianAuthoredItem(
  id: string,
  patientId: string,
  encounterId: string,
  input: RecordClinicianSummaryItemInput,
  now: string,
): ClinicalSummaryItem {
  return {
    id,
    patientId,
    kind: input.kind,
    label: input.label,
    value: input.value,
    status: 'ACTIVE',
    provenance: 'CLINICIAN_AUTHORED',
    verification: 'CLINICIAN_VERIFIED',
    authoredByEncounterId: encounterId,
    authoredByClinicianId: input.clinicianId,
    recordedAt: now,
    updatedAt: now,
    version: 1,
  };
}

/**
 * Rejected on an already-resolved item rather than silently idempotent,
 * matching `scheduling`'s `AppointmentAlreadyCancelledError` and
 * `clinical-charting`'s `EncounterAlreadyClosedError`: a caller relying on
 * this throwing to detect "did my resolve actually do anything" would
 * otherwise get a false positive.
 */
export function resolveItem(item: ClinicalSummaryItem, now: string): ClinicalSummaryItem {
  if (item.status === 'RESOLVED') throw new ClinicalSummaryItemAlreadyResolvedError(item.id);
  return { ...item, status: 'RESOLVED', updatedAt: now, version: item.version + 1 };
}

import type {
  MedicationSafetyFinding,
  OpenPrescriptionInput,
  Prescription,
  PrescriptionLineInput,
  PrescriptionSafetyCheckStatus,
} from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * Prescribing
 *
 * clinical-suite.md capability map row 6: "Nepali formulary, not US EPCS.
 * Safety-critical." §1 of that document is explicit that
 * `docs/compliance/` must lead this module, not trail it — the compliance
 * gap register's "E-prescribing" row names its interim engineering control
 * before any counsel/pharmacy sign-off exists: "signed state machine;
 * controlled items disabled." Both are enforced here, not just documented:
 * `addPrescriptionLine` refuses `isControlledSubstance: true`
 * unconditionally, and `signPrescription` is the one transition that locks
 * a prescription against further edits, the same "sign and lock" property
 * `clinical-charting`'s `closeEncounter` already established.
 *
 * Pure domain layer only, matching every sibling module's own split:
 * `patientId`/`clinicianId`/`encounterId` are accepted as already-resolved
 * opaque ids, and the medication-safety check run at signing time is
 * supplied by the caller (see
 * `apps/api/src/prescribing/prescribing.service.ts`) rather than performed
 * here — this package has no dependency on `medication-safety` at all.
 * ------------------------------------------------------------------ */

export class ControlledSubstanceDisabledError extends Error {
  constructor() {
    super(
      'Controlled substances cannot be prescribed through this system yet — interim control from ' +
        "docs/compliance/compliance-gap-register.md's E-prescribing row, pending counsel/pharmacy approval",
    );
    this.name = 'ControlledSubstanceDisabledError';
  }
}

/**
 * Reused by every mutation that requires an editable prescription
 * (`addPrescriptionLine`, `signPrescription`), the same way
 * `clinical-charting`'s `EncounterNotOpenError`/`assertOpen` covers
 * multiple functions rather than each inventing its own "wrong state"
 * error.
 */
export class PrescriptionNotDraftError extends Error {
  constructor(id: string) {
    super(`Prescription ${id} is not a draft`);
    this.name = 'PrescriptionNotDraftError';
  }
}

/** Signing an empty prescription would lock in nothing to dispense — reject rather than allow a no-op signature. */
export class EmptyPrescriptionError extends Error {
  constructor(id: string) {
    super(`Prescription ${id} has no lines to sign`);
    this.name = 'EmptyPrescriptionError';
  }
}

/** A prescription must be signed before it can be voided — voiding a draft is meaningless; just never sign it. */
export class PrescriptionNotSignedError extends Error {
  constructor(id: string) {
    super(`Prescription ${id} is not signed`);
    this.name = 'PrescriptionNotSignedError';
  }
}

/**
 * Rejected rather than silently idempotent, matching
 * `EncounterAlreadyClosedError`/`AppointmentAlreadyCancelledError`/
 * `ClinicalSummaryItemAlreadyResolvedError`'s own precedent: a caller
 * relying on this throwing to detect "did my void actually do anything"
 * would otherwise get a false positive.
 */
export class PrescriptionAlreadyVoidedError extends Error {
  constructor(id: string) {
    super(`Prescription ${id} is already voided`);
    this.name = 'PrescriptionAlreadyVoidedError';
  }
}

export function openPrescription(
  id: string,
  patientId: string,
  encounterId: string,
  input: OpenPrescriptionInput,
  now: string,
): Prescription {
  return {
    id,
    patientId,
    clinicianId: input.clinicianId,
    encounterId,
    status: 'DRAFT',
    lines: [],
    safetyCheckStatus: null,
    safetyFindings: [],
    signedAttestation: null,
    signedAt: null,
    voidedAt: null,
    voidReason: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function assertDraft(prescription: Prescription): void {
  if (prescription.status !== 'DRAFT') throw new PrescriptionNotDraftError(prescription.id);
}

/**
 * The compliance register's "controlled items disabled" control, enforced
 * unconditionally — not looked up against a formulary, because no
 * formulary dataset with real controlled-substance flags exists in this
 * repository yet (see `packages/medication-safety`'s own empty-ruleset
 * precedent for why that gap is honest rather than an oversight). Whatever
 * a future formulary says, a line asserted `isControlledSubstance: true`
 * is refused here until that register row moves past its launch gate.
 */
export function addPrescriptionLine(
  prescription: Prescription,
  id: string,
  input: PrescriptionLineInput,
  now: string,
): Prescription {
  assertDraft(prescription);
  if (input.isControlledSubstance) throw new ControlledSubstanceDisabledError();

  const line = {
    id,
    label: input.label,
    dosageInstructions: input.dosageInstructions,
    quantity: input.quantity,
    isControlledSubstance: false as const,
  };
  return { ...prescription, lines: [...prescription.lines, line], updatedAt: now, version: prescription.version + 1 };
}

/**
 * The "signed state machine" itself: once this returns, the prescription is
 * locked (`assertDraft` above refuses any further line). `safetyCheckStatus`
 * and `safetyFindings` are supplied by the caller, already computed against
 * `medication-safety` — clinical-suite.md §2's own worked example, "the
 * prescription records that it was written without automated checking,"
 * applied through `UNAVAILABLE` rather than this package silently omitting
 * the field. `attestation` is a typed confirmation of intent, not a
 * cryptographic signature — this repository has no PKI, and inventing one
 * to satisfy "signed" would be an unearned assurance the standing
 * constraints forbid.
 */
export function signPrescription(
  prescription: Prescription,
  attestation: string,
  safetyCheckStatus: PrescriptionSafetyCheckStatus,
  safetyFindings: readonly MedicationSafetyFinding[],
  now: string,
): Prescription {
  assertDraft(prescription);
  if (prescription.lines.length === 0) throw new EmptyPrescriptionError(prescription.id);

  return {
    ...prescription,
    status: 'SIGNED',
    safetyCheckStatus,
    safetyFindings,
    signedAttestation: attestation,
    signedAt: now,
    updatedAt: now,
    version: prescription.version + 1,
  };
}

/**
 * Real prescribing workflow: a signed prescription is a legal document that
 * is corrected by voiding and reissuing, never by silent edit. Only reaches
 * a signed prescription — a draft is abandoned by simply never signing it,
 * so there is no `PrescriptionNotDraftError`-style guard needed here.
 */
export function voidPrescription(prescription: Prescription, reason: string, now: string): Prescription {
  if (prescription.status === 'VOIDED') throw new PrescriptionAlreadyVoidedError(prescription.id);
  if (prescription.status === 'DRAFT') throw new PrescriptionNotSignedError(prescription.id);

  return { ...prescription, status: 'VOIDED', voidedAt: now, voidReason: reason, updatedAt: now, version: prescription.version + 1 };
}

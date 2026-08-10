import type { Prescription } from '@swasthya/shared-types';
import { describe, expect, it } from 'vitest';
import {
  addPrescriptionLine,
  ControlledSubstanceDisabledError,
  EmptyPrescriptionError,
  openPrescription,
  PrescriptionAlreadyVoidedError,
  PrescriptionNotDraftError,
  PrescriptionNotSignedError,
  signPrescription,
  voidPrescription,
} from './index.js';

const lineInput = {
  label: 'Amoxicillin 500mg capsule',
  dosageInstructions: 'One capsule three times daily for seven days',
  quantity: '21 capsules',
  isControlledSubstance: false,
};

function makeDraft(): Prescription {
  return openPrescription('rx-1', 'patient-1', 'enc-1', { clinicianId: 'clinician-1' }, '2026-08-10T00:00:00.000Z');
}

describe('openPrescription', () => {
  it('builds a DRAFT prescription at version 1 with no lines and no safety-check result yet', () => {
    const prescription = makeDraft();

    expect(prescription).toEqual({
      id: 'rx-1',
      patientId: 'patient-1',
      clinicianId: 'clinician-1',
      encounterId: 'enc-1',
      status: 'DRAFT',
      lines: [],
      safetyCheckStatus: null,
      safetyFindings: [],
      signedAttestation: null,
      signedAt: null,
      voidedAt: null,
      voidReason: null,
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
      version: 1,
    });
  });
});

describe('addPrescriptionLine', () => {
  it('appends a line and bumps version', () => {
    const withLine = addPrescriptionLine(makeDraft(), 'line-1', lineInput, '2026-08-10T00:05:00.000Z');

    expect(withLine.lines).toEqual([{ id: 'line-1', ...lineInput }]);
    expect(withLine.version).toBe(2);
  });

  it('refuses a line marked as a controlled substance, unconditionally', () => {
    expect(() =>
      addPrescriptionLine(makeDraft(), 'line-1', { ...lineInput, isControlledSubstance: true }, '2026-08-10T00:05:00.000Z'),
    ).toThrow(ControlledSubstanceDisabledError);
  });

  it('refuses to add a line once the prescription is signed', () => {
    const withLine = addPrescriptionLine(makeDraft(), 'line-1', lineInput, '2026-08-10T00:05:00.000Z');
    const signed = signPrescription(withLine, 'Dr. Shrestha', 'CHECKED', [], '2026-08-10T00:10:00.000Z');

    expect(() => addPrescriptionLine(signed, 'line-2', lineInput, '2026-08-10T00:15:00.000Z')).toThrow(
      PrescriptionNotDraftError,
    );
  });
});

describe('signPrescription', () => {
  it('locks the prescription, records the safety-check result and the attestation', () => {
    const withLine = addPrescriptionLine(makeDraft(), 'line-1', lineInput, '2026-08-10T00:05:00.000Z');
    const finding = { kind: 'ALLERGY_CONFLICT' as const, conflictsWithItemId: 'item-1', detail: 'conflict' };

    const signed = signPrescription(withLine, 'Dr. Shrestha', 'CHECKED', [finding], '2026-08-10T00:10:00.000Z');

    expect(signed.status).toBe('SIGNED');
    expect(signed.safetyCheckStatus).toBe('CHECKED');
    expect(signed.safetyFindings).toEqual([finding]);
    expect(signed.signedAttestation).toBe('Dr. Shrestha');
    expect(signed.signedAt).toBe('2026-08-10T00:10:00.000Z');
    expect(signed.version).toBe(3);
  });

  it('records UNAVAILABLE with no findings when medication-safety could not be checked', () => {
    const withLine = addPrescriptionLine(makeDraft(), 'line-1', lineInput, '2026-08-10T00:05:00.000Z');

    const signed = signPrescription(withLine, 'Dr. Shrestha', 'UNAVAILABLE', [], '2026-08-10T00:10:00.000Z');

    expect(signed.safetyCheckStatus).toBe('UNAVAILABLE');
    expect(signed.safetyFindings).toEqual([]);
  });

  it('refuses to sign a prescription with no lines', () => {
    expect(() => signPrescription(makeDraft(), 'Dr. Shrestha', 'CHECKED', [], '2026-08-10T00:10:00.000Z')).toThrow(
      EmptyPrescriptionError,
    );
  });

  it('refuses to sign an already-signed prescription', () => {
    const withLine = addPrescriptionLine(makeDraft(), 'line-1', lineInput, '2026-08-10T00:05:00.000Z');
    const signed = signPrescription(withLine, 'Dr. Shrestha', 'CHECKED', [], '2026-08-10T00:10:00.000Z');

    expect(() => signPrescription(signed, 'Dr. Shrestha', 'CHECKED', [], '2026-08-10T00:15:00.000Z')).toThrow(
      PrescriptionNotDraftError,
    );
  });
});

describe('voidPrescription', () => {
  it('voids a signed prescription and records the reason', () => {
    const withLine = addPrescriptionLine(makeDraft(), 'line-1', lineInput, '2026-08-10T00:05:00.000Z');
    const signed = signPrescription(withLine, 'Dr. Shrestha', 'CHECKED', [], '2026-08-10T00:10:00.000Z');

    const voided = voidPrescription(signed, 'Wrong dosage entered', '2026-08-10T00:20:00.000Z');

    expect(voided.status).toBe('VOIDED');
    expect(voided.voidedAt).toBe('2026-08-10T00:20:00.000Z');
    expect(voided.voidReason).toBe('Wrong dosage entered');
    expect(voided.version).toBe(4);
  });

  it('refuses to void a draft that was never signed', () => {
    expect(() => voidPrescription(makeDraft(), 'Changed my mind', '2026-08-10T00:20:00.000Z')).toThrow(
      PrescriptionNotSignedError,
    );
  });

  it('refuses to void an already-voided prescription', () => {
    const withLine = addPrescriptionLine(makeDraft(), 'line-1', lineInput, '2026-08-10T00:05:00.000Z');
    const signed = signPrescription(withLine, 'Dr. Shrestha', 'CHECKED', [], '2026-08-10T00:10:00.000Z');
    const voided = voidPrescription(signed, 'Wrong dosage entered', '2026-08-10T00:20:00.000Z');

    expect(() => voidPrescription(voided, 'Again', '2026-08-10T00:25:00.000Z')).toThrow(PrescriptionAlreadyVoidedError);
  });
});

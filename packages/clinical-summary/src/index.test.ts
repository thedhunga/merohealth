import { describe, expect, it } from 'vitest';
import {
  ClinicalSummaryItemAlreadyResolvedError,
  recordClinicianAuthoredItem,
  recordPatientReportedItem,
  resolveItem,
} from './index.js';

const now = '2026-08-09T09:00:00.000Z';

describe('recordPatientReportedItem', () => {
  it('records an active, unverified, patient-reported item', () => {
    const item = recordPatientReportedItem(
      'item-1',
      { patientId: 'patient-1', kind: 'ALLERGY', label: 'Penicillin', value: 'Rash' },
      now,
    );

    expect(item).toMatchObject({
      patientId: 'patient-1',
      kind: 'ALLERGY',
      status: 'ACTIVE',
      provenance: 'PATIENT_REPORTED',
      verification: 'UNVERIFIED',
      authoredByEncounterId: null,
      authoredByClinicianId: null,
      version: 1,
    });
  });
});

describe('recordClinicianAuthoredItem', () => {
  it('records an active, clinician-verified item stamped with the authoring encounter and clinician', () => {
    const item = recordClinicianAuthoredItem(
      'item-2',
      'patient-1',
      'encounter-1',
      { clinicianId: 'clinician-1', kind: 'CONDITION', label: 'Type 2 diabetes', value: 'Diagnosed 2026' },
      now,
    );

    expect(item).toMatchObject({
      patientId: 'patient-1',
      kind: 'CONDITION',
      status: 'ACTIVE',
      provenance: 'CLINICIAN_AUTHORED',
      verification: 'CLINICIAN_VERIFIED',
      authoredByEncounterId: 'encounter-1',
      authoredByClinicianId: 'clinician-1',
      version: 1,
    });
  });
});

describe('resolveItem', () => {
  it('marks an active item resolved and bumps its version', () => {
    const item = recordPatientReportedItem(
      'item-1',
      { patientId: 'patient-1', kind: 'MEDICATION', label: 'Metformin', value: '500mg twice daily' },
      now,
    );

    const resolved = resolveItem(item, '2026-08-10T09:00:00.000Z');
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.updatedAt).toBe('2026-08-10T09:00:00.000Z');
    expect(resolved.version).toBe(2);
  });

  it('rejects resolving an already-resolved item', () => {
    const item = recordPatientReportedItem(
      'item-1',
      { patientId: 'patient-1', kind: 'CONDITION', label: 'Seasonal flu', value: 'Self-limiting' },
      now,
    );
    const resolved = resolveItem(item, now);

    expect(() => resolveItem(resolved, now)).toThrow(ClinicalSummaryItemAlreadyResolvedError);
  });
});

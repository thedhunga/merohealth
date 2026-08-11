import { describe, expect, it } from 'vitest';
import {
  ImmunizationRecordAlreadyVoidedError,
  recordClinicianAdministeredImmunization,
  recordPatientReportedImmunization,
  voidImmunizationRecord,
} from './index.js';

const now = '2026-08-11T09:00:00.000Z';

describe('recordPatientReportedImmunization', () => {
  it('records an active, unverified, patient-reported record', () => {
    const record = recordPatientReportedImmunization(
      'record-1',
      { patientId: 'patient-1', vaccineName: 'Tetanus toxoid', doseNumber: 1, administeredOn: '2020-01-15' },
      now,
    );

    expect(record).toMatchObject({
      patientId: 'patient-1',
      vaccineName: 'Tetanus toxoid',
      doseNumber: 1,
      administeredOn: '2020-01-15',
      status: 'ACTIVE',
      provenance: 'PATIENT_REPORTED',
      verification: 'UNVERIFIED',
      administeredByEncounterId: null,
      administeredByClinicianId: null,
      voidReason: null,
      version: 1,
    });
  });
});

describe('recordClinicianAdministeredImmunization', () => {
  it('records an active, clinician-verified record stamped with the administering encounter and clinician', () => {
    const record = recordClinicianAdministeredImmunization(
      'record-2',
      'patient-1',
      'encounter-1',
      { clinicianId: 'clinician-1', vaccineName: 'Hepatitis B', doseNumber: 2, administeredOn: '2026-08-11' },
      now,
    );

    expect(record).toMatchObject({
      patientId: 'patient-1',
      vaccineName: 'Hepatitis B',
      doseNumber: 2,
      status: 'ACTIVE',
      provenance: 'CLINICIAN_ADMINISTERED',
      verification: 'CLINICIAN_VERIFIED',
      administeredByEncounterId: 'encounter-1',
      administeredByClinicianId: 'clinician-1',
      version: 1,
    });
  });
});

describe('voidImmunizationRecord', () => {
  it('voids an active record with a reason and bumps its version', () => {
    const record = recordPatientReportedImmunization(
      'record-1',
      { patientId: 'patient-1', vaccineName: 'Measles', doseNumber: 1, administeredOn: '2019-06-01' },
      now,
    );

    const voided = voidImmunizationRecord(record, 'Entered against the wrong patient', '2026-08-12T09:00:00.000Z');
    expect(voided.status).toBe('VOIDED');
    expect(voided.voidReason).toBe('Entered against the wrong patient');
    expect(voided.updatedAt).toBe('2026-08-12T09:00:00.000Z');
    expect(voided.version).toBe(2);
  });

  it('rejects voiding an already-voided record', () => {
    const record = recordPatientReportedImmunization(
      'record-1',
      { patientId: 'patient-1', vaccineName: 'Polio', doseNumber: 3, administeredOn: '2018-03-01' },
      now,
    );
    const voided = voidImmunizationRecord(record, 'Duplicate entry', now);

    expect(() => voidImmunizationRecord(voided, 'Second attempt', now)).toThrow(ImmunizationRecordAlreadyVoidedError);
  });
});

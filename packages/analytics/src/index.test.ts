import type { Appointment, PatientRecord } from '@swasthya/shared-types';
import { describe, expect, it } from 'vitest';
import { buildPatientRegistrySummary, buildSchedulingSummary } from './index.js';

const now = '2026-08-11T09:00:00.000Z';

function patient(overrides: Partial<PatientRecord['demographics']> & Pick<PatientRecord, 'id'>): PatientRecord {
  const { id, ...demographicOverrides } = overrides;
  return {
    id,
    demographics: {
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
      ...demographicOverrides,
    },
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function appointment(overrides: Partial<Appointment> & Pick<Appointment, 'id' | 'patientId'>): Appointment {
  return {
    clinicianId: 'clinician-1',
    scheduledStart: '2026-09-01T09:00:00.000Z',
    scheduledEnd: '2026-09-01T09:30:00.000Z',
    status: 'SCHEDULED',
    createdAt: now,
    updatedAt: now,
    version: 1,
    ...overrides,
  };
}

describe('buildPatientRegistrySummary', () => {
  it('reports zero for every sex when the registry is empty', () => {
    expect(buildPatientRegistrySummary([])).toEqual({
      totalPatients: 0,
      bySex: { FEMALE: 0, MALE: 0, OTHER: 0, UNDISCLOSED: 0 },
    });
  });

  it('counts total patients and breaks the count down by recorded sex', () => {
    const patients = [
      patient({ id: 'patient-1', sex: 'FEMALE' }),
      patient({ id: 'patient-2', sex: 'FEMALE' }),
      patient({ id: 'patient-3', sex: 'MALE' }),
      patient({ id: 'patient-4', sex: 'UNDISCLOSED' }),
    ];

    expect(buildPatientRegistrySummary(patients)).toEqual({
      totalPatients: 4,
      bySex: { FEMALE: 2, MALE: 1, OTHER: 0, UNDISCLOSED: 1 },
    });
  });
});

describe('buildSchedulingSummary', () => {
  it('reports zero for every status when there are no appointments', () => {
    expect(buildSchedulingSummary([])).toEqual({
      totalAppointments: 0,
      byStatus: { SCHEDULED: 0, CANCELLED: 0 },
    });
  });

  it('counts total appointments and breaks the count down by status', () => {
    const appointments = [
      appointment({ id: 'appt-1', patientId: 'patient-1', status: 'SCHEDULED' }),
      appointment({ id: 'appt-2', patientId: 'patient-1', status: 'SCHEDULED' }),
      appointment({ id: 'appt-3', patientId: 'patient-2', status: 'CANCELLED' }),
    ];

    expect(buildSchedulingSummary(appointments)).toEqual({
      totalAppointments: 3,
      byStatus: { SCHEDULED: 2, CANCELLED: 1 },
    });
  });
});

import { describe, expect, it } from 'vitest';
import { TeleconsultationRepository } from './teleconsultation.repository.js';

const base = {
  status: 'SCHEDULED' as const,
  connectionMode: 'MOCK' as const,
  startedAt: null,
  endedAt: null,
  cancelledAt: null,
  cancelReason: null,
  noShowAt: null,
  createdAt: '2026-08-10T00:00:00.000Z',
  updatedAt: '2026-08-10T00:00:00.000Z',
  version: 1,
};

describe('TeleconsultationRepository', () => {
  it('starts empty', () => {
    expect(new TeleconsultationRepository().list()).toEqual([]);
  });

  it('finds a saved session by id and returns null for an unknown one', () => {
    const repository = new TeleconsultationRepository();
    const session = { ...base, id: 'session-1', patientId: 'patient-1', clinicianId: 'clinician-1', appointmentId: 'appt-1' };

    repository.save(session);

    expect(repository.find('session-1')).toEqual(session);
    expect(repository.find('missing')).toBeNull();
  });

  it('lists only the requested patient when patientId is given', () => {
    const repository = new TeleconsultationRepository();
    repository.save({ ...base, id: 'session-1', patientId: 'patient-1', clinicianId: 'clinician-1', appointmentId: 'appt-1' });
    repository.save({ ...base, id: 'session-2', patientId: 'patient-2', clinicianId: 'clinician-1', appointmentId: 'appt-2' });

    expect(repository.list('patient-1').map((session) => session.id)).toEqual(['session-1']);
  });
});

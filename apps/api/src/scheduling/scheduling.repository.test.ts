import type { Appointment } from '@swasthya/shared-types';
import { describe, expect, it } from 'vitest';
import { SchedulingRepository } from './scheduling.repository.js';

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'appt-1',
    patientId: 'patient-1',
    clinicianId: 'clinician-1',
    scheduledStart: '2026-08-10T09:00:00.000Z',
    scheduledEnd: '2026-08-10T09:30:00.000Z',
    status: 'SCHEDULED',
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

describe('SchedulingRepository', () => {
  it('round-trips a saved appointment by id', () => {
    const repository = new SchedulingRepository();
    repository.save(makeAppointment());

    expect(repository.find('appt-1')?.patientId).toBe('patient-1');
    expect(repository.find('missing')).toBeNull();
  });

  it('overwrites rather than duplicates on a second save with the same id', () => {
    const repository = new SchedulingRepository();
    repository.save(makeAppointment({ version: 1 }));
    repository.save(makeAppointment({ version: 2, status: 'CANCELLED' }));

    expect(repository.list()).toHaveLength(1);
    expect(repository.find('appt-1')?.status).toBe('CANCELLED');
  });

  it('lists every saved appointment', () => {
    const repository = new SchedulingRepository();
    repository.save(makeAppointment({ id: 'appt-1' }));
    repository.save(makeAppointment({ id: 'appt-2' }));

    expect(repository.list().map((appointment) => appointment.id).toSorted()).toEqual(['appt-1', 'appt-2']);
  });
});

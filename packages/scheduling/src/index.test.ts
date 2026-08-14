import type { Appointment } from '@swasthya/shared-types';
import { describe, expect, it } from 'vitest';
import {
  AppointmentAlreadyCancelledError,
  AppointmentConflictError,
  cancelAppointment,
  InvalidAppointmentWindowError,
  scheduleAppointment,
} from './index.js';

const validInput = {
  patientId: 'patient-1',
  clinicianId: 'clinician-1',
  scheduledStart: '2026-08-10T09:00:00.000Z',
  scheduledEnd: '2026-08-10T09:30:00.000Z',
};

describe('scheduleAppointment', () => {
  it('builds a SCHEDULED appointment at version 1', () => {
    const appointment = scheduleAppointment('appt-1', validInput, '2026-08-09T00:00:00.000Z', []);

    expect(appointment).toEqual({
      id: 'appt-1',
      patientId: 'patient-1',
      clinicianId: 'clinician-1',
      scheduledStart: '2026-08-10T09:00:00.000Z',
      scheduledEnd: '2026-08-10T09:30:00.000Z',
      status: 'SCHEDULED',
      createdAt: '2026-08-09T00:00:00.000Z',
      updatedAt: '2026-08-09T00:00:00.000Z',
      version: 1,
    });
  });

  it('rejects an end time at or before the start time', () => {
    expect(() =>
      scheduleAppointment(
        'appt-1',
        { ...validInput, scheduledEnd: validInput.scheduledStart },
        '2026-08-09T00:00:00.000Z',
        [],
      ),
    ).toThrow(InvalidAppointmentWindowError);

    expect(() =>
      scheduleAppointment(
        'appt-1',
        { ...validInput, scheduledEnd: '2026-08-10T08:00:00.000Z' },
        '2026-08-09T00:00:00.000Z',
        [],
      ),
    ).toThrow(InvalidAppointmentWindowError);
  });

  it('rejects an overlapping window for the same clinician', () => {
    const existing = scheduleAppointment('appt-1', validInput, '2026-08-09T00:00:00.000Z', []);

    expect(() =>
      scheduleAppointment(
        'appt-2',
        { ...validInput, scheduledStart: '2026-08-10T09:15:00.000Z', scheduledEnd: '2026-08-10T09:45:00.000Z' },
        '2026-08-09T00:00:00.000Z',
        [existing],
      ),
    ).toThrow(AppointmentConflictError);
  });

  it('allows a back-to-back appointment that starts exactly when the prior one ends', () => {
    const existing = scheduleAppointment('appt-1', validInput, '2026-08-09T00:00:00.000Z', []);

    expect(() =>
      scheduleAppointment(
        'appt-2',
        { ...validInput, scheduledStart: validInput.scheduledEnd, scheduledEnd: '2026-08-10T10:00:00.000Z' },
        '2026-08-09T00:00:00.000Z',
        [existing],
      ),
    ).not.toThrow();
  });

  it('allows an overlapping window for a different clinician', () => {
    const existing = scheduleAppointment('appt-1', validInput, '2026-08-09T00:00:00.000Z', []);

    expect(() =>
      scheduleAppointment(
        'appt-2',
        { ...validInput, clinicianId: 'clinician-2' },
        '2026-08-09T00:00:00.000Z',
        [existing],
      ),
    ).not.toThrow();
  });

  it('allows an overlapping window against an already-cancelled appointment', () => {
    const existing = cancelAppointment(
      scheduleAppointment('appt-1', validInput, '2026-08-09T00:00:00.000Z', []),
      '2026-08-09T01:00:00.000Z',
    );

    expect(() => scheduleAppointment('appt-2', validInput, '2026-08-09T00:00:00.000Z', [existing])).not.toThrow();
  });

  it('rejects an end time that is chronologically before the start despite sorting later as a string', () => {
    // '.9Z' (900ms) is chronologically before '.95Z' (950ms), but as raw
    // strings '.9Z' > '.95Z' because the terminating 'Z' sorts above a digit.
    expect(() =>
      scheduleAppointment(
        'appt-1',
        { ...validInput, scheduledStart: '2026-08-10T09:00:00.95Z', scheduledEnd: '2026-08-10T09:00:00.9Z' },
        '2026-08-09T00:00:00.000Z',
        [],
      ),
    ).toThrow(InvalidAppointmentWindowError);
  });

  it('rejects a double-booking whose window only overlaps once mixed-precision fractions are compared chronologically', () => {
    const existing = scheduleAppointment(
      'appt-1',
      { ...validInput, scheduledStart: '2026-08-10T09:00:00.9Z', scheduledEnd: '2026-08-10T09:30:00.000Z' },
      '2026-08-09T00:00:00.000Z',
      [],
    );

    expect(() =>
      scheduleAppointment(
        'appt-2',
        { ...validInput, scheduledStart: '2026-08-10T08:30:00.000Z', scheduledEnd: '2026-08-10T09:00:00.95Z' },
        '2026-08-09T00:00:00.000Z',
        [existing],
      ),
    ).toThrow(AppointmentConflictError);
  });
});

describe('cancelAppointment', () => {
  function makeScheduled(): Appointment {
    return scheduleAppointment('appt-1', validInput, '2026-08-09T00:00:00.000Z', []);
  }

  it('marks a scheduled appointment CANCELLED and bumps version', () => {
    const appointment = makeScheduled();
    const cancelled = cancelAppointment(appointment, '2026-08-09T01:00:00.000Z');

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.version).toBe(2);
    expect(cancelled.updatedAt).toBe('2026-08-09T01:00:00.000Z');
  });

  it('rejects cancelling an already-cancelled appointment', () => {
    const appointment = makeScheduled();
    const cancelled = cancelAppointment(appointment, '2026-08-09T01:00:00.000Z');

    expect(() => cancelAppointment(cancelled, '2026-08-09T02:00:00.000Z')).toThrow(AppointmentAlreadyCancelledError);
  });
});

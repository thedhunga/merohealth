import type { TeleconsultationSession } from '@swasthya/shared-types';
import { describe, expect, it } from 'vitest';
import {
  cancelTeleconsultation,
  completeTeleconsultation,
  markTeleconsultationNoShow,
  scheduleTeleconsultation,
  startTeleconsultation,
  TeleconsultationSessionAlreadyBookedError,
  TeleconsultationSessionAlreadyCancelledError,
  TeleconsultationSessionNotActiveError,
  TeleconsultationSessionNotScheduledError,
} from './index.js';

function makeSession(): TeleconsultationSession {
  return scheduleTeleconsultation('session-1', 'patient-1', 'clinician-1', 'appt-1', '2026-08-10T00:00:00.000Z', []);
}

describe('scheduleTeleconsultation', () => {
  it('builds a SCHEDULED session at version 1, honestly MOCK', () => {
    const session = makeSession();

    expect(session).toEqual({
      id: 'session-1',
      patientId: 'patient-1',
      clinicianId: 'clinician-1',
      appointmentId: 'appt-1',
      status: 'SCHEDULED',
      connectionMode: 'MOCK',
      startedAt: null,
      endedAt: null,
      cancelledAt: null,
      cancelReason: null,
      noShowAt: null,
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
      version: 1,
    });
  });

  it('refuses a second session for an appointment that already has a SCHEDULED one', () => {
    const existing = makeSession();

    expect(() =>
      scheduleTeleconsultation('session-2', 'patient-1', 'clinician-1', 'appt-1', '2026-08-10T00:05:00.000Z', [
        existing,
      ]),
    ).toThrow(TeleconsultationSessionAlreadyBookedError);
  });

  it('refuses a second session for an appointment that already has an ACTIVE one', () => {
    const active = startTeleconsultation(makeSession(), '2026-08-10T09:00:00.000Z');

    expect(() =>
      scheduleTeleconsultation('session-2', 'patient-1', 'clinician-1', 'appt-1', '2026-08-10T09:01:00.000Z', [
        active,
      ]),
    ).toThrow(TeleconsultationSessionAlreadyBookedError);
  });

  it('allows rebooking an appointment whose only prior session was cancelled, completed or a no-show', () => {
    const cancelled = cancelTeleconsultation(makeSession(), 'Patient rescheduled', '2026-08-10T00:05:00.000Z');
    const completed = completeTeleconsultation(
      startTeleconsultation(makeSession(), '2026-08-10T09:00:00.000Z'),
      '2026-08-10T09:20:00.000Z',
    );
    const noShow = markTeleconsultationNoShow(makeSession(), '2026-08-10T09:10:00.000Z');

    expect(() =>
      scheduleTeleconsultation('session-2', 'patient-1', 'clinician-1', 'appt-1', '2026-08-10T10:00:00.000Z', [
        cancelled,
        completed,
        noShow,
      ]),
    ).not.toThrow();
  });

  it('does not conflict with a SCHEDULED session for a different appointment', () => {
    const other = scheduleTeleconsultation(
      'session-other',
      'patient-1',
      'clinician-1',
      'appt-2',
      '2026-08-10T00:00:00.000Z',
      [],
    );

    expect(() =>
      scheduleTeleconsultation('session-2', 'patient-1', 'clinician-1', 'appt-1', '2026-08-10T00:05:00.000Z', [
        other,
      ]),
    ).not.toThrow();
  });
});

describe('startTeleconsultation', () => {
  it('moves a SCHEDULED session to ACTIVE, recording when', () => {
    const active = startTeleconsultation(makeSession(), '2026-08-10T09:00:00.000Z');

    expect(active.status).toBe('ACTIVE');
    expect(active.startedAt).toBe('2026-08-10T09:00:00.000Z');
    expect(active.version).toBe(2);
  });

  it('refuses to start an already-ACTIVE session', () => {
    const active = startTeleconsultation(makeSession(), '2026-08-10T09:00:00.000Z');

    expect(() => startTeleconsultation(active, '2026-08-10T09:05:00.000Z')).toThrow(
      TeleconsultationSessionNotScheduledError,
    );
  });

  it('refuses to start a cancelled session', () => {
    const cancelled = cancelTeleconsultation(makeSession(), 'Patient rescheduled', '2026-08-10T08:00:00.000Z');

    expect(() => startTeleconsultation(cancelled, '2026-08-10T09:00:00.000Z')).toThrow(
      TeleconsultationSessionNotScheduledError,
    );
  });
});

describe('completeTeleconsultation', () => {
  it('moves an ACTIVE session to COMPLETED, recording when', () => {
    const active = startTeleconsultation(makeSession(), '2026-08-10T09:00:00.000Z');

    const completed = completeTeleconsultation(active, '2026-08-10T09:20:00.000Z');

    expect(completed.status).toBe('COMPLETED');
    expect(completed.endedAt).toBe('2026-08-10T09:20:00.000Z');
    expect(completed.version).toBe(3);
  });

  it('refuses to complete a session that was never started', () => {
    expect(() => completeTeleconsultation(makeSession(), '2026-08-10T09:00:00.000Z')).toThrow(
      TeleconsultationSessionNotActiveError,
    );
  });

  it('refuses to complete an already-completed session', () => {
    const active = startTeleconsultation(makeSession(), '2026-08-10T09:00:00.000Z');
    const completed = completeTeleconsultation(active, '2026-08-10T09:20:00.000Z');

    expect(() => completeTeleconsultation(completed, '2026-08-10T09:25:00.000Z')).toThrow(
      TeleconsultationSessionNotActiveError,
    );
  });
});

describe('cancelTeleconsultation', () => {
  it('moves a SCHEDULED session to CANCELLED with a reason', () => {
    const cancelled = cancelTeleconsultation(makeSession(), 'Patient rescheduled', '2026-08-10T08:00:00.000Z');

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledAt).toBe('2026-08-10T08:00:00.000Z');
    expect(cancelled.cancelReason).toBe('Patient rescheduled');
    expect(cancelled.version).toBe(2);
  });

  it('refuses to cancel an already-cancelled session', () => {
    const cancelled = cancelTeleconsultation(makeSession(), 'Patient rescheduled', '2026-08-10T08:00:00.000Z');

    expect(() => cancelTeleconsultation(cancelled, 'Second attempt', '2026-08-10T08:05:00.000Z')).toThrow(
      TeleconsultationSessionAlreadyCancelledError,
    );
  });

  it('refuses to cancel an ACTIVE session — once started, the only forward move is completing it', () => {
    const active = startTeleconsultation(makeSession(), '2026-08-10T09:00:00.000Z');

    expect(() => cancelTeleconsultation(active, 'Changed mind', '2026-08-10T09:05:00.000Z')).toThrow(
      TeleconsultationSessionNotScheduledError,
    );
  });

  it('refuses to cancel a COMPLETED session', () => {
    const active = startTeleconsultation(makeSession(), '2026-08-10T09:00:00.000Z');
    const completed = completeTeleconsultation(active, '2026-08-10T09:20:00.000Z');

    expect(() => cancelTeleconsultation(completed, 'Too late', '2026-08-10T09:25:00.000Z')).toThrow(
      TeleconsultationSessionNotScheduledError,
    );
  });
});

describe('markTeleconsultationNoShow', () => {
  it('moves a SCHEDULED session to NO_SHOW, recording when', () => {
    const noShow = markTeleconsultationNoShow(makeSession(), '2026-08-10T09:10:00.000Z');

    expect(noShow.status).toBe('NO_SHOW');
    expect(noShow.noShowAt).toBe('2026-08-10T09:10:00.000Z');
    expect(noShow.version).toBe(2);
  });

  it('refuses to mark an ACTIVE session no-show — the patient plainly did show', () => {
    const active = startTeleconsultation(makeSession(), '2026-08-10T09:00:00.000Z');

    expect(() => markTeleconsultationNoShow(active, '2026-08-10T09:10:00.000Z')).toThrow(
      TeleconsultationSessionNotScheduledError,
    );
  });

  it('refuses to mark an already-cancelled session no-show', () => {
    const cancelled = cancelTeleconsultation(makeSession(), 'Patient rescheduled', '2026-08-10T08:00:00.000Z');

    expect(() => markTeleconsultationNoShow(cancelled, '2026-08-10T09:00:00.000Z')).toThrow(
      TeleconsultationSessionNotScheduledError,
    );
  });
});

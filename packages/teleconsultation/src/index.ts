import type { TeleconsultationSession } from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * Teleconsultation
 *
 * clinical-suite.md capability map row 9: "Telehealth ... WebRTC. Already
 * stubbed in apps/mobile." Pure domain layer only, matching every sibling
 * clinical-suite module's own split: `patientId`/`clinicianId` are accepted
 * as already-resolved opaque ids (see
 * `apps/api/src/teleconsultation/teleconsultation.service.ts` for how they
 * are actually derived from the `scheduling` appointment a session is
 * booked against).
 *
 * The state machine is SCHEDULED -> ACTIVE -> COMPLETED, with SCHEDULED
 * also reachable to CANCELLED or NO_SHOW. Once a session has gone ACTIVE it
 * can only be completed — see `startTeleconsultation` below for why cancel
 * and no-show both require `assertScheduled`.
 * ------------------------------------------------------------------ */

/**
 * Reused by every mutation that requires a session still awaiting its start
 * (`startTeleconsultation`, `cancelTeleconsultation` after the
 * already-cancelled check, `markTeleconsultationNoShow`), the same way
 * `packages/diagnostics-orders`'s `DiagnosticOrderNotOpenError` covers
 * multiple functions rather than each inventing its own "wrong state"
 * error.
 */
export class TeleconsultationSessionNotScheduledError extends Error {
  constructor(id: string) {
    super(`Teleconsultation session ${id} is not scheduled — it has already started, ended, or been cancelled`);
    this.name = 'TeleconsultationSessionNotScheduledError';
  }
}

export class TeleconsultationSessionNotActiveError extends Error {
  constructor(id: string) {
    super(`Teleconsultation session ${id} is not active — it must be started before it can be completed`);
    this.name = 'TeleconsultationSessionNotActiveError';
  }
}

/**
 * Rejected rather than silently idempotent, matching
 * `DiagnosticOrderAlreadyCancelledError`'s own precedent: a caller relying
 * on this throwing to detect "did my cancel actually do anything" would
 * otherwise get a false positive.
 */
export class TeleconsultationSessionAlreadyCancelledError extends Error {
  constructor(id: string) {
    super(`Teleconsultation session ${id} is already cancelled`);
    this.name = 'TeleconsultationSessionAlreadyCancelledError';
  }
}

/**
 * A second session for an appointment already covered by a live one is a
 * real impossibility, the same class of bug `scheduling`'s
 * `AppointmentConflictError` guards against — nothing checked for one before
 * this, so a double-click or a client retry on
 * `POST /teleconsultation/appointments/:appointmentId/sessions` created two
 * independently startable/cancellable sessions for one appointment.
 */
export class TeleconsultationSessionAlreadyBookedError extends Error {
  constructor(appointmentId: string) {
    super(`Appointment ${appointmentId} already has a scheduled or active teleconsultation session`);
    this.name = 'TeleconsultationSessionAlreadyBookedError';
  }
}

/**
 * Only SCHEDULED and ACTIVE sessions block a rebooking — CANCELLED,
 * COMPLETED and NO_SHOW have all released the appointment, the same
 * "terminal/settled states free the slot" reasoning `scheduling`'s own
 * conflict check applies to a cancelled appointment.
 */
function assertNoExistingSession(appointmentId: string, existingSessions: readonly TeleconsultationSession[]): void {
  const alreadyBooked = existingSessions.some(
    (session) =>
      session.appointmentId === appointmentId && (session.status === 'SCHEDULED' || session.status === 'ACTIVE'),
  );
  if (alreadyBooked) throw new TeleconsultationSessionAlreadyBookedError(appointmentId);
}

export function scheduleTeleconsultation(
  id: string,
  patientId: string,
  clinicianId: string,
  appointmentId: string,
  now: string,
  existingSessions: readonly TeleconsultationSession[],
): TeleconsultationSession {
  assertNoExistingSession(appointmentId, existingSessions);
  return {
    id,
    patientId,
    clinicianId,
    appointmentId,
    status: 'SCHEDULED',
    // No real signaling/media infrastructure exists in this repository —
    // see this file's header comment and shared-types' own comment on this
    // field. Every session created here is honestly MOCK.
    connectionMode: 'MOCK',
    startedAt: null,
    endedAt: null,
    cancelledAt: null,
    cancelReason: null,
    noShowAt: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function assertScheduled(session: TeleconsultationSession): void {
  if (session.status !== 'SCHEDULED') throw new TeleconsultationSessionNotScheduledError(session.id);
}

export function startTeleconsultation(session: TeleconsultationSession, now: string): TeleconsultationSession {
  assertScheduled(session);
  return { ...session, status: 'ACTIVE', startedAt: now, updatedAt: now, version: session.version + 1 };
}

export function completeTeleconsultation(session: TeleconsultationSession, now: string): TeleconsultationSession {
  if (session.status !== 'ACTIVE') throw new TeleconsultationSessionNotActiveError(session.id);
  return { ...session, status: 'COMPLETED', endedAt: now, updatedAt: now, version: session.version + 1 };
}

/**
 * Only reaches a SCHEDULED session — `assertScheduled` rejects an ACTIVE or
 * COMPLETED one with `TeleconsultationSessionNotScheduledError` (once two
 * people are in the room, the only honest forward transition is completing
 * it), and an already-CANCELLED one gets its own more specific error,
 * checked first so the two wrong-state cases are distinguishable.
 */
export function cancelTeleconsultation(
  session: TeleconsultationSession,
  reason: string,
  now: string,
): TeleconsultationSession {
  if (session.status === 'CANCELLED') throw new TeleconsultationSessionAlreadyCancelledError(session.id);
  assertScheduled(session);
  return { ...session, status: 'CANCELLED', cancelledAt: now, cancelReason: reason, updatedAt: now, version: session.version + 1 };
}

/** Only reaches a SCHEDULED session — same reasoning as `cancelTeleconsultation` above. */
export function markTeleconsultationNoShow(session: TeleconsultationSession, now: string): TeleconsultationSession {
  assertScheduled(session);
  return { ...session, status: 'NO_SHOW', noShowAt: now, updatedAt: now, version: session.version + 1 };
}

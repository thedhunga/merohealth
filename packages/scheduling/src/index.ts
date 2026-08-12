import type { Appointment, AppointmentStatus, ScheduleAppointmentInput } from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * Scheduling
 *
 * clinical-suite.md capability map row 2: "Scheduling, resource calendars
 * ... Degrades to READ_ONLY without the registry." This package is the pure
 * domain layer only — `patientId` is accepted as an already-resolved opaque
 * id; verifying it actually exists in patient-registry, and refusing writes
 * when that module is unavailable, are both API-boundary concerns (see
 * `apps/api/src/scheduling/scheduling.service.ts`), not this package's job —
 * the same "domain shape in shared-types, behaviour in the owning package,
 * cross-module reference resolved through the owning module's port" split
 * `patient-registry` already established.
 * ------------------------------------------------------------------ */

export class InvalidAppointmentWindowError extends Error {
  constructor(scheduledStart: string, scheduledEnd: string) {
    super(`Appointment end ${scheduledEnd} is not after start ${scheduledStart}`);
    this.name = 'InvalidAppointmentWindowError';
  }
}

export class AppointmentAlreadyCancelledError extends Error {
  constructor(id: string) {
    super(`Appointment ${id} is already cancelled`);
    this.name = 'AppointmentAlreadyCancelledError';
  }
}

export class AppointmentConflictError extends Error {
  constructor(clinicianId: string, scheduledStart: string, scheduledEnd: string) {
    super(`Clinician ${clinicianId} already has a scheduled appointment overlapping ${scheduledStart}–${scheduledEnd}`);
    this.name = 'AppointmentConflictError';
  }
}

/**
 * The one scheduling invariant worth enforcing below the API boundary: an
 * appointment that ends at or before it starts is not a malformed request,
 * it is an impossible calendar entry — the same "real impossibility, not
 * just a shape check zod already covers" reasoning `patient-registry`'s own
 * `assertPlausibleDateOfBirth` used for a future birth date.
 */
function assertValidWindow(scheduledStart: string, scheduledEnd: string): void {
  if (scheduledEnd <= scheduledStart) throw new InvalidAppointmentWindowError(scheduledStart, scheduledEnd);
}

// Half-open interval comparison: a window that ends exactly when another
// starts is back-to-back, not overlapping, so touching endpoints must not
// conflict.
function windowsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * A double-booked clinician is a real calendar impossibility, the same class
 * of bug `assertValidWindow` above already guards against — it was simply
 * never checked against the *other* appointments on the calendar. Only
 * `SCHEDULED` appointments can conflict; a cancelled slot has freed its time.
 */
function assertNoSchedulingConflict(
  clinicianId: string,
  scheduledStart: string,
  scheduledEnd: string,
  existingAppointments: readonly Appointment[],
): void {
  const conflict = existingAppointments.some(
    (appointment) =>
      appointment.clinicianId === clinicianId &&
      appointment.status === 'SCHEDULED' &&
      windowsOverlap(scheduledStart, scheduledEnd, appointment.scheduledStart, appointment.scheduledEnd),
  );
  if (conflict) throw new AppointmentConflictError(clinicianId, scheduledStart, scheduledEnd);
}

export function scheduleAppointment(
  id: string,
  input: ScheduleAppointmentInput,
  now: string,
  existingAppointments: readonly Appointment[],
): Appointment {
  assertValidWindow(input.scheduledStart, input.scheduledEnd);
  assertNoSchedulingConflict(input.clinicianId, input.scheduledStart, input.scheduledEnd, existingAppointments);
  const status: AppointmentStatus = 'SCHEDULED';
  return {
    id,
    patientId: input.patientId,
    clinicianId: input.clinicianId,
    scheduledStart: input.scheduledStart,
    scheduledEnd: input.scheduledEnd,
    status,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

/**
 * Cancelling an already-cancelled appointment is rejected rather than
 * silently idempotent, matching `packages/credentialing`'s own precedent
 * (`ApplicationTransitionError` on a repeat submission) for the same reason:
 * a caller relying on this throwing to detect "did my cancel actually do
 * anything" would otherwise get a false positive.
 */
export function cancelAppointment(appointment: Appointment, now: string): Appointment {
  if (appointment.status === 'CANCELLED') throw new AppointmentAlreadyCancelledError(appointment.id);
  return { ...appointment, status: 'CANCELLED', updatedAt: now, version: appointment.version + 1 };
}

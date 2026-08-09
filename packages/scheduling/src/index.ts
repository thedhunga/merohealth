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

export function scheduleAppointment(id: string, input: ScheduleAppointmentInput, now: string): Appointment {
  assertValidWindow(input.scheduledStart, input.scheduledEnd);
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

import { Injectable } from '@nestjs/common';
import type { Appointment } from '@swasthya/shared-types';

/**
 * Process-local stand-in for a real store, same convention
 * `PatientRegistryRepository` already set: the service/controller code above
 * this does not change once the in-memory map is swapped for real
 * persistence, only this file does.
 */
@Injectable()
export class SchedulingRepository {
  readonly #appointments = new Map<string, Appointment>();

  save(appointment: Appointment): Appointment {
    this.#appointments.set(appointment.id, appointment);
    return appointment;
  }

  find(id: string): Appointment | null {
    return this.#appointments.get(id) ?? null;
  }

  list(): Appointment[] {
    return [...this.#appointments.values()];
  }
}

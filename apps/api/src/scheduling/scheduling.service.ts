import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { cancelAppointment, scheduleAppointment } from '@swasthya/scheduling';
import type { Appointment, ClinicalModuleHealth, ScheduleAppointmentInput } from '@swasthya/shared-types';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { SchedulingRepository } from './scheduling.repository.js';

/**
 * clinical-suite.md capability map row 2: "Degrades to READ_ONLY without the
 * registry." `patients` is injected as `PatientRegistryService` — its public
 * port, per §2 rule 3 ("a module may import another's types; never its
 * repository, its client, or its tables") — not `PatientRegistryRepository`.
 */
@Injectable()
export class SchedulingService {
  constructor(
    private readonly repository: SchedulingRepository,
    private readonly patients: PatientRegistryService,
  ) {}

  /**
   * Both writes below call this first. `READ_ONLY`'s own definition (§2:
   * "serve persisted data, refuse writes") means every write this module
   * offers is refused while patient-registry is down, not only the one that
   * happens to look a patient up — so `cancel` gates on this too, even
   * though it never itself calls into `patients`.
   */
  private async assertPatientRegistryAvailable(): Promise<void> {
    const health = await this.patients.health();
    if (health.status === 'DOWN') {
      throw new ServiceUnavailableException(
        'Scheduling is read-only: patient-registry is unavailable (clinical-suite.md capability map row 2)',
      );
    }
  }

  async schedule(input: ScheduleAppointmentInput): Promise<Appointment> {
    await this.assertPatientRegistryAvailable();
    // Resolves the opaque patientId through patient-registry's own port
    // (§2 rule 1) — throws NotFoundException for an id that was never
    // registered there, the same 404 shape every other lookup in this API
    // already uses.
    this.patients.get(input.patientId);
    return this.repository.save(
      scheduleAppointment(randomUUID(), input, new Date().toISOString(), this.repository.list()),
    );
  }

  get(id: string): Appointment {
    const appointment = this.repository.find(id);
    if (!appointment) throw new NotFoundException(`No appointment ${id}`);
    return appointment;
  }

  async cancel(id: string): Promise<Appointment> {
    await this.assertPatientRegistryAvailable();
    return this.repository.save(cancelAppointment(this.get(id), new Date().toISOString()));
  }

  list(): Appointment[] {
    return this.repository.list();
  }

  /**
   * clinical-suite.md §2's `ModuleDescriptor.health()`. Reports this
   * module's own condition only — the in-memory repository has no failure
   * mode of its own, so this always reports UP. Whether SCHEDULING is
   * degraded by patient-registry being down is computed separately, by
   * `resolveAvailability` cross-referencing both modules' health, not by
   * this module reporting itself unhealthy on a dependency's behalf.
   */
  health(): Promise<ClinicalModuleHealth> {
    return Promise.resolve({ status: 'UP' });
  }
}

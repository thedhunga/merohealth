import { buildModuleRegistry, collectHealthStates, resolveAvailability } from '@swasthya/module-registry';
import { describe, expect, it } from 'vitest';
import { createPatientRegistryModuleDescriptor } from '../patient-registry/patient-registry.module-descriptor.js';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { SchedulingController } from './scheduling.controller.js';
import { createSchedulingModuleDescriptor } from './scheduling.module-descriptor.js';
import { SchedulingRepository } from './scheduling.repository.js';
import { SchedulingService } from './scheduling.service.js';

const validDemographics = {
  displayName: 'Sita Rai',
  dateOfBirth: '1990-04-12',
  sex: 'FEMALE' as const,
  phone: '9800000000',
  preferredLocale: 'ne' as const,
};

const appointmentBody = (patientId: string) => ({
  patientId,
  clinicianId: 'clinician-1',
  scheduledStart: '2026-08-10T09:00:00.000Z',
  scheduledEnd: '2026-08-10T09:30:00.000Z',
});

/**
 * §2 rule 5, "the shell renders around holes," demonstrated against a real
 * thrown error, same shape `patient-registry`'s own
 * `BrokenPatientRegistryRepository` already used.
 */
class BrokenSchedulingRepository extends SchedulingRepository {
  override save(): never {
    throw new Error('simulated store outage');
  }

  override find(): never {
    throw new Error('simulated store outage');
  }

  override list(): never {
    throw new Error('simulated store outage');
  }
}

describe('scheduling fault isolation', () => {
  it('a broken scheduling store does not take patient-registry down with it', async () => {
    const patients = new PatientRegistryService(new PatientRegistryRepository());
    const patient = patients.register(validDemographics);

    const brokenScheduling = new SchedulingController(new SchedulingService(new BrokenSchedulingRepository(), patients));
    await expect(brokenScheduling.schedule(appointmentBody(patient.id))).rejects.toThrow('simulated store outage');

    expect(patients.get(patient.id).id).toBe(patient.id);
  });

  it('resolveAvailability marks SCHEDULING available but READ_ONLY-degraded when PATIENT_REGISTRY is DOWN', async () => {
    const patients = new PatientRegistryService(new PatientRegistryRepository());
    const scheduling = new SchedulingService(new SchedulingRepository(), patients);

    const patientDescriptor = createPatientRegistryModuleDescriptor(patients);
    const forcedDownPatientDescriptor = {
      ...patientDescriptor,
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const schedulingDescriptor = createSchedulingModuleDescriptor(scheduling);

    const registry = buildModuleRegistry([forcedDownPatientDescriptor, schedulingDescriptor]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('PATIENT_REGISTRY')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('SCHEDULING')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'PATIENT_REGISTRY', mode: 'READ_ONLY' }],
    });
  });

  it('behaviourally: scheduling refuses writes but keeps serving reads while patient-registry is down', async () => {
    const patients = new PatientRegistryService(new PatientRegistryRepository());
    const patient = patients.register(validDemographics);
    const controller = new SchedulingController(new SchedulingService(new SchedulingRepository(), patients));
    const appointment = await controller.schedule(appointmentBody(patient.id));

    patients.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(controller.schedule(appointmentBody(patient.id))).rejects.toThrow();
    expect(controller.get(appointment.id).id).toBe(appointment.id);
  });
});

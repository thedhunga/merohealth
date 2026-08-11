import { buildModuleRegistry, collectHealthStates, resolveAvailability } from '@swasthya/module-registry';
import { describe, expect, it } from 'vitest';
import { createPatientRegistryModuleDescriptor } from '../patient-registry/patient-registry.module-descriptor.js';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { createSchedulingModuleDescriptor } from '../scheduling/scheduling.module-descriptor.js';
import { SchedulingRepository } from '../scheduling/scheduling.repository.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { createTeleconsultationModuleDescriptor } from './teleconsultation.module-descriptor.js';
import { TeleconsultationRepository } from './teleconsultation.repository.js';
import { TeleconsultationService } from './teleconsultation.service.js';

const validDemographics = {
  displayName: 'Sita Rai',
  dateOfBirth: '1990-04-12',
  sex: 'FEMALE' as const,
  phone: '9800000000',
  preferredLocale: 'ne' as const,
};

function buildStack() {
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const scheduling = new SchedulingService(new SchedulingRepository(), patients);
  return { patients, scheduling };
}

async function bookAppointment(scheduling: SchedulingService, patientId: string) {
  return scheduling.schedule({
    patientId,
    clinicianId: 'clinician-1',
    scheduledStart: '2026-08-10T09:00:00.000Z',
    scheduledEnd: '2026-08-10T09:30:00.000Z',
  });
}

/**
 * §2 rule 5, "the shell renders around holes," demonstrated against a real
 * thrown error, same shape `DiagnosticsOrdersRepository`'s own
 * `BrokenDiagnosticsOrdersRepository` already used.
 */
class BrokenTeleconsultationRepository extends TeleconsultationRepository {
  override save(): never {
    throw new Error('simulated store outage');
  }
}

describe('teleconsultation fault isolation', () => {
  it('a broken teleconsultation repository does not take scheduling down with it', async () => {
    const { patients, scheduling } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);

    const broken = new TeleconsultationService(new BrokenTeleconsultationRepository(), scheduling);
    await expect(broken.scheduleSession(appointment.id)).rejects.toThrow('simulated store outage');

    // scheduling keeps working — the outage is confined to
    // teleconsultation's own storage.
    expect(scheduling.get(appointment.id).id).toBe(appointment.id);
  });

  it('resolveAvailability marks TELECONSULTATION available but HIDE-degraded when SCHEDULING is DOWN', async () => {
    const { patients, scheduling } = buildStack();
    const teleconsultation = new TeleconsultationService(new TeleconsultationRepository(), scheduling);

    const patientDescriptor = createPatientRegistryModuleDescriptor(patients);
    const forcedDownSchedulingDescriptor = {
      ...createSchedulingModuleDescriptor(scheduling),
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const teleconsultationDescriptor = createTeleconsultationModuleDescriptor(teleconsultation);

    const registry = buildModuleRegistry([patientDescriptor, forcedDownSchedulingDescriptor, teleconsultationDescriptor]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('SCHEDULING')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('TELECONSULTATION')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'SCHEDULING', mode: 'HIDE' }],
    });
  });

  it('behaviourally: refuses to book a session while scheduling is down, and resumes once it recovers', async () => {
    const { patients, scheduling } = buildStack();
    const teleconsultation = new TeleconsultationService(new TeleconsultationRepository(), scheduling);
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);

    scheduling.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(teleconsultation.scheduleSession(appointment.id)).rejects.toThrow('scheduling is down');

    scheduling.health = () => Promise.resolve({ status: 'UP' });
    const session = await teleconsultation.scheduleSession(appointment.id);
    expect(session.status).toBe('SCHEDULED');
  });

  it('behaviourally: starting and completing a session stay available while scheduling is down', async () => {
    const { patients, scheduling } = buildStack();
    const teleconsultation = new TeleconsultationService(new TeleconsultationRepository(), scheduling);
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await teleconsultation.scheduleSession(appointment.id);

    scheduling.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    const started = teleconsultation.startSession(session.id);
    expect(started.status).toBe('ACTIVE');

    const completed = teleconsultation.completeSession(session.id);
    expect(completed.status).toBe('COMPLETED');
  });
});

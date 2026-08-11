import { buildModuleRegistry, collectHealthStates, resolveAvailability } from '@swasthya/module-registry';
import { describe, expect, it } from 'vitest';
import { createPatientRegistryModuleDescriptor } from '../patient-registry/patient-registry.module-descriptor.js';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { createSchedulingModuleDescriptor } from '../scheduling/scheduling.module-descriptor.js';
import { SchedulingRepository } from '../scheduling/scheduling.repository.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { createAnalyticsModuleDescriptor } from './analytics.module-descriptor.js';
import { AnalyticsService } from './analytics.service.js';

function buildStack() {
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const scheduling = new SchedulingService(new SchedulingRepository(), patients);
  const analytics = new AnalyticsService(patients, scheduling);
  return { patients, scheduling, analytics };
}

describe('analytics fault isolation', () => {
  it('resolveAvailability marks ANALYTICS available but HIDE-degraded when PATIENT_REGISTRY is DOWN', async () => {
    const { patients, scheduling, analytics } = buildStack();

    // buildModuleRegistry validates every degradesWith reference, so
    // scheduling's own edge to patient-registry has to be registered too,
    // not just the one edge this test is exercising.
    const forcedDownPatientsDescriptor = {
      ...createPatientRegistryModuleDescriptor(patients),
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const schedulingDescriptor = createSchedulingModuleDescriptor(scheduling);
    const analyticsDescriptor = createAnalyticsModuleDescriptor(analytics);

    const registry = buildModuleRegistry([forcedDownPatientsDescriptor, schedulingDescriptor, analyticsDescriptor]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('PATIENT_REGISTRY')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('ANALYTICS')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'PATIENT_REGISTRY', mode: 'HIDE' }],
    });
  });

  it('resolveAvailability marks ANALYTICS available but HIDE-degraded when SCHEDULING is DOWN', async () => {
    const { patients, scheduling, analytics } = buildStack();

    const patientsDescriptor = createPatientRegistryModuleDescriptor(patients);
    const forcedDownSchedulingDescriptor = {
      ...createSchedulingModuleDescriptor(scheduling),
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const analyticsDescriptor = createAnalyticsModuleDescriptor(analytics);

    const registry = buildModuleRegistry([patientsDescriptor, forcedDownSchedulingDescriptor, analyticsDescriptor]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('SCHEDULING')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('ANALYTICS')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'SCHEDULING', mode: 'HIDE' }],
    });
  });

  it('behaviourally: refuses the patient summary while patient-registry is down, and resumes once it recovers', async () => {
    const { patients, analytics } = buildStack();
    patients.register({
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
    });

    patients.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(analytics.patientRegistrySummary()).rejects.toThrow('patient-registry is down');

    patients.health = () => Promise.resolve({ status: 'UP' });
    await expect(analytics.patientRegistrySummary()).resolves.toMatchObject({ totalPatients: 1 });
  });

  it('behaviourally: a down scheduling summary does not take the patient summary down with it', async () => {
    const { patients, scheduling, analytics } = buildStack();
    patients.register({
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
    });

    scheduling.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(analytics.schedulingSummary()).rejects.toThrow('scheduling is down');
    await expect(analytics.patientRegistrySummary()).resolves.toMatchObject({ totalPatients: 1 });
  });
});

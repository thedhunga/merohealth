import { describe, expect, it } from 'vitest';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { SchedulingRepository } from '../scheduling/scheduling.repository.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { createAnalyticsModuleDescriptor } from './analytics.module-descriptor.js';
import { AnalyticsService } from './analytics.service.js';

function buildService(): AnalyticsService {
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const scheduling = new SchedulingService(new SchedulingRepository(), patients);
  return new AnalyticsService(patients, scheduling);
}

describe('createAnalyticsModuleDescriptor', () => {
  it('declares the ANALYTICS key with empty requires and both real degradations', () => {
    const descriptor = createAnalyticsModuleDescriptor(buildService());

    expect(descriptor.key).toBe('ANALYTICS');
    expect(descriptor.requires).toEqual([]);
    expect(descriptor.degradesWith).toEqual([
      { key: 'PATIENT_REGISTRY', mode: 'HIDE' },
      { key: 'SCHEDULING', mode: 'HIDE' },
    ]);
  });

  it("delegates health() to the service's own health(), not a hardcoded value", async () => {
    const service = buildService();
    const descriptor = createAnalyticsModuleDescriptor(service);

    await expect(descriptor.health()).resolves.toEqual(await service.health());
  });
});

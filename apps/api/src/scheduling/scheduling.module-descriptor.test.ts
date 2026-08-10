import { describe, expect, it } from 'vitest';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { createSchedulingModuleDescriptor } from './scheduling.module-descriptor.js';
import { SchedulingRepository } from './scheduling.repository.js';
import { SchedulingService } from './scheduling.service.js';

function buildService() {
  return new SchedulingService(new SchedulingRepository(), new PatientRegistryService(new PatientRegistryRepository()));
}

describe('createSchedulingModuleDescriptor', () => {
  it('declares the SCHEDULING key with empty requires and a single READ_ONLY degradesWith on PATIENT_REGISTRY', () => {
    const descriptor = createSchedulingModuleDescriptor(buildService());

    expect(descriptor.key).toBe('SCHEDULING');
    expect(descriptor.requires).toEqual([]);
    expect(descriptor.degradesWith).toEqual([{ key: 'PATIENT_REGISTRY', mode: 'READ_ONLY' }]);
  });

  it("delegates health() to the service's own health(), not a hardcoded value", async () => {
    const service = buildService();
    const descriptor = createSchedulingModuleDescriptor(service);

    await expect(descriptor.health()).resolves.toEqual(await service.health());
  });
});

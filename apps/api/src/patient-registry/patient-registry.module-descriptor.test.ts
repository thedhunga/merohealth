import { describe, expect, it } from 'vitest';
import { createPatientRegistryModuleDescriptor } from './patient-registry.module-descriptor.js';
import { PatientRegistryRepository } from './patient-registry.repository.js';
import { PatientRegistryService } from './patient-registry.service.js';

describe('createPatientRegistryModuleDescriptor', () => {
  it('declares the PATIENT_REGISTRY key with no requires/degradesWith edges', () => {
    const descriptor = createPatientRegistryModuleDescriptor(
      new PatientRegistryService(new PatientRegistryRepository()),
    );

    expect(descriptor.key).toBe('PATIENT_REGISTRY');
    expect(descriptor.requires).toEqual([]);
    expect(descriptor.degradesWith).toEqual([]);
  });

  it("delegates health() to the service's own health(), not a hardcoded value", async () => {
    const service = new PatientRegistryService(new PatientRegistryRepository());
    const descriptor = createPatientRegistryModuleDescriptor(service);

    await expect(descriptor.health()).resolves.toEqual(await service.health());
  });
});

import { describe, expect, it } from 'vitest';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { SchedulingRepository } from '../scheduling/scheduling.repository.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { createTeleconsultationModuleDescriptor } from './teleconsultation.module-descriptor.js';
import { TeleconsultationRepository } from './teleconsultation.repository.js';
import { TeleconsultationService } from './teleconsultation.service.js';

function buildService(): TeleconsultationService {
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const scheduling = new SchedulingService(new SchedulingRepository(), patients);
  return new TeleconsultationService(new TeleconsultationRepository(), scheduling);
}

describe('createTeleconsultationModuleDescriptor', () => {
  it('declares the TELECONSULTATION key with empty requires and the one real degradation', () => {
    const descriptor = createTeleconsultationModuleDescriptor(buildService());

    expect(descriptor.key).toBe('TELECONSULTATION');
    expect(descriptor.requires).toEqual([]);
    expect(descriptor.degradesWith).toEqual([{ key: 'SCHEDULING', mode: 'HIDE' }]);
  });

  it("delegates health() to the service's own health(), not a hardcoded value", async () => {
    const service = buildService();
    const descriptor = createTeleconsultationModuleDescriptor(service);

    await expect(descriptor.health()).resolves.toEqual(await service.health());
  });
});

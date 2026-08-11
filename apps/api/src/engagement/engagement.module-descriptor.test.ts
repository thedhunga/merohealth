import { describe, expect, it, vi } from 'vitest';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import type { EngagementDeliveryProvider } from './delivery-provider.js';
import { createEngagementModuleDescriptor } from './engagement.module-descriptor.js';
import { EngagementRepository } from './engagement.repository.js';
import { EngagementService } from './engagement.service.js';

function buildService(): EngagementService {
  const provider: EngagementDeliveryProvider = { send: vi.fn().mockResolvedValue(undefined) };
  return new EngagementService(new EngagementRepository(), new PatientRegistryService(new PatientRegistryRepository()), provider);
}

describe('createEngagementModuleDescriptor', () => {
  it('declares the ENGAGEMENT key with empty requires and the one real degradation', () => {
    const descriptor = createEngagementModuleDescriptor(buildService());

    expect(descriptor.key).toBe('ENGAGEMENT');
    expect(descriptor.requires).toEqual([]);
    expect(descriptor.degradesWith).toEqual([{ key: 'PATIENT_REGISTRY', mode: 'HIDE' }]);
  });

  it("delegates health() to the service's own health(), not a hardcoded value", async () => {
    const service = buildService();
    const descriptor = createEngagementModuleDescriptor(service);

    await expect(descriptor.health()).resolves.toEqual(await service.health());
  });
});

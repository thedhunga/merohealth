import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { createHealthRecordsModuleDescriptor } from './records.module-descriptor.js';
import { RecordsRepository } from './records.repository.js';
import { RecordsService } from './records.service.js';

function buildService(): RecordsService {
  return new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
}

describe('createHealthRecordsModuleDescriptor', () => {
  it('declares the HEALTH_RECORDS key with no requires/degradesWith edges', () => {
    const descriptor = createHealthRecordsModuleDescriptor(buildService());

    expect(descriptor.key).toBe('HEALTH_RECORDS');
    expect(descriptor.requires).toEqual([]);
    expect(descriptor.degradesWith).toEqual([]);
  });

  it("delegates health() to the service's own health(), not a hardcoded value", async () => {
    const service = buildService();
    const descriptor = createHealthRecordsModuleDescriptor(service);

    await expect(descriptor.health()).resolves.toEqual(await service.health());
  });
});

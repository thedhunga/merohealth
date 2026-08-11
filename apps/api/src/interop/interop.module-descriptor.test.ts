import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { createInteropModuleDescriptor } from './interop.module-descriptor.js';
import { InteropRepository } from './interop.repository.js';
import { InteropService } from './interop.service.js';

function buildService(): InteropService {
  const records = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  return new InteropService(new InteropRepository(), records);
}

describe('createInteropModuleDescriptor', () => {
  it('declares the INTEROP key with a HIDE edge on HEALTH_RECORDS', () => {
    const descriptor = createInteropModuleDescriptor(buildService());

    expect(descriptor.key).toBe('INTEROP');
    expect(descriptor.requires).toEqual([]);
    expect(descriptor.degradesWith).toEqual([{ key: 'HEALTH_RECORDS', mode: 'HIDE' }]);
  });

  it("delegates health() to the service's own health(), not a hardcoded value", async () => {
    const service = buildService();
    const descriptor = createInteropModuleDescriptor(service);

    await expect(descriptor.health()).resolves.toEqual(await service.health());
  });
});

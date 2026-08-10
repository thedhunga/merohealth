import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { createClinicalChartingModuleDescriptor } from './clinical-charting.module-descriptor.js';
import { ClinicalChartingRepository } from './clinical-charting.repository.js';
import { ClinicalChartingService } from './clinical-charting.service.js';

function buildService(): ClinicalChartingService {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  return new ClinicalChartingService(new ClinicalChartingRepository(), documents);
}

describe('createClinicalChartingModuleDescriptor', () => {
  it('declares the CLINICAL_CHARTING key with empty requires and a single HIDE degradesWith on HEALTH_RECORDS', () => {
    const descriptor = createClinicalChartingModuleDescriptor(buildService());

    expect(descriptor.key).toBe('CLINICAL_CHARTING');
    expect(descriptor.requires).toEqual([]);
    expect(descriptor.degradesWith).toEqual([{ key: 'HEALTH_RECORDS', mode: 'HIDE' }]);
  });

  it("delegates health() to the service's own health(), not a hardcoded value", async () => {
    const service = buildService();
    const descriptor = createClinicalChartingModuleDescriptor(service);

    await expect(descriptor.health()).resolves.toEqual(await service.health());
  });
});

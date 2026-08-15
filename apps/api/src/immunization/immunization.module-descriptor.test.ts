import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { createImmunizationModuleDescriptor } from './immunization.module-descriptor.js';
import { ImmunizationRepository } from './immunization.repository.js';
import { ImmunizationService } from './immunization.service.js';

function buildService(): ImmunizationService {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  return new ImmunizationService(new ImmunizationRepository(), charting);
}

describe('createImmunizationModuleDescriptor', () => {
  it('declares the IMMUNIZATION key with empty requires and a single HIDE degradesWith on CLINICAL_CHARTING', () => {
    const descriptor = createImmunizationModuleDescriptor(buildService());

    expect(descriptor.key).toBe('IMMUNIZATION');
    expect(descriptor.requires).toEqual([]);
    expect(descriptor.degradesWith).toEqual([{ key: 'CLINICAL_CHARTING', mode: 'HIDE' }]);
  });

  it("delegates health() to the service's own health(), not a hardcoded value", async () => {
    const service = buildService();
    const descriptor = createImmunizationModuleDescriptor(service);

    await expect(descriptor.health()).resolves.toEqual(await service.health());
  });
});

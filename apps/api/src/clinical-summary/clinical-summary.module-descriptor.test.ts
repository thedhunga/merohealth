import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { createClinicalSummaryModuleDescriptor } from './clinical-summary.module-descriptor.js';
import { ClinicalSummaryRepository } from './clinical-summary.repository.js';
import { ClinicalSummaryService } from './clinical-summary.service.js';

function buildService(): ClinicalSummaryService {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  return new ClinicalSummaryService(new ClinicalSummaryRepository(), charting);
}

describe('createClinicalSummaryModuleDescriptor', () => {
  it('declares the CLINICAL_SUMMARY key with empty requires and a single HIDE degradesWith on CLINICAL_CHARTING', () => {
    const descriptor = createClinicalSummaryModuleDescriptor(buildService());

    expect(descriptor.key).toBe('CLINICAL_SUMMARY');
    expect(descriptor.requires).toEqual([]);
    expect(descriptor.degradesWith).toEqual([{ key: 'CLINICAL_CHARTING', mode: 'HIDE' }]);
  });

  it("delegates health() to the service's own health(), not a hardcoded value", async () => {
    const service = buildService();
    const descriptor = createClinicalSummaryModuleDescriptor(service);

    await expect(descriptor.health()).resolves.toEqual(await service.health());
  });
});

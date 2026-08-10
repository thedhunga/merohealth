import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { ClinicalSummaryRepository } from '../clinical-summary/clinical-summary.repository.js';
import { ClinicalSummaryService } from '../clinical-summary/clinical-summary.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { createMedicationSafetyModuleDescriptor } from './medication-safety.module-descriptor.js';
import { MedicationSafetyRepository } from './medication-safety.repository.js';
import { MedicationSafetyService } from './medication-safety.service.js';

function buildService(): MedicationSafetyService {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const summary = new ClinicalSummaryService(new ClinicalSummaryRepository(), charting);
  return new MedicationSafetyService(new MedicationSafetyRepository(), summary);
}

describe('createMedicationSafetyModuleDescriptor', () => {
  it('declares the MEDICATION_SAFETY key with empty requires and a single MANUAL degradesWith on CLINICAL_SUMMARY', () => {
    const descriptor = createMedicationSafetyModuleDescriptor(buildService());

    expect(descriptor.key).toBe('MEDICATION_SAFETY');
    expect(descriptor.requires).toEqual([]);
    expect(descriptor.degradesWith).toEqual([{ key: 'CLINICAL_SUMMARY', mode: 'MANUAL' }]);
  });

  it("delegates health() to the service's own health(), not a hardcoded value", async () => {
    const service = buildService();
    const descriptor = createMedicationSafetyModuleDescriptor(service);

    await expect(descriptor.health()).resolves.toEqual(await service.health());
  });
});

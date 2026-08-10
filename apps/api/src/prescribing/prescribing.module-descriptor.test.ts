import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { ClinicalSummaryRepository } from '../clinical-summary/clinical-summary.repository.js';
import { ClinicalSummaryService } from '../clinical-summary/clinical-summary.service.js';
import { MedicationSafetyRepository } from '../medication-safety/medication-safety.repository.js';
import { MedicationSafetyService } from '../medication-safety/medication-safety.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { createPrescribingModuleDescriptor } from './prescribing.module-descriptor.js';
import { PrescribingRepository } from './prescribing.repository.js';
import { PrescribingService } from './prescribing.service.js';

function buildService(): PrescribingService {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const summary = new ClinicalSummaryService(new ClinicalSummaryRepository(), charting);
  const medicationSafety = new MedicationSafetyService(new MedicationSafetyRepository(), summary);
  return new PrescribingService(new PrescribingRepository(), charting, medicationSafety);
}

describe('createPrescribingModuleDescriptor', () => {
  it('declares the PRESCRIBING key with empty requires and both real degradations', () => {
    const descriptor = createPrescribingModuleDescriptor(buildService());

    expect(descriptor.key).toBe('PRESCRIBING');
    expect(descriptor.requires).toEqual([]);
    expect(descriptor.degradesWith).toEqual([
      { key: 'CLINICAL_CHARTING', mode: 'HIDE' },
      { key: 'MEDICATION_SAFETY', mode: 'MANUAL' },
    ]);
  });

  it("delegates health() to the service's own health(), not a hardcoded value", async () => {
    const service = buildService();
    const descriptor = createPrescribingModuleDescriptor(service);

    await expect(descriptor.health()).resolves.toEqual(await service.health());
  });
});

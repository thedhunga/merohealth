import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { ClinicalSummaryRepository } from '../clinical-summary/clinical-summary.repository.js';
import { ClinicalSummaryService } from '../clinical-summary/clinical-summary.service.js';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { SchedulingRepository } from '../scheduling/scheduling.repository.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { createPopulationHealthModuleDescriptor } from './population-health.module-descriptor.js';
import { PopulationHealthService } from './population-health.service.js';

function buildService(): PopulationHealthService {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const summary = new ClinicalSummaryService(new ClinicalSummaryRepository(), charting);
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const scheduling = new SchedulingService(new SchedulingRepository(), patients);
  return new PopulationHealthService(summary, scheduling);
}

describe('createPopulationHealthModuleDescriptor', () => {
  it('declares the POPULATION_HEALTH key with empty requires and both real degradations', () => {
    const descriptor = createPopulationHealthModuleDescriptor(buildService());

    expect(descriptor.key).toBe('POPULATION_HEALTH');
    expect(descriptor.requires).toEqual([]);
    expect(descriptor.degradesWith).toEqual([
      { key: 'CLINICAL_SUMMARY', mode: 'HIDE' },
      { key: 'SCHEDULING', mode: 'HIDE' },
    ]);
  });

  it("delegates health() to the service's own health(), not a hardcoded value", async () => {
    const service = buildService();
    const descriptor = createPopulationHealthModuleDescriptor(service);

    await expect(descriptor.health()).resolves.toEqual(await service.health());
  });
});

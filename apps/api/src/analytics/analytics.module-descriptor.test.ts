import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { BillingRepository } from '../billing/billing.repository.js';
import { BillingService } from '../billing/billing.service.js';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { SchedulingRepository } from '../scheduling/scheduling.repository.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { createAnalyticsModuleDescriptor } from './analytics.module-descriptor.js';
import { AnalyticsService } from './analytics.service.js';

function buildService(): AnalyticsService {
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const scheduling = new SchedulingService(new SchedulingRepository(), patients);
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const billing = new BillingService(new BillingRepository(), charting);
  return new AnalyticsService(patients, scheduling, billing);
}

describe('createAnalyticsModuleDescriptor', () => {
  it('declares the ANALYTICS key with empty requires and all three real degradations', () => {
    const descriptor = createAnalyticsModuleDescriptor(buildService());

    expect(descriptor.key).toBe('ANALYTICS');
    expect(descriptor.requires).toEqual([]);
    expect(descriptor.degradesWith).toEqual([
      { key: 'PATIENT_REGISTRY', mode: 'HIDE' },
      { key: 'SCHEDULING', mode: 'HIDE' },
      { key: 'BILLING', mode: 'HIDE' },
    ]);
  });

  it("delegates health() to the service's own health(), not a hardcoded value", async () => {
    const service = buildService();
    const descriptor = createAnalyticsModuleDescriptor(service);

    await expect(descriptor.health()).resolves.toEqual(await service.health());
  });
});

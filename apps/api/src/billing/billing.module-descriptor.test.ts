import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { createBillingModuleDescriptor } from './billing.module-descriptor.js';
import { BillingRepository } from './billing.repository.js';
import { BillingService } from './billing.service.js';

function buildService(): BillingService {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  return new BillingService(new BillingRepository(), charting);
}

describe('createBillingModuleDescriptor', () => {
  it('declares the BILLING key with empty requires and the one real degradation', () => {
    const descriptor = createBillingModuleDescriptor(buildService());

    expect(descriptor.key).toBe('BILLING');
    expect(descriptor.requires).toEqual([]);
    expect(descriptor.degradesWith).toEqual([{ key: 'CLINICAL_CHARTING', mode: 'HIDE' }]);
  });

  it("delegates health() to the service's own health(), not a hardcoded value", async () => {
    const service = buildService();
    const descriptor = createBillingModuleDescriptor(service);

    await expect(descriptor.health()).resolves.toEqual(await service.health());
  });
});

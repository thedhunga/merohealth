import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { createReferralsModuleDescriptor } from './referrals.module-descriptor.js';
import { ReferralsRepository } from './referrals.repository.js';
import { ReferralsService } from './referrals.service.js';

function buildService(): ReferralsService {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  return new ReferralsService(new ReferralsRepository(), charting);
}

describe('createReferralsModuleDescriptor', () => {
  it('declares the REFERRALS key with empty requires and the one real degradation', () => {
    const descriptor = createReferralsModuleDescriptor(buildService());

    expect(descriptor.key).toBe('REFERRALS');
    expect(descriptor.requires).toEqual([]);
    expect(descriptor.degradesWith).toEqual([{ key: 'CLINICAL_CHARTING', mode: 'HIDE' }]);
  });

  it("delegates health() to the service's own health(), not a hardcoded value", async () => {
    const service = buildService();
    const descriptor = createReferralsModuleDescriptor(service);

    await expect(descriptor.health()).resolves.toEqual(await service.health());
  });
});

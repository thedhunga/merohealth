import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it, vi } from 'vitest';
import { BillingRepository } from '../billing/billing.repository.js';
import { BillingService } from '../billing/billing.service.js';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { DiagnosticsOrdersRepository } from '../diagnostics-orders/diagnostics-orders.repository.js';
import { DiagnosticsOrdersService } from '../diagnostics-orders/diagnostics-orders.service.js';
import { EngagementRepository } from '../engagement/engagement.repository.js';
import { EngagementService } from '../engagement/engagement.service.js';
import { ImmunizationRepository } from '../immunization/immunization.repository.js';
import { ImmunizationService } from '../immunization/immunization.service.js';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { ReferralsRepository } from '../referrals/referrals.repository.js';
import { ReferralsService } from '../referrals/referrals.service.js';
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
  const referrals = new ReferralsService(new ReferralsRepository(), charting);
  const engagement = new EngagementService(new EngagementRepository(), patients, { send: vi.fn().mockResolvedValue(undefined) });
  const immunization = new ImmunizationService(new ImmunizationRepository(), charting);
  const diagnosticsOrders = new DiagnosticsOrdersService(new DiagnosticsOrdersRepository(), charting);
  return new AnalyticsService(patients, scheduling, billing, referrals, engagement, immunization, diagnosticsOrders);
}

describe('createAnalyticsModuleDescriptor', () => {
  it('declares the ANALYTICS key with empty requires and all seven real degradations', () => {
    const descriptor = createAnalyticsModuleDescriptor(buildService());

    expect(descriptor.key).toBe('ANALYTICS');
    expect(descriptor.requires).toEqual([]);
    expect(descriptor.degradesWith).toEqual([
      { key: 'PATIENT_REGISTRY', mode: 'HIDE' },
      { key: 'SCHEDULING', mode: 'HIDE' },
      { key: 'BILLING', mode: 'HIDE' },
      { key: 'REFERRALS', mode: 'HIDE' },
      { key: 'ENGAGEMENT', mode: 'HIDE' },
      { key: 'IMMUNIZATION', mode: 'HIDE' },
      { key: 'DIAGNOSTICS_ORDERS', mode: 'HIDE' },
    ]);
  });

  it("delegates health() to the service's own health(), not a hardcoded value", async () => {
    const service = buildService();
    const descriptor = createAnalyticsModuleDescriptor(service);

    await expect(descriptor.health()).resolves.toEqual(await service.health());
  });
});

import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { createDiagnosticsOrdersModuleDescriptor } from './diagnostics-orders.module-descriptor.js';
import { DiagnosticsOrdersRepository } from './diagnostics-orders.repository.js';
import { DiagnosticsOrdersService } from './diagnostics-orders.service.js';

function buildService(): DiagnosticsOrdersService {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  return new DiagnosticsOrdersService(new DiagnosticsOrdersRepository(), charting);
}

describe('createDiagnosticsOrdersModuleDescriptor', () => {
  it('declares the DIAGNOSTICS_ORDERS key with empty requires and the one real degradation', () => {
    const descriptor = createDiagnosticsOrdersModuleDescriptor(buildService());

    expect(descriptor.key).toBe('DIAGNOSTICS_ORDERS');
    expect(descriptor.requires).toEqual([]);
    expect(descriptor.degradesWith).toEqual([{ key: 'CLINICAL_CHARTING', mode: 'HIDE' }]);
  });

  it("delegates health() to the service's own health(), not a hardcoded value", async () => {
    const service = buildService();
    const descriptor = createDiagnosticsOrdersModuleDescriptor(service);

    await expect(descriptor.health()).resolves.toEqual(await service.health());
  });
});

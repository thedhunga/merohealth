import { buildModuleRegistry, collectHealthStates, resolveAvailability } from '@swasthya/module-registry';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { createHealthRecordsModuleDescriptor } from './records.module-descriptor.js';
import { RecordsRepository } from './records.repository.js';
import { RecordsService } from './records.service.js';

/**
 * clinical-suite.md §2's own deliverable for every module in this section:
 * "a test that forces the module DOWN and asserts the rest of the system
 * still works." HEALTH_RECORDS predates the fault-isolation system and has
 * no `requires`/`degradesWith` edges of its own (see
 * records.module-descriptor.ts), so this is the same "foundation module,
 * no dependents to register against it yet" position patient-registry's own
 * fault-isolation test started from — "the rest of the system" here is an
 * unrelated sibling module with no shared state: patient-registry.
 */
class BrokenRecordsRepository extends RecordsRepository {
  override saveDocument(): never {
    throw new Error('simulated store outage');
  }

  override findDocument(): never {
    throw new Error('simulated store outage');
  }

  override listDocuments(): never {
    throw new Error('simulated store outage');
  }
}

const validDemographics = {
  displayName: 'Sita Rai',
  dateOfBirth: '1990-04-12',
  sex: 'FEMALE' as const,
  phone: '9800000000',
  preferredLocale: 'ne' as const,
};

const captureInput = {
  ownerId: 'owner-1',
  filename: 'report.jpg',
  kind: 'LAB_REPORT' as const,
  title: 'Blood panel',
  documentDate: null,
  sensitivity: 'STANDARD' as const,
  clientEncrypted: false,
  contentType: 'image/jpeg',
  bytes: new Uint8Array([1, 2, 3]),
  pageCount: 1,
};

describe('records (HEALTH_RECORDS) fault isolation', () => {
  it('a broken records store does not take an unrelated clinical-suite module down with it', async () => {
    const brokenRecords = new RecordsService(new BrokenRecordsRepository(), new InMemoryDocumentStore('HOSTED'));
    await expect(brokenRecords.captureDocument(captureInput)).rejects.toThrow('simulated store outage');

    const patients = new PatientRegistryService(new PatientRegistryRepository());
    const patient = patients.register(validDemographics);

    expect(patient.demographics.displayName).toBe('Sita Rai');
  });

  it('resolveAvailability marks HEALTH_RECORDS unavailable when its health probe reports DOWN', async () => {
    const healthyDescriptor = createHealthRecordsModuleDescriptor(
      new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED')),
    );
    const forcedDown = {
      ...healthyDescriptor,
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };

    const registry = buildModuleRegistry([forcedDown]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('HEALTH_RECORDS')).toMatchObject({ available: false, health: 'DOWN' });
  });
});

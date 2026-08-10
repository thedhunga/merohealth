import { buildModuleRegistry, collectHealthStates, resolveAvailability } from '@swasthya/module-registry';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { RecordsRepository } from '../records/records.repository.js';
import { createHealthRecordsModuleDescriptor } from '../records/records.module-descriptor.js';
import { RecordsService } from '../records/records.service.js';
import { ClinicalChartingController } from './clinical-charting.controller.js';
import { createClinicalChartingModuleDescriptor } from './clinical-charting.module-descriptor.js';
import { ClinicalChartingRepository } from './clinical-charting.repository.js';
import { ClinicalChartingService } from './clinical-charting.service.js';

const encounterBody = { patientId: 'patient-1', clinicianId: 'clinician-1' };

/**
 * §2 rule 5, "the shell renders around holes," demonstrated against a real
 * thrown error, same shape `scheduling`'s own `BrokenSchedulingRepository`
 * already used.
 */
class BrokenClinicalChartingRepository extends ClinicalChartingRepository {
  override saveEncounter(): never {
    throw new Error('simulated store outage');
  }

  override findEncounter(): never {
    throw new Error('simulated store outage');
  }

  override listEncounters(): never {
    throw new Error('simulated store outage');
  }
}

describe('clinical-charting fault isolation', () => {
  it('a broken charting store does not take health-records down with it', async () => {
    const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
    const document = await documents.captureDocument({
      ownerId: 'owner-1',
      filename: 'report.jpg',
      kind: 'LAB_REPORT',
      title: 'Blood panel',
      documentDate: null,
      sensitivity: 'STANDARD',
      clientEncrypted: false,
      contentType: 'image/jpeg',
      bytes: new Uint8Array([1, 2, 3]),
      pageCount: 1,
    });

    const brokenCharting = new ClinicalChartingController(
      new ClinicalChartingService(new BrokenClinicalChartingRepository(), documents),
    );
    expect(() => brokenCharting.openEncounter(encounterBody)).toThrow('simulated store outage');

    expect(documents.getDocument(document.id).id).toBe(document.id);
  });

  it('resolveAvailability marks CLINICAL_CHARTING available but HIDE-degraded when HEALTH_RECORDS is DOWN', async () => {
    const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
    const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);

    const recordsDescriptor = createHealthRecordsModuleDescriptor(documents);
    const forcedDownRecordsDescriptor = {
      ...recordsDescriptor,
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const chartingDescriptor = createClinicalChartingModuleDescriptor(charting);

    const registry = buildModuleRegistry([forcedDownRecordsDescriptor, chartingDescriptor]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('HEALTH_RECORDS')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('CLINICAL_CHARTING')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'HEALTH_RECORDS', mode: 'HIDE' }],
    });
  });

  it('behaviourally: charting keeps opening encounters and writing notes but refuses to attach documents while health-records is down', async () => {
    const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
    const controller = new ClinicalChartingController(
      new ClinicalChartingService(new ClinicalChartingRepository(), documents),
    );
    const encounter = controller.openEncounter(encounterBody);

    documents.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(controller.attachDocument(encounter.id, 'doc-1')).rejects.toThrow();

    const note = controller.recordNote(encounter.id, {
      authorId: 'clinician-1',
      subjective: 's',
      objective: 'o',
      assessment: 'a',
      plan: 'p',
    });
    expect(note.encounterId).toBe(encounter.id);
    expect(controller.closeEncounter(encounter.id).status).toBe('CLOSED');
  });
});

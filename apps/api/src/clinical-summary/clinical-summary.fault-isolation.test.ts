import { buildModuleRegistry, collectHealthStates, resolveAvailability } from '@swasthya/module-registry';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { createClinicalChartingModuleDescriptor } from '../clinical-charting/clinical-charting.module-descriptor.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { createHealthRecordsModuleDescriptor } from '../records/records.module-descriptor.js';
import { RecordsService } from '../records/records.service.js';
import { ClinicalSummaryController } from './clinical-summary.controller.js';
import { createClinicalSummaryModuleDescriptor } from './clinical-summary.module-descriptor.js';
import { ClinicalSummaryRepository } from './clinical-summary.repository.js';
import { ClinicalSummaryService } from './clinical-summary.service.js';

const patientReportedBody = { patientId: 'patient-1', kind: 'ALLERGY', label: 'Penicillin', value: 'Rash' };
const clinicianBody = { clinicianId: 'clinician-1', kind: 'CONDITION', label: 'Type 2 diabetes', value: 'Diagnosed 2026' };

function buildCharting(): { charting: ClinicalChartingService; documents: RecordsService } {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  return { charting, documents };
}

/**
 * §2 rule 5, "the shell renders around holes," demonstrated against a real
 * thrown error, same shape `clinical-charting`'s own
 * `BrokenClinicalChartingRepository` already used.
 */
class BrokenClinicalSummaryRepository extends ClinicalSummaryRepository {
  override save(): never {
    throw new Error('simulated store outage');
  }

  override find(): never {
    throw new Error('simulated store outage');
  }

  override list(): never {
    throw new Error('simulated store outage');
  }
}

describe('clinical-summary fault isolation', () => {
  it('a broken clinical-summary store does not take clinical-charting down with it', () => {
    const { charting } = buildCharting();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    const brokenSummary = new ClinicalSummaryController(
      new ClinicalSummaryService(new BrokenClinicalSummaryRepository(), charting),
    );
    expect(() => brokenSummary.recordPatientReported(patientReportedBody)).toThrow('simulated store outage');

    expect(charting.getEncounter(encounter.id).id).toBe(encounter.id);
  });

  it('resolveAvailability marks CLINICAL_SUMMARY available but HIDE-degraded when CLINICAL_CHARTING is DOWN', async () => {
    const { charting, documents } = buildCharting();
    const summary = new ClinicalSummaryService(new ClinicalSummaryRepository(), charting);

    // clinical-charting's own descriptor declares a degradesWith on
    // HEALTH_RECORDS, so buildModuleRegistry needs that descriptor
    // registered too — the same three-descriptor shape
    // clinical-charting.fault-isolation.test.ts already needs for its own
    // registry, one level further up the chain.
    const recordsDescriptor = createHealthRecordsModuleDescriptor(documents);
    const chartingDescriptor = createClinicalChartingModuleDescriptor(charting);
    const forcedDownChartingDescriptor = {
      ...chartingDescriptor,
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const summaryDescriptor = createClinicalSummaryModuleDescriptor(summary);

    const registry = buildModuleRegistry([recordsDescriptor, forcedDownChartingDescriptor, summaryDescriptor]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('CLINICAL_CHARTING')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('CLINICAL_SUMMARY')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'CLINICAL_CHARTING', mode: 'HIDE' }],
    });
  });

  it('behaviourally: patient-reported items and reads keep working but clinician-authored recording is refused while clinical-charting is down', async () => {
    const { charting } = buildCharting();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const controller = new ClinicalSummaryController(new ClinicalSummaryService(new ClinicalSummaryRepository(), charting));

    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(controller.recordClinicianAuthored(encounter.id, clinicianBody)).rejects.toThrow();

    const item = controller.recordPatientReported(patientReportedBody);
    expect(item.status).toBe('ACTIVE');
    expect(controller.listItems('patient-1').total).toBe(1);
    expect(controller.resolveItem(item.id).status).toBe('RESOLVED');
  });
});

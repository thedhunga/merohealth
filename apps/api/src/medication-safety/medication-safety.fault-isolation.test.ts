import { buildModuleRegistry, collectHealthStates, resolveAvailability } from '@swasthya/module-registry';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { createClinicalChartingModuleDescriptor } from '../clinical-charting/clinical-charting.module-descriptor.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { ClinicalSummaryRepository } from '../clinical-summary/clinical-summary.repository.js';
import { createClinicalSummaryModuleDescriptor } from '../clinical-summary/clinical-summary.module-descriptor.js';
import { ClinicalSummaryService } from '../clinical-summary/clinical-summary.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { createHealthRecordsModuleDescriptor } from '../records/records.module-descriptor.js';
import { RecordsService } from '../records/records.service.js';
import { MedicationSafetyController } from './medication-safety.controller.js';
import { createMedicationSafetyModuleDescriptor } from './medication-safety.module-descriptor.js';
import { MedicationSafetyRepository } from './medication-safety.repository.js';
import { MedicationSafetyService } from './medication-safety.service.js';

function buildStack(): { documents: RecordsService; charting: ClinicalChartingService; summary: ClinicalSummaryService } {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const summary = new ClinicalSummaryService(new ClinicalSummaryRepository(), charting);
  return { documents, charting, summary };
}

const currentUser: CurrentUserResult = {
  subjectId: 'patient-1',
  user: { id: 'patient-1', phone: '9812345678', role: 'PATIENT', locale: 'ne', assuranceLevel: 'REGISTERED' },
  patientProfileId: null,
  assuranceLevel: 'REGISTERED',
};

/**
 * §2 rule 5, "the shell renders around holes," demonstrated against a real
 * thrown error, same shape `clinical-summary`'s own
 * `BrokenClinicalSummaryRepository` already used.
 */
class BrokenMedicationSafetyRepository extends MedicationSafetyRepository {
  override listInteractionRules(): never {
    throw new Error('simulated store outage');
  }
}

describe('medication-safety fault isolation', () => {
  it('a broken medication-safety repository does not take clinical-summary down with it', async () => {
    const { summary } = buildStack();
    summary.recordPatientReported({ patientId: 'patient-1', kind: 'ALLERGY', label: 'Penicillin', value: 'Rash' });

    const brokenController = new MedicationSafetyController(
      new MedicationSafetyService(new BrokenMedicationSafetyRepository(), summary),
    );
    await expect(
      brokenController.check(currentUser, { proposedLabel: 'Penicillin' }),
    ).rejects.toThrow('simulated store outage');

    expect(summary.listItems('patient-1')).toHaveLength(1);
  });

  it('resolveAvailability marks MEDICATION_SAFETY available but MANUAL-degraded when CLINICAL_SUMMARY is DOWN', async () => {
    const { documents, charting, summary } = buildStack();
    const medicationSafety = new MedicationSafetyService(new MedicationSafetyRepository(), summary);

    // clinical-summary's own descriptor declares a degradesWith on
    // CLINICAL_CHARTING, which itself declares one on HEALTH_RECORDS, so
    // buildModuleRegistry needs all three registered — the same
    // three-descriptor chain clinical-summary.fault-isolation.test.ts
    // already needs, one level further up.
    const recordsDescriptor = createHealthRecordsModuleDescriptor(documents);
    const chartingDescriptor = createClinicalChartingModuleDescriptor(charting);
    const summaryDescriptor = createClinicalSummaryModuleDescriptor(summary);
    const forcedDownSummaryDescriptor = {
      ...summaryDescriptor,
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const medicationSafetyDescriptor = createMedicationSafetyModuleDescriptor(medicationSafety);

    const registry = buildModuleRegistry([
      recordsDescriptor,
      chartingDescriptor,
      forcedDownSummaryDescriptor,
      medicationSafetyDescriptor,
    ]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('CLINICAL_SUMMARY')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('MEDICATION_SAFETY')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'CLINICAL_SUMMARY', mode: 'MANUAL' }],
    });
  });

  it('behaviourally: checking degrades to checked:false while clinical-summary is down, and resumes once it recovers', async () => {
    const { summary } = buildStack();
    const controller = new MedicationSafetyController(
      new MedicationSafetyService(new MedicationSafetyRepository(), summary),
    );
    const allergy = summary.recordPatientReported({
      patientId: 'patient-1',
      kind: 'ALLERGY',
      label: 'Penicillin',
      value: 'Rash',
    });

    summary.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    const duringOutage = await controller.check(currentUser, { proposedLabel: 'Penicillin' });
    expect(duringOutage).toEqual({
      proposedLabel: 'Penicillin',
      findings: [],
      interactionRulesConsulted: 0,
      checked: false,
    });

    summary.health = () => Promise.resolve({ status: 'UP' });
    const afterRecovery = await controller.check(currentUser, { proposedLabel: 'Penicillin' });
    expect(afterRecovery.checked).toBe(true);
    expect(afterRecovery.findings).toEqual([
      {
        kind: 'ALLERGY_CONFLICT',
        conflictsWithItemId: allergy.id,
        detail: 'Patient has an active recorded allergy to "Penicillin"',
      },
    ]);
  });
});

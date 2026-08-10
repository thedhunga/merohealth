import { buildModuleRegistry, collectHealthStates, resolveAvailability } from '@swasthya/module-registry';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { createClinicalChartingModuleDescriptor } from '../clinical-charting/clinical-charting.module-descriptor.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { ClinicalSummaryRepository } from '../clinical-summary/clinical-summary.repository.js';
import { createClinicalSummaryModuleDescriptor } from '../clinical-summary/clinical-summary.module-descriptor.js';
import { ClinicalSummaryService } from '../clinical-summary/clinical-summary.service.js';
import { createMedicationSafetyModuleDescriptor } from '../medication-safety/medication-safety.module-descriptor.js';
import { MedicationSafetyRepository } from '../medication-safety/medication-safety.repository.js';
import { MedicationSafetyService } from '../medication-safety/medication-safety.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { createHealthRecordsModuleDescriptor } from '../records/records.module-descriptor.js';
import { RecordsService } from '../records/records.service.js';
import { createPrescribingModuleDescriptor } from './prescribing.module-descriptor.js';
import { PrescribingRepository } from './prescribing.repository.js';
import { PrescribingService } from './prescribing.service.js';

function buildStack() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const summary = new ClinicalSummaryService(new ClinicalSummaryRepository(), charting);
  const medicationSafety = new MedicationSafetyService(new MedicationSafetyRepository(), summary);
  return { documents, charting, summary, medicationSafety };
}

const lineInput = {
  label: 'Amoxicillin 500mg capsule',
  dosageInstructions: 'One capsule three times daily for seven days',
  quantity: '21 capsules',
  isControlledSubstance: false,
};

/**
 * §2 rule 5, "the shell renders around holes," demonstrated against a real
 * thrown error, same shape `medication-safety`'s own
 * `BrokenMedicationSafetyRepository` already used.
 */
class BrokenPrescribingRepository extends PrescribingRepository {
  override save(): never {
    throw new Error('simulated store outage');
  }
}

describe('prescribing fault isolation', () => {
  it('a broken prescribing repository does not take clinical-charting down with it', async () => {
    const { charting, summary, medicationSafety } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    const brokenPrescribing = new PrescribingService(new BrokenPrescribingRepository(), charting, medicationSafety);
    await expect(brokenPrescribing.openPrescription(encounter.id, { clinicianId: 'clinician-1' })).rejects.toThrow(
      'simulated store outage',
    );

    // clinical-charting and clinical-summary keep working — the outage
    // is confined to prescribing's own storage.
    expect(charting.getEncounter(encounter.id).status).toBe('OPEN');
    summary.recordPatientReported({ patientId: 'patient-1', kind: 'ALLERGY', label: 'Penicillin', value: 'Rash' });
    expect(summary.listItems('patient-1')).toHaveLength(1);
  });

  it('resolveAvailability marks PRESCRIBING available but HIDE-degraded when CLINICAL_CHARTING is DOWN', async () => {
    const { documents, charting, summary, medicationSafety } = buildStack();
    const prescribing = new PrescribingService(new PrescribingRepository(), charting, medicationSafety);

    const recordsDescriptor = createHealthRecordsModuleDescriptor(documents);
    const forcedDownChartingDescriptor = {
      ...createClinicalChartingModuleDescriptor(charting),
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const summaryDescriptor = createClinicalSummaryModuleDescriptor(summary);
    const medicationSafetyDescriptor = createMedicationSafetyModuleDescriptor(medicationSafety);
    const prescribingDescriptor = createPrescribingModuleDescriptor(prescribing);

    const registry = buildModuleRegistry([
      recordsDescriptor,
      forcedDownChartingDescriptor,
      summaryDescriptor,
      medicationSafetyDescriptor,
      prescribingDescriptor,
    ]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('CLINICAL_CHARTING')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('PRESCRIBING')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'CLINICAL_CHARTING', mode: 'HIDE' }],
    });
  });

  it('resolveAvailability marks PRESCRIBING available but MANUAL-degraded when MEDICATION_SAFETY is DOWN', async () => {
    const { documents, charting, summary, medicationSafety } = buildStack();
    const prescribing = new PrescribingService(new PrescribingRepository(), charting, medicationSafety);

    const recordsDescriptor = createHealthRecordsModuleDescriptor(documents);
    const chartingDescriptor = createClinicalChartingModuleDescriptor(charting);
    const summaryDescriptor = createClinicalSummaryModuleDescriptor(summary);
    const forcedDownMedicationSafetyDescriptor = {
      ...createMedicationSafetyModuleDescriptor(medicationSafety),
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const prescribingDescriptor = createPrescribingModuleDescriptor(prescribing);

    const registry = buildModuleRegistry([
      recordsDescriptor,
      chartingDescriptor,
      summaryDescriptor,
      forcedDownMedicationSafetyDescriptor,
      prescribingDescriptor,
    ]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('MEDICATION_SAFETY')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('PRESCRIBING')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'MEDICATION_SAFETY', mode: 'MANUAL' }],
    });
  });

  it('behaviourally: refuses to open a prescription while clinical-charting is down, and resumes once it recovers', async () => {
    const { charting, medicationSafety } = buildStack();
    const prescribing = new PrescribingService(new PrescribingRepository(), charting, medicationSafety);
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(prescribing.openPrescription(encounter.id, { clinicianId: 'clinician-1' })).rejects.toThrow(
      'clinical-charting is down',
    );

    charting.health = () => Promise.resolve({ status: 'UP' });
    const prescription = await prescribing.openPrescription(encounter.id, { clinicianId: 'clinician-1' });
    expect(prescription.status).toBe('DRAFT');
  });

  it('behaviourally, clinical-suite.md §2 verbatim: signing still succeeds and records UNAVAILABLE while medication-safety cannot be checked, and resumes CHECKED once it recovers', async () => {
    const { charting, summary, medicationSafety } = buildStack();
    const prescribing = new PrescribingService(new PrescribingRepository(), charting, medicationSafety);
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const prescription = await prescribing.openPrescription(encounter.id, { clinicianId: 'clinician-1' });
    prescribing.addLine(prescription.id, lineInput);

    // medication-safety itself never goes DOWN (row 5's own MANUAL
    // degradation against clinical-summary) — this simulates that same
    // one-hop-further degradation reaching prescribing.
    summary.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    const signedDuringOutage = await prescribing.signPrescription(prescription.id, 'Dr. Shrestha');
    expect(signedDuringOutage.status).toBe('SIGNED');
    expect(signedDuringOutage.safetyCheckStatus).toBe('UNAVAILABLE');

    summary.health = () => Promise.resolve({ status: 'UP' });
    const encounter2 = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const prescription2 = await prescribing.openPrescription(encounter2.id, { clinicianId: 'clinician-1' });
    prescribing.addLine(prescription2.id, lineInput);
    const signedAfterRecovery = await prescribing.signPrescription(prescription2.id, 'Dr. Shrestha');
    expect(signedAfterRecovery.safetyCheckStatus).toBe('CHECKED');
  });
});

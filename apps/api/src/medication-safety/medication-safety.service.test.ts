import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { ClinicalSummaryRepository } from '../clinical-summary/clinical-summary.repository.js';
import { ClinicalSummaryService } from '../clinical-summary/clinical-summary.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { MedicationSafetyRepository } from './medication-safety.repository.js';
import { MedicationSafetyService } from './medication-safety.service.js';

function buildMedicationSafety() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const summary = new ClinicalSummaryService(new ClinicalSummaryRepository(), charting);
  const medicationSafety = new MedicationSafetyService(new MedicationSafetyRepository(), summary);
  return { medicationSafety, summary };
}

describe('MedicationSafetyService.checkMedication', () => {
  it("flags an allergy conflict against the patient's active allergies", async () => {
    const { medicationSafety, summary } = buildMedicationSafety();
    const allergy = summary.recordPatientReported({
      patientId: 'patient-1',
      kind: 'ALLERGY',
      label: 'Penicillin',
      value: 'Rash',
    });

    const result = await medicationSafety.checkMedication('patient-1', 'Penicillin');

    expect(result.checked).toBe(true);
    expect(result.findings).toEqual([
      {
        kind: 'ALLERGY_CONFLICT',
        conflictsWithItemId: allergy.id,
        detail: 'Patient has an active recorded allergy to "Penicillin"',
      },
    ]);
  });

  it("flags duplicate therapy against the patient's active medications", async () => {
    const { medicationSafety, summary } = buildMedicationSafety();
    const medication = summary.recordPatientReported({
      patientId: 'patient-1',
      kind: 'MEDICATION',
      label: 'Metformin',
      value: '500mg twice daily',
    });

    const result = await medicationSafety.checkMedication('patient-1', 'Metformin');

    expect(result.findings).toEqual([
      {
        kind: 'DUPLICATE_THERAPY',
        conflictsWithItemId: medication.id,
        detail: 'Patient already has an active recorded medication "Metformin"',
      },
    ]);
  });

  it('ignores a resolved allergy', async () => {
    const { medicationSafety, summary } = buildMedicationSafety();
    const allergy = summary.recordPatientReported({
      patientId: 'patient-1',
      kind: 'ALLERGY',
      label: 'Penicillin',
      value: 'Rash',
    });
    summary.resolveItem(allergy.id, 'patient-1');

    const result = await medicationSafety.checkMedication('patient-1', 'Penicillin');

    expect(result.findings).toEqual([]);
  });

  it("only reads the requested patient's items", async () => {
    const { medicationSafety, summary } = buildMedicationSafety();
    summary.recordPatientReported({ patientId: 'patient-2', kind: 'ALLERGY', label: 'Penicillin', value: 'Rash' });

    const result = await medicationSafety.checkMedication('patient-1', 'Penicillin');

    expect(result.findings).toEqual([]);
  });

  it('reports checked:false and no findings while clinical-summary is down, instead of throwing or claiming a clean check', async () => {
    const { medicationSafety, summary } = buildMedicationSafety();
    summary.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    const result = await medicationSafety.checkMedication('patient-1', 'Penicillin');

    expect(result).toEqual({ proposedLabel: 'Penicillin', findings: [], interactionRulesConsulted: 0, checked: false });
  });
});

describe('MedicationSafetyService.health', () => {
  it('reports UP with no failure mode of its own', async () => {
    const { medicationSafety } = buildMedicationSafety();
    await expect(medicationSafety.health()).resolves.toEqual({ status: 'UP' });
  });
});

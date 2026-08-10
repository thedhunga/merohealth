import { BadRequestException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { ClinicalSummaryRepository } from '../clinical-summary/clinical-summary.repository.js';
import { ClinicalSummaryService } from '../clinical-summary/clinical-summary.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { MedicationSafetyController } from './medication-safety.controller.js';
import { MedicationSafetyRepository } from './medication-safety.repository.js';
import { MedicationSafetyService } from './medication-safety.service.js';

function buildController() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const summary = new ClinicalSummaryService(new ClinicalSummaryRepository(), charting);
  const controller = new MedicationSafetyController(
    new MedicationSafetyService(new MedicationSafetyRepository(), summary),
  );
  return { controller, summary };
}

describe('MedicationSafetyController.check', () => {
  it('checks a valid body and returns the result', async () => {
    const { controller, summary } = buildController();
    summary.recordPatientReported({ patientId: 'patient-1', kind: 'ALLERGY', label: 'Penicillin', value: 'Rash' });

    const result = await controller.check({ patientId: 'patient-1', proposedLabel: 'Penicillin' });

    expect(result.checked).toBe(true);
    expect(result.findings).toHaveLength(1);
  });

  it('rejects a request missing a required field', () => {
    const { controller } = buildController();
    expect(() => controller.check({ patientId: 'patient-1' })).toThrow(BadRequestException);
  });

  it('rejects an empty proposedLabel', () => {
    const { controller } = buildController();
    expect(() => controller.check({ patientId: 'patient-1', proposedLabel: '   ' })).toThrow(BadRequestException);
  });
});

describe('MedicationSafetyController.health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});

import { BadRequestException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { ClinicalSummaryRepository } from '../clinical-summary/clinical-summary.repository.js';
import { ClinicalSummaryService } from '../clinical-summary/clinical-summary.service.js';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { SchedulingRepository } from '../scheduling/scheduling.repository.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { PopulationHealthController } from './population-health.controller.js';
import { PopulationHealthService } from './population-health.service.js';

function buildController() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const summary = new ClinicalSummaryService(new ClinicalSummaryRepository(), charting);
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const scheduling = new SchedulingService(new SchedulingRepository(), patients);
  const populationHealth = new PopulationHealthService(summary, scheduling);
  const controller = new PopulationHealthController(populationHealth);
  return { controller, summary, patients, scheduling };
}

describe('PopulationHealthController.registry', () => {
  it('returns the registry and total for a valid query', async () => {
    const { controller, summary } = buildController();
    summary.recordPatientReported({ patientId: 'patient-1', kind: 'CONDITION', label: 'Type 2 Diabetes', value: '' });

    const result = await controller.registry({ kind: 'CONDITION', label: 'Type 2 Diabetes' });

    expect(result.total).toBe(1);
    expect(result.registry[0]).toMatchObject({ patientId: 'patient-1' });
  });

  it('rejects a query missing label', async () => {
    const { controller } = buildController();
    await expect(controller.registry({ kind: 'CONDITION' })).rejects.toThrow(BadRequestException);
  });

  it('rejects a query with an invalid kind', async () => {
    const { controller } = buildController();
    await expect(controller.registry({ kind: 'NOT_A_KIND', label: 'Type 2 Diabetes' })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('PopulationHealthController.recall', () => {
  it('returns the recall list and total for a valid query', async () => {
    const { controller, summary } = buildController();
    summary.recordPatientReported({ patientId: 'patient-1', kind: 'CONDITION', label: 'Type 2 Diabetes', value: '' });

    const result = await controller.recall({
      kind: 'CONDITION',
      label: 'Type 2 Diabetes',
      asOf: '2026-08-11T00:00:00.000Z',
    });

    expect(result.total).toBe(1);
    expect(result.recall[0]).toMatchObject({ patientId: 'patient-1', dueForRecall: true });
  });

  it('rejects a query with a malformed asOf', async () => {
    const { controller } = buildController();
    await expect(
      controller.recall({ kind: 'CONDITION', label: 'Type 2 Diabetes', asOf: 'not-a-date' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a query missing asOf', async () => {
    const { controller } = buildController();
    await expect(controller.recall({ kind: 'CONDITION', label: 'Type 2 Diabetes' })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('PopulationHealthController.health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});

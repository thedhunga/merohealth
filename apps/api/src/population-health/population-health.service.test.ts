import { ServiceUnavailableException } from '@nestjs/common';
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
import { PopulationHealthService } from './population-health.service.js';

function buildStack() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const summary = new ClinicalSummaryService(new ClinicalSummaryRepository(), charting);
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const scheduling = new SchedulingService(new SchedulingRepository(), patients);
  const populationHealth = new PopulationHealthService(summary, scheduling);
  return { charting, summary, patients, scheduling, populationHealth };
}

describe('PopulationHealthService.buildRegistry', () => {
  it('lists every patient with an ACTIVE clinical-summary item matching kind and label', async () => {
    const { summary, populationHealth } = buildStack();
    summary.recordPatientReported({
      patientId: 'patient-1',
      kind: 'CONDITION',
      label: 'Type 2 Diabetes',
      value: 'diagnosed 2024',
    });
    summary.recordPatientReported({ patientId: 'patient-2', kind: 'CONDITION', label: 'Hypertension', value: '' });

    const registry = await populationHealth.buildRegistry('CONDITION', 'Type 2 Diabetes');

    expect(registry).toHaveLength(1);
    expect(registry[0]).toMatchObject({ patientId: 'patient-1', label: 'Type 2 Diabetes' });
  });

  it('refuses (503) while clinical-summary is down', async () => {
    const { summary, populationHealth } = buildStack();
    summary.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(populationHealth.buildRegistry('CONDITION', 'Type 2 Diabetes')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});

describe('PopulationHealthService.buildRecall', () => {
  it('marks a registry patient dueForRecall when they have no upcoming SCHEDULED appointment', async () => {
    const { summary, populationHealth } = buildStack();
    const recorded = summary.recordPatientReported({
      patientId: 'patient-1',
      kind: 'CONDITION',
      label: 'Type 2 Diabetes',
      value: '',
    });

    const recall = await populationHealth.buildRecall('CONDITION', 'Type 2 Diabetes', '2026-08-11T00:00:00.000Z');

    expect(recall).toEqual([
      {
        patientId: 'patient-1',
        matchedItemId: recorded.id,
        label: 'Type 2 Diabetes',
        nextScheduledAppointmentAt: null,
        dueForRecall: true,
      },
    ]);
  });

  it('marks a registry patient not due when a SCHEDULED appointment exists at or after asOf', async () => {
    const { summary, scheduling, patients, populationHealth } = buildStack();
    const patient = patients.register({
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
    });
    summary.recordPatientReported({ patientId: patient.id, kind: 'CONDITION', label: 'Type 2 Diabetes', value: '' });
    await scheduling.schedule({
      patientId: patient.id,
      clinicianId: 'clinician-1',
      scheduledStart: '2026-09-01T09:00:00.000Z',
      scheduledEnd: '2026-09-01T09:30:00.000Z',
    });

    const recall = await populationHealth.buildRecall('CONDITION', 'Type 2 Diabetes', '2026-08-11T00:00:00.000Z');

    expect(recall).toEqual([
      expect.objectContaining({
        patientId: patient.id,
        nextScheduledAppointmentAt: '2026-09-01T09:00:00.000Z',
        dueForRecall: false,
      }),
    ]);
  });

  it('refuses (503) while scheduling is down, even though clinical-summary is up', async () => {
    const { summary, scheduling, populationHealth } = buildStack();
    summary.recordPatientReported({
      patientId: 'patient-1',
      kind: 'CONDITION',
      label: 'Type 2 Diabetes',
      value: '',
    });
    scheduling.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(
      populationHealth.buildRecall('CONDITION', 'Type 2 Diabetes', '2026-08-11T00:00:00.000Z'),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});

describe('PopulationHealthService.health', () => {
  it('reports UP', async () => {
    const { populationHealth } = buildStack();
    await expect(populationHealth.health()).resolves.toEqual({ status: 'UP' });
  });
});

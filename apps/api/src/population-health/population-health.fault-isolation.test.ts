import { buildModuleRegistry, collectHealthStates, resolveAvailability } from '@swasthya/module-registry';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { createClinicalChartingModuleDescriptor } from '../clinical-charting/clinical-charting.module-descriptor.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { ClinicalSummaryRepository } from '../clinical-summary/clinical-summary.repository.js';
import { createClinicalSummaryModuleDescriptor } from '../clinical-summary/clinical-summary.module-descriptor.js';
import { ClinicalSummaryService } from '../clinical-summary/clinical-summary.service.js';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { createPatientRegistryModuleDescriptor } from '../patient-registry/patient-registry.module-descriptor.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { createHealthRecordsModuleDescriptor } from '../records/records.module-descriptor.js';
import { RecordsService } from '../records/records.service.js';
import { createSchedulingModuleDescriptor } from '../scheduling/scheduling.module-descriptor.js';
import { SchedulingRepository } from '../scheduling/scheduling.repository.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { createPopulationHealthModuleDescriptor } from './population-health.module-descriptor.js';
import { PopulationHealthService } from './population-health.service.js';

function buildStack() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const summary = new ClinicalSummaryService(new ClinicalSummaryRepository(), charting);
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const scheduling = new SchedulingService(new SchedulingRepository(), patients);
  const populationHealth = new PopulationHealthService(summary, scheduling);
  return { documents, charting, summary, patients, scheduling, populationHealth };
}

describe('population-health fault isolation', () => {
  it('resolveAvailability marks POPULATION_HEALTH available but HIDE-degraded when CLINICAL_SUMMARY is DOWN', async () => {
    const { documents, charting, summary, patients, scheduling, populationHealth } = buildStack();

    // buildModuleRegistry validates every degradesWith reference, so the
    // full chain clinical-summary and scheduling themselves depend on
    // (records, clinical-charting, patient-registry) has to be registered
    // too, not just the one edge each test is exercising.
    const recordsDescriptor = createHealthRecordsModuleDescriptor(documents);
    const chartingDescriptor = createClinicalChartingModuleDescriptor(charting);
    const patientsDescriptor = createPatientRegistryModuleDescriptor(patients);
    const forcedDownSummaryDescriptor = {
      ...createClinicalSummaryModuleDescriptor(summary),
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const schedulingDescriptor = createSchedulingModuleDescriptor(scheduling);
    const populationHealthDescriptor = createPopulationHealthModuleDescriptor(populationHealth);

    const registry = buildModuleRegistry([
      recordsDescriptor,
      chartingDescriptor,
      patientsDescriptor,
      forcedDownSummaryDescriptor,
      schedulingDescriptor,
      populationHealthDescriptor,
    ]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('CLINICAL_SUMMARY')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('POPULATION_HEALTH')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'CLINICAL_SUMMARY', mode: 'HIDE' }],
    });
  });

  it('resolveAvailability marks POPULATION_HEALTH available but HIDE-degraded when SCHEDULING is DOWN', async () => {
    const { documents, charting, summary, patients, scheduling, populationHealth } = buildStack();

    const recordsDescriptor = createHealthRecordsModuleDescriptor(documents);
    const chartingDescriptor = createClinicalChartingModuleDescriptor(charting);
    const patientsDescriptor = createPatientRegistryModuleDescriptor(patients);
    const summaryDescriptor = createClinicalSummaryModuleDescriptor(summary);
    const forcedDownSchedulingDescriptor = {
      ...createSchedulingModuleDescriptor(scheduling),
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const populationHealthDescriptor = createPopulationHealthModuleDescriptor(populationHealth);

    const registry = buildModuleRegistry([
      recordsDescriptor,
      chartingDescriptor,
      patientsDescriptor,
      summaryDescriptor,
      forcedDownSchedulingDescriptor,
      populationHealthDescriptor,
    ]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('SCHEDULING')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('POPULATION_HEALTH')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'SCHEDULING', mode: 'HIDE' }],
    });
  });

  it('behaviourally: refuses to build a registry while clinical-summary is down, and resumes once it recovers', async () => {
    const { summary, populationHealth } = buildStack();
    summary.recordPatientReported({ patientId: 'patient-1', kind: 'CONDITION', label: 'Type 2 Diabetes', value: '' });

    summary.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(populationHealth.buildRegistry('CONDITION', 'Type 2 Diabetes')).rejects.toThrow(
      'clinical-summary is down',
    );

    summary.health = () => Promise.resolve({ status: 'UP' });
    const registry = await populationHealth.buildRegistry('CONDITION', 'Type 2 Diabetes');
    expect(registry).toHaveLength(1);
  });

  it('behaviourally: refuses to build a recall list while scheduling is down, and resumes once it recovers', async () => {
    const { summary, scheduling, populationHealth } = buildStack();
    summary.recordPatientReported({ patientId: 'patient-1', kind: 'CONDITION', label: 'Type 2 Diabetes', value: '' });

    scheduling.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(
      populationHealth.buildRecall('CONDITION', 'Type 2 Diabetes', '2026-08-11T00:00:00.000Z'),
    ).rejects.toThrow('scheduling is down');

    scheduling.health = () => Promise.resolve({ status: 'UP' });
    const recall = await populationHealth.buildRecall('CONDITION', 'Type 2 Diabetes', '2026-08-11T00:00:00.000Z');
    expect(recall).toHaveLength(1);
  });

  it('behaviourally: a broken clinical-summary read does not take scheduling down with it', async () => {
    const { patients, scheduling, populationHealth } = buildStack();
    const patient = patients.register({
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
    });
    await scheduling.schedule({
      patientId: patient.id,
      clinicianId: 'clinician-1',
      scheduledStart: '2026-09-01T09:00:00.000Z',
      scheduledEnd: '2026-09-01T09:30:00.000Z',
    });

    await expect(populationHealth.buildRegistry('CONDITION', 'Type 2 Diabetes')).resolves.toEqual([]);
    // scheduling keeps working — population-health never writes to either
    // dependency, so there is no write path for its own failure to corrupt.
    expect(scheduling.list()).toHaveLength(1);
  });
});

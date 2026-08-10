import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { ClinicalSummaryRepository } from '../clinical-summary/clinical-summary.repository.js';
import { ClinicalSummaryService } from '../clinical-summary/clinical-summary.service.js';
import { MedicationSafetyRepository } from '../medication-safety/medication-safety.repository.js';
import { MedicationSafetyService } from '../medication-safety/medication-safety.service.js';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { PrescribingRepository } from '../prescribing/prescribing.repository.js';
import { PrescribingService } from '../prescribing/prescribing.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { SchedulingRepository } from '../scheduling/scheduling.repository.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { ClinicalSuiteService } from './clinical-suite.service.js';

/**
 * Every service is real, not mocked — this is the same "wire the actual
 * classes together" shape every fault-isolation test in this app already
 * uses, just assembled for all seven registered modules at once instead of
 * the two or three any single module's own test needs.
 */
function buildStack() {
  const records = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const scheduling = new SchedulingService(new SchedulingRepository(), patients);
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), records);
  const summary = new ClinicalSummaryService(new ClinicalSummaryRepository(), charting);
  const medicationSafety = new MedicationSafetyService(new MedicationSafetyRepository(), summary);
  const prescribing = new PrescribingService(new PrescribingRepository(), charting, medicationSafety);
  return { records, patients, scheduling, charting, summary, medicationSafety, prescribing };
}

describe('ClinicalSuiteService', () => {
  it('reports all seven registered modules available with no degradations when everything is up', async () => {
    const { records, patients, scheduling, charting, summary, medicationSafety, prescribing } = buildStack();
    const suite = new ClinicalSuiteService(records, patients, scheduling, charting, summary, medicationSafety, prescribing);

    const resolved = await suite.resolve();

    expect(resolved).toHaveLength(7);
    expect(resolved.map((module) => module.key).sort()).toEqual(
      [
        'CLINICAL_CHARTING',
        'CLINICAL_SUMMARY',
        'HEALTH_RECORDS',
        'MEDICATION_SAFETY',
        'PATIENT_REGISTRY',
        'PRESCRIBING',
        'SCHEDULING',
      ].sort(),
    );
    for (const module of resolved) {
      expect(module).toMatchObject({ available: true, health: 'UP', blockedBy: [], degradations: [] });
    }
  });

  it('cascades a CLINICAL_CHARTING outage to every dependent module\'s degradations, leaving unrelated modules untouched', async () => {
    const { records, patients, scheduling, charting, summary, medicationSafety, prescribing } = buildStack();
    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    const suite = new ClinicalSuiteService(records, patients, scheduling, charting, summary, medicationSafety, prescribing);

    const resolved = await suite.resolve();
    const byKey = new Map(resolved.map((module) => [module.key, module]));

    expect(byKey.get('CLINICAL_CHARTING')).toMatchObject({ available: false, health: 'DOWN' });
    // clinical-summary and prescribing both declare a HIDE degradesWith on
    // CLINICAL_CHARTING — the aggregate view has to surface both, not just
    // the one edge any single module's own test happens to check.
    expect(byKey.get('CLINICAL_SUMMARY')).toMatchObject({
      available: true,
      degradations: [{ dependency: 'CLINICAL_CHARTING', mode: 'HIDE' }],
    });
    expect(byKey.get('PRESCRIBING')).toMatchObject({
      available: true,
      degradations: [{ dependency: 'CLINICAL_CHARTING', mode: 'HIDE' }],
    });
    // patient-registry, scheduling and health-records have no dependency on
    // clinical-charting at all and must read as fully available.
    expect(byKey.get('PATIENT_REGISTRY')).toMatchObject({ available: true, degradations: [] });
    expect(byKey.get('SCHEDULING')).toMatchObject({ available: true, degradations: [] });
    expect(byKey.get('HEALTH_RECORDS')).toMatchObject({ available: true, degradations: [] });
  });

  it('a probe that throws is reported DOWN rather than rejecting the whole resolve() call', async () => {
    const { records, patients, scheduling, charting, summary, medicationSafety, prescribing } = buildStack();
    patients.health = () => {
      throw new Error('simulated probe failure');
    };
    const suite = new ClinicalSuiteService(records, patients, scheduling, charting, summary, medicationSafety, prescribing);

    const resolved = await suite.resolve();
    const byKey = new Map(resolved.map((module) => [module.key, module]));

    expect(byKey.get('PATIENT_REGISTRY')).toMatchObject({ available: false, health: 'DOWN' });
    // scheduling degrades to READ_ONLY rather than going down with it.
    expect(byKey.get('SCHEDULING')).toMatchObject({
      available: true,
      degradations: [{ dependency: 'PATIENT_REGISTRY', mode: 'READ_ONLY' }],
    });
  });
});

import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { BillingRepository } from '../billing/billing.repository.js';
import { BillingService } from '../billing/billing.service.js';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { ClinicalSummaryRepository } from '../clinical-summary/clinical-summary.repository.js';
import { ClinicalSummaryService } from '../clinical-summary/clinical-summary.service.js';
import { DiagnosticsOrdersRepository } from '../diagnostics-orders/diagnostics-orders.repository.js';
import { DiagnosticsOrdersService } from '../diagnostics-orders/diagnostics-orders.service.js';
import { MedicationSafetyRepository } from '../medication-safety/medication-safety.repository.js';
import { MedicationSafetyService } from '../medication-safety/medication-safety.service.js';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { PopulationHealthService } from '../population-health/population-health.service.js';
import { PrescribingRepository } from '../prescribing/prescribing.repository.js';
import { PrescribingService } from '../prescribing/prescribing.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { ReferralsRepository } from '../referrals/referrals.repository.js';
import { ReferralsService } from '../referrals/referrals.service.js';
import { SchedulingRepository } from '../scheduling/scheduling.repository.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { TeleconsultationRepository } from '../teleconsultation/teleconsultation.repository.js';
import { TeleconsultationService } from '../teleconsultation/teleconsultation.service.js';
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
  const diagnosticsOrders = new DiagnosticsOrdersService(new DiagnosticsOrdersRepository(), charting);
  const teleconsultation = new TeleconsultationService(new TeleconsultationRepository(), scheduling);
  const billing = new BillingService(new BillingRepository(), charting);
  const referrals = new ReferralsService(new ReferralsRepository(), charting);
  const populationHealth = new PopulationHealthService(summary, scheduling);
  return {
    records,
    patients,
    scheduling,
    charting,
    summary,
    medicationSafety,
    prescribing,
    diagnosticsOrders,
    teleconsultation,
    billing,
    referrals,
    populationHealth,
  };
}

function buildSuite(stack: ReturnType<typeof buildStack>): ClinicalSuiteService {
  return new ClinicalSuiteService(
    stack.records,
    stack.patients,
    stack.scheduling,
    stack.charting,
    stack.summary,
    stack.medicationSafety,
    stack.prescribing,
    stack.diagnosticsOrders,
    stack.teleconsultation,
    stack.billing,
    stack.referrals,
    stack.populationHealth,
  );
}

describe('ClinicalSuiteService', () => {
  it('reports all twelve registered modules available with no degradations when everything is up', async () => {
    const stack = buildStack();
    const suite = buildSuite(stack);

    const resolved = await suite.resolve();

    expect(resolved).toHaveLength(12);
    expect(resolved.map((module) => module.key).sort()).toEqual(
      [
        'BILLING',
        'CLINICAL_CHARTING',
        'CLINICAL_SUMMARY',
        'DIAGNOSTICS_ORDERS',
        'HEALTH_RECORDS',
        'MEDICATION_SAFETY',
        'PATIENT_REGISTRY',
        'POPULATION_HEALTH',
        'PRESCRIBING',
        'REFERRALS',
        'SCHEDULING',
        'TELECONSULTATION',
      ].sort(),
    );
    for (const module of resolved) {
      expect(module).toMatchObject({ available: true, health: 'UP', blockedBy: [], degradations: [] });
    }
  });

  it('cascades a CLINICAL_CHARTING outage to every dependent module\'s degradations, leaving unrelated modules untouched', async () => {
    const stack = buildStack();
    stack.charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    const suite = buildSuite(stack);

    const resolved = await suite.resolve();
    const byKey = new Map(resolved.map((module) => [module.key, module]));

    expect(byKey.get('CLINICAL_CHARTING')).toMatchObject({ available: false, health: 'DOWN' });
    // clinical-summary, prescribing, diagnostics-orders, billing and
    // referrals each declare a HIDE degradesWith on CLINICAL_CHARTING — the
    // aggregate view has to surface all five, not just the one edge any
    // single module's own test happens to check.
    expect(byKey.get('CLINICAL_SUMMARY')).toMatchObject({
      available: true,
      degradations: [{ dependency: 'CLINICAL_CHARTING', mode: 'HIDE' }],
    });
    expect(byKey.get('PRESCRIBING')).toMatchObject({
      available: true,
      degradations: [{ dependency: 'CLINICAL_CHARTING', mode: 'HIDE' }],
    });
    expect(byKey.get('DIAGNOSTICS_ORDERS')).toMatchObject({
      available: true,
      degradations: [{ dependency: 'CLINICAL_CHARTING', mode: 'HIDE' }],
    });
    expect(byKey.get('BILLING')).toMatchObject({
      available: true,
      degradations: [{ dependency: 'CLINICAL_CHARTING', mode: 'HIDE' }],
    });
    expect(byKey.get('REFERRALS')).toMatchObject({
      available: true,
      degradations: [{ dependency: 'CLINICAL_CHARTING', mode: 'HIDE' }],
    });
    // patient-registry, scheduling, teleconsultation, health-records and
    // population-health have no dependency on clinical-charting at all and
    // must read as fully available — teleconsultation's own dependencies
    // are SCHEDULING, and population-health's are CLINICAL_SUMMARY/
    // SCHEDULING, none of them CLINICAL_CHARTING, and CLINICAL_SUMMARY
    // being merely degraded (not DOWN) does not cascade to it either (§2's
    // "degradesWith never cascades past one hop").
    expect(byKey.get('PATIENT_REGISTRY')).toMatchObject({ available: true, degradations: [] });
    expect(byKey.get('SCHEDULING')).toMatchObject({ available: true, degradations: [] });
    expect(byKey.get('TELECONSULTATION')).toMatchObject({ available: true, degradations: [] });
    expect(byKey.get('HEALTH_RECORDS')).toMatchObject({ available: true, degradations: [] });
    expect(byKey.get('POPULATION_HEALTH')).toMatchObject({ available: true, degradations: [] });
  });

  it('a probe that throws is reported DOWN rather than rejecting the whole resolve() call', async () => {
    const stack = buildStack();
    stack.patients.health = () => {
      throw new Error('simulated probe failure');
    };
    const suite = buildSuite(stack);

    const resolved = await suite.resolve();
    const byKey = new Map(resolved.map((module) => [module.key, module]));

    expect(byKey.get('PATIENT_REGISTRY')).toMatchObject({ available: false, health: 'DOWN' });
    // scheduling degrades to READ_ONLY rather than going down with it.
    expect(byKey.get('SCHEDULING')).toMatchObject({
      available: true,
      degradations: [{ dependency: 'PATIENT_REGISTRY', mode: 'READ_ONLY' }],
    });
    // teleconsultation and population-health only react to SCHEDULING's own
    // `available` (§2's "degradesWith never cascades past one hop"), and
    // SCHEDULING stays `available` here — only degraded — so both must read
    // as fully available too.
    expect(byKey.get('TELECONSULTATION')).toMatchObject({ available: true, degradations: [] });
    expect(byKey.get('POPULATION_HEALTH')).toMatchObject({ available: true, degradations: [] });
  });
});

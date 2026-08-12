import { buildModuleRegistry, collectHealthStates, resolveAvailability } from '@swasthya/module-registry';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it, vi } from 'vitest';
import { createBillingModuleDescriptor } from '../billing/billing.module-descriptor.js';
import { BillingRepository } from '../billing/billing.repository.js';
import { BillingService } from '../billing/billing.service.js';
import { createClinicalChartingModuleDescriptor } from '../clinical-charting/clinical-charting.module-descriptor.js';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { createEngagementModuleDescriptor } from '../engagement/engagement.module-descriptor.js';
import { EngagementRepository } from '../engagement/engagement.repository.js';
import { EngagementService } from '../engagement/engagement.service.js';
import { createImmunizationModuleDescriptor } from '../immunization/immunization.module-descriptor.js';
import { ImmunizationRepository } from '../immunization/immunization.repository.js';
import { ImmunizationService } from '../immunization/immunization.service.js';
import { createPatientRegistryModuleDescriptor } from '../patient-registry/patient-registry.module-descriptor.js';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { createHealthRecordsModuleDescriptor } from '../records/records.module-descriptor.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { createReferralsModuleDescriptor } from '../referrals/referrals.module-descriptor.js';
import { ReferralsRepository } from '../referrals/referrals.repository.js';
import { ReferralsService } from '../referrals/referrals.service.js';
import { createSchedulingModuleDescriptor } from '../scheduling/scheduling.module-descriptor.js';
import { SchedulingRepository } from '../scheduling/scheduling.repository.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { createAnalyticsModuleDescriptor } from './analytics.module-descriptor.js';
import { AnalyticsService } from './analytics.service.js';

function buildStack() {
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const scheduling = new SchedulingService(new SchedulingRepository(), patients);
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const billing = new BillingService(new BillingRepository(), charting);
  const referrals = new ReferralsService(new ReferralsRepository(), charting);
  const engagement = new EngagementService(new EngagementRepository(), patients, { send: vi.fn().mockResolvedValue(undefined) });
  const immunization = new ImmunizationService(new ImmunizationRepository(), charting);
  const analytics = new AnalyticsService(patients, scheduling, billing, referrals, engagement, immunization);
  return { patients, scheduling, documents, charting, billing, referrals, engagement, immunization, analytics };
}

describe('analytics fault isolation', () => {
  it('resolveAvailability marks ANALYTICS available but HIDE-degraded when PATIENT_REGISTRY is DOWN', async () => {
    const { patients, scheduling, documents, charting, billing, referrals, engagement, immunization, analytics } =
      buildStack();

    // buildModuleRegistry validates every degradesWith reference, so every
    // module ANALYTICS or its own dependencies point at — including
    // clinical-charting's own edge to health-records — has to be registered
    // too, not just the one edge this test is exercising.
    const forcedDownPatientsDescriptor = {
      ...createPatientRegistryModuleDescriptor(patients),
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const recordsDescriptor = createHealthRecordsModuleDescriptor(documents);
    const schedulingDescriptor = createSchedulingModuleDescriptor(scheduling);
    const chartingDescriptor = createClinicalChartingModuleDescriptor(charting);
    const billingDescriptor = createBillingModuleDescriptor(billing);
    const referralsDescriptor = createReferralsModuleDescriptor(referrals);
    const engagementDescriptor = createEngagementModuleDescriptor(engagement);
    const immunizationDescriptor = createImmunizationModuleDescriptor(immunization);
    const analyticsDescriptor = createAnalyticsModuleDescriptor(analytics);

    const registry = buildModuleRegistry([
      forcedDownPatientsDescriptor,
      recordsDescriptor,
      schedulingDescriptor,
      chartingDescriptor,
      billingDescriptor,
      referralsDescriptor,
      engagementDescriptor,
      immunizationDescriptor,
      analyticsDescriptor,
    ]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('PATIENT_REGISTRY')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('ANALYTICS')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'PATIENT_REGISTRY', mode: 'HIDE' }],
    });
  });

  it('resolveAvailability marks ANALYTICS available but HIDE-degraded when SCHEDULING is DOWN', async () => {
    const { patients, scheduling, documents, charting, billing, referrals, engagement, immunization, analytics } =
      buildStack();

    const patientsDescriptor = createPatientRegistryModuleDescriptor(patients);
    const recordsDescriptor = createHealthRecordsModuleDescriptor(documents);
    const forcedDownSchedulingDescriptor = {
      ...createSchedulingModuleDescriptor(scheduling),
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const chartingDescriptor = createClinicalChartingModuleDescriptor(charting);
    const billingDescriptor = createBillingModuleDescriptor(billing);
    const referralsDescriptor = createReferralsModuleDescriptor(referrals);
    const engagementDescriptor = createEngagementModuleDescriptor(engagement);
    const immunizationDescriptor = createImmunizationModuleDescriptor(immunization);
    const analyticsDescriptor = createAnalyticsModuleDescriptor(analytics);

    const registry = buildModuleRegistry([
      patientsDescriptor,
      recordsDescriptor,
      forcedDownSchedulingDescriptor,
      chartingDescriptor,
      billingDescriptor,
      referralsDescriptor,
      engagementDescriptor,
      immunizationDescriptor,
      analyticsDescriptor,
    ]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('SCHEDULING')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('ANALYTICS')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'SCHEDULING', mode: 'HIDE' }],
    });
  });

  it('resolveAvailability marks ANALYTICS available but HIDE-degraded when BILLING is DOWN', async () => {
    const { patients, scheduling, documents, charting, billing, referrals, engagement, immunization, analytics } =
      buildStack();

    const patientsDescriptor = createPatientRegistryModuleDescriptor(patients);
    const recordsDescriptor = createHealthRecordsModuleDescriptor(documents);
    const schedulingDescriptor = createSchedulingModuleDescriptor(scheduling);
    const chartingDescriptor = createClinicalChartingModuleDescriptor(charting);
    const forcedDownBillingDescriptor = {
      ...createBillingModuleDescriptor(billing),
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const referralsDescriptor = createReferralsModuleDescriptor(referrals);
    const engagementDescriptor = createEngagementModuleDescriptor(engagement);
    const immunizationDescriptor = createImmunizationModuleDescriptor(immunization);
    const analyticsDescriptor = createAnalyticsModuleDescriptor(analytics);

    const registry = buildModuleRegistry([
      patientsDescriptor,
      recordsDescriptor,
      schedulingDescriptor,
      chartingDescriptor,
      forcedDownBillingDescriptor,
      referralsDescriptor,
      engagementDescriptor,
      immunizationDescriptor,
      analyticsDescriptor,
    ]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('BILLING')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('ANALYTICS')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'BILLING', mode: 'HIDE' }],
    });
  });

  it('resolveAvailability marks ANALYTICS available but HIDE-degraded when REFERRALS is DOWN', async () => {
    const { patients, scheduling, documents, charting, billing, referrals, engagement, immunization, analytics } =
      buildStack();

    const patientsDescriptor = createPatientRegistryModuleDescriptor(patients);
    const recordsDescriptor = createHealthRecordsModuleDescriptor(documents);
    const schedulingDescriptor = createSchedulingModuleDescriptor(scheduling);
    const chartingDescriptor = createClinicalChartingModuleDescriptor(charting);
    const billingDescriptor = createBillingModuleDescriptor(billing);
    const forcedDownReferralsDescriptor = {
      ...createReferralsModuleDescriptor(referrals),
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const engagementDescriptor = createEngagementModuleDescriptor(engagement);
    const immunizationDescriptor = createImmunizationModuleDescriptor(immunization);
    const analyticsDescriptor = createAnalyticsModuleDescriptor(analytics);

    const registry = buildModuleRegistry([
      patientsDescriptor,
      recordsDescriptor,
      schedulingDescriptor,
      chartingDescriptor,
      billingDescriptor,
      forcedDownReferralsDescriptor,
      engagementDescriptor,
      immunizationDescriptor,
      analyticsDescriptor,
    ]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('REFERRALS')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('ANALYTICS')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'REFERRALS', mode: 'HIDE' }],
    });
  });

  it('resolveAvailability marks ANALYTICS available but HIDE-degraded when ENGAGEMENT is DOWN', async () => {
    const { patients, scheduling, documents, charting, billing, referrals, engagement, immunization, analytics } =
      buildStack();

    const patientsDescriptor = createPatientRegistryModuleDescriptor(patients);
    const recordsDescriptor = createHealthRecordsModuleDescriptor(documents);
    const schedulingDescriptor = createSchedulingModuleDescriptor(scheduling);
    const chartingDescriptor = createClinicalChartingModuleDescriptor(charting);
    const billingDescriptor = createBillingModuleDescriptor(billing);
    const referralsDescriptor = createReferralsModuleDescriptor(referrals);
    const forcedDownEngagementDescriptor = {
      ...createEngagementModuleDescriptor(engagement),
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const immunizationDescriptor = createImmunizationModuleDescriptor(immunization);
    const analyticsDescriptor = createAnalyticsModuleDescriptor(analytics);

    const registry = buildModuleRegistry([
      patientsDescriptor,
      recordsDescriptor,
      schedulingDescriptor,
      chartingDescriptor,
      billingDescriptor,
      referralsDescriptor,
      forcedDownEngagementDescriptor,
      immunizationDescriptor,
      analyticsDescriptor,
    ]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('ENGAGEMENT')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('ANALYTICS')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'ENGAGEMENT', mode: 'HIDE' }],
    });
  });

  it('resolveAvailability marks ANALYTICS available but HIDE-degraded when IMMUNIZATION is DOWN', async () => {
    const { patients, scheduling, documents, charting, billing, referrals, engagement, immunization, analytics } =
      buildStack();

    const patientsDescriptor = createPatientRegistryModuleDescriptor(patients);
    const recordsDescriptor = createHealthRecordsModuleDescriptor(documents);
    const schedulingDescriptor = createSchedulingModuleDescriptor(scheduling);
    const chartingDescriptor = createClinicalChartingModuleDescriptor(charting);
    const billingDescriptor = createBillingModuleDescriptor(billing);
    const referralsDescriptor = createReferralsModuleDescriptor(referrals);
    const engagementDescriptor = createEngagementModuleDescriptor(engagement);
    const forcedDownImmunizationDescriptor = {
      ...createImmunizationModuleDescriptor(immunization),
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const analyticsDescriptor = createAnalyticsModuleDescriptor(analytics);

    const registry = buildModuleRegistry([
      patientsDescriptor,
      recordsDescriptor,
      schedulingDescriptor,
      chartingDescriptor,
      billingDescriptor,
      referralsDescriptor,
      engagementDescriptor,
      forcedDownImmunizationDescriptor,
      analyticsDescriptor,
    ]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('IMMUNIZATION')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('ANALYTICS')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'IMMUNIZATION', mode: 'HIDE' }],
    });
  });

  it('behaviourally: refuses the patient summary while patient-registry is down, and resumes once it recovers', async () => {
    const { patients, analytics } = buildStack();
    patients.register({
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
    });

    patients.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(analytics.patientRegistrySummary()).rejects.toThrow('patient-registry is down');

    patients.health = () => Promise.resolve({ status: 'UP' });
    await expect(analytics.patientRegistrySummary()).resolves.toMatchObject({ totalPatients: 1 });
  });

  it('behaviourally: a down scheduling summary does not take the patient summary down with it', async () => {
    const { patients, scheduling, analytics } = buildStack();
    patients.register({
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
    });

    scheduling.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(analytics.schedulingSummary()).rejects.toThrow('scheduling is down');
    await expect(analytics.patientRegistrySummary()).resolves.toMatchObject({ totalPatients: 1 });
  });

  it('behaviourally: a down billing summary does not take the patient summary down with it', async () => {
    const { patients, billing, analytics } = buildStack();
    patients.register({
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
    });

    billing.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(analytics.billingSummary()).rejects.toThrow('billing is down');
    await expect(analytics.patientRegistrySummary()).resolves.toMatchObject({ totalPatients: 1 });
  });

  it('behaviourally: a down referrals summary does not take the patient summary down with it', async () => {
    const { patients, referrals, analytics } = buildStack();
    patients.register({
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
    });

    referrals.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(analytics.referralsSummary()).rejects.toThrow('referrals is down');
    await expect(analytics.patientRegistrySummary()).resolves.toMatchObject({ totalPatients: 1 });
  });

  it('behaviourally: a down engagement summary does not take the patient summary down with it', async () => {
    const { patients, engagement, analytics } = buildStack();
    patients.register({
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
    });

    engagement.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(analytics.engagementSummary()).rejects.toThrow('engagement is down');
    await expect(analytics.patientRegistrySummary()).resolves.toMatchObject({ totalPatients: 1 });
  });

  it('behaviourally: a down immunization summary does not take the patient summary down with it', async () => {
    const { patients, immunization, analytics } = buildStack();
    patients.register({
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
    });

    immunization.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(analytics.immunizationSummary()).rejects.toThrow('immunization is down');
    await expect(analytics.patientRegistrySummary()).resolves.toMatchObject({ totalPatients: 1 });
  });
});

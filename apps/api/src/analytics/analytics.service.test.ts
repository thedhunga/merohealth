import { ServiceUnavailableException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { BillingRepository } from '../billing/billing.repository.js';
import { BillingService } from '../billing/billing.service.js';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { ReferralsRepository } from '../referrals/referrals.repository.js';
import { ReferralsService } from '../referrals/referrals.service.js';
import { SchedulingRepository } from '../scheduling/scheduling.repository.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { AnalyticsService } from './analytics.service.js';

function buildStack() {
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const scheduling = new SchedulingService(new SchedulingRepository(), patients);
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const billing = new BillingService(new BillingRepository(), charting);
  const referrals = new ReferralsService(new ReferralsRepository(), charting);
  const analytics = new AnalyticsService(patients, scheduling, billing, referrals);
  return { patients, scheduling, charting, billing, referrals, analytics };
}

const referralRequestInput = {
  clinicianId: 'clinician-1',
  referredToEntityId: 'demo-doctor-1',
  reason: 'Suspected renal involvement',
};

describe('AnalyticsService.patientRegistrySummary', () => {
  it('counts registered patients, broken down by recorded sex', async () => {
    const { patients, analytics } = buildStack();
    patients.register({
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
    });
    patients.register({
      displayName: 'Ram Thapa',
      dateOfBirth: '1985-01-01',
      sex: 'MALE',
      phone: '9800000001',
      preferredLocale: 'ne',
    });

    const summary = await analytics.patientRegistrySummary();

    expect(summary).toEqual({ totalPatients: 2, bySex: { FEMALE: 1, MALE: 1, OTHER: 0, UNDISCLOSED: 0 } });
  });

  it('refuses (503) while patient-registry is down', async () => {
    const { patients, analytics } = buildStack();
    patients.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(analytics.patientRegistrySummary()).rejects.toThrow(ServiceUnavailableException);
  });
});

describe('AnalyticsService.schedulingSummary', () => {
  it('counts appointments, broken down by status', async () => {
    const { patients, scheduling, analytics } = buildStack();
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

    const summary = await analytics.schedulingSummary();

    expect(summary).toEqual({ totalAppointments: 1, byStatus: { SCHEDULED: 1, CANCELLED: 0 } });
  });

  it('refuses (503) while scheduling is down, even though patient-registry is up', async () => {
    const { scheduling, analytics } = buildStack();
    scheduling.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(analytics.schedulingSummary()).rejects.toThrow(ServiceUnavailableException);
  });

  it('a down patient-registry does not block the scheduling summary', async () => {
    const { patients, scheduling, analytics } = buildStack();
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

    patients.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(analytics.schedulingSummary()).resolves.toEqual({
      totalAppointments: 1,
      byStatus: { SCHEDULED: 1, CANCELLED: 0 },
    });
  });
});

describe('AnalyticsService.billingSummary', () => {
  it('counts invoices, broken down by status', async () => {
    const { charting, billing, analytics } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    await billing.openInvoice(encounter.id, { clinicianId: 'clinician-1' });

    const summary = await analytics.billingSummary();

    expect(summary).toEqual({ totalInvoices: 1, byStatus: { DRAFT: 1, ISSUED: 0, PAID: 0, VOID: 0 } });
  });

  it('refuses (503) while billing is down, even though patient-registry and scheduling are up', async () => {
    const { billing, analytics } = buildStack();
    billing.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(analytics.billingSummary()).rejects.toThrow(ServiceUnavailableException);
  });

  it('a down billing does not block the patient or scheduling summaries, and vice versa', async () => {
    const { patients, charting, billing, analytics } = buildStack();
    patients.register({
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
    });
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    await billing.openInvoice(encounter.id, { clinicianId: 'clinician-1' });

    billing.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(analytics.patientRegistrySummary()).resolves.toMatchObject({ totalPatients: 1 });

    billing.health = () => Promise.resolve({ status: 'UP' });
    patients.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(analytics.billingSummary()).resolves.toEqual({
      totalInvoices: 1,
      byStatus: { DRAFT: 1, ISSUED: 0, PAID: 0, VOID: 0 },
    });
  });
});

describe('AnalyticsService.referralsSummary', () => {
  it('counts referrals, broken down by status', async () => {
    const { charting, referrals, analytics } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    await referrals.requestReferral(encounter.id, referralRequestInput);

    const summary = await analytics.referralsSummary();

    expect(summary).toEqual({
      totalReferrals: 1,
      byStatus: { REQUESTED: 1, ACCEPTED: 0, DECLINED: 0, CANCELLED: 0, COMPLETED: 0 },
    });
  });

  it('refuses (503) while referrals is down, even though patient-registry, scheduling and billing are up', async () => {
    const { referrals, analytics } = buildStack();
    referrals.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(analytics.referralsSummary()).rejects.toThrow(ServiceUnavailableException);
  });

  it('a down referrals does not block the patient or scheduling summaries, and vice versa', async () => {
    const { patients, charting, referrals, analytics } = buildStack();
    patients.register({
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
    });
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    await referrals.requestReferral(encounter.id, referralRequestInput);

    referrals.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(analytics.patientRegistrySummary()).resolves.toMatchObject({ totalPatients: 1 });

    referrals.health = () => Promise.resolve({ status: 'UP' });
    patients.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(analytics.referralsSummary()).resolves.toEqual({
      totalReferrals: 1,
      byStatus: { REQUESTED: 1, ACCEPTED: 0, DECLINED: 0, CANCELLED: 0, COMPLETED: 0 },
    });
  });
});

describe('AnalyticsService.health', () => {
  it('reports UP', async () => {
    const { analytics } = buildStack();
    await expect(analytics.health()).resolves.toEqual({ status: 'UP' });
  });
});

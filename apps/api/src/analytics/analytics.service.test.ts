import { ServiceUnavailableException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it, vi } from 'vitest';
import { BillingRepository } from '../billing/billing.repository.js';
import { BillingService } from '../billing/billing.service.js';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { DiagnosticsOrdersRepository } from '../diagnostics-orders/diagnostics-orders.repository.js';
import { DiagnosticsOrdersService } from '../diagnostics-orders/diagnostics-orders.service.js';
import { EngagementRepository } from '../engagement/engagement.repository.js';
import { EngagementService } from '../engagement/engagement.service.js';
import { ImmunizationRepository } from '../immunization/immunization.repository.js';
import { ImmunizationService } from '../immunization/immunization.service.js';
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
  const engagement = new EngagementService(new EngagementRepository(), patients, { send: vi.fn().mockResolvedValue(undefined) });
  const immunization = new ImmunizationService(new ImmunizationRepository(), charting);
  const diagnosticsOrders = new DiagnosticsOrdersService(new DiagnosticsOrdersRepository(), charting);
  const analytics = new AnalyticsService(
    patients,
    scheduling,
    billing,
    referrals,
    engagement,
    immunization,
    diagnosticsOrders,
  );
  return { patients, scheduling, charting, billing, referrals, engagement, immunization, diagnosticsOrders, analytics };
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

describe('AnalyticsService.engagementSummary', () => {
  it('counts engagement messages, broken down by status', async () => {
    const { patients, engagement, analytics } = buildStack();
    const patient = patients.register({
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
    });
    await engagement.queueMessage(patient.id, { channel: 'SMS', kind: 'REMINDER', body: 'Your appointment is tomorrow.' });

    const summary = await analytics.engagementSummary();

    expect(summary).toEqual({ totalMessages: 1, byStatus: { QUEUED: 0, SENT: 1, FAILED: 0 } });
  });

  it('refuses (503) while engagement is down, even though patient-registry, scheduling, billing and referrals are up', async () => {
    const { engagement, analytics } = buildStack();
    engagement.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(analytics.engagementSummary()).rejects.toThrow(ServiceUnavailableException);
  });

  it('a down engagement does not block the patient or scheduling summaries, and vice versa', async () => {
    const { patients, engagement, analytics } = buildStack();
    const patient = patients.register({
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
    });
    await engagement.queueMessage(patient.id, { channel: 'SMS', kind: 'REMINDER', body: 'Your appointment is tomorrow.' });

    engagement.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(analytics.patientRegistrySummary()).resolves.toMatchObject({ totalPatients: 1 });

    engagement.health = () => Promise.resolve({ status: 'UP' });
    patients.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(analytics.engagementSummary()).resolves.toEqual({
      totalMessages: 1,
      byStatus: { QUEUED: 0, SENT: 1, FAILED: 0 },
    });
  });
});

describe('AnalyticsService.immunizationSummary', () => {
  it('counts immunization records, broken down by status', async () => {
    const { immunization, analytics } = buildStack();
    immunization.recordPatientReported({
      patientId: 'patient-1',
      vaccineName: 'Tetanus toxoid',
      doseNumber: 1,
      administeredOn: '2020-01-15',
    });

    const summary = await analytics.immunizationSummary();

    expect(summary).toEqual({ totalRecords: 1, byStatus: { ACTIVE: 1, VOIDED: 0 } });
  });

  it('refuses (503) while immunization is down, even though the other five sources are up', async () => {
    const { immunization, analytics } = buildStack();
    immunization.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(analytics.immunizationSummary()).rejects.toThrow(ServiceUnavailableException);
  });

  it('a down immunization does not block the patient or scheduling summaries, and vice versa', async () => {
    const { patients, immunization, analytics } = buildStack();
    patients.register({
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
    });
    immunization.recordPatientReported({
      patientId: 'patient-1',
      vaccineName: 'Tetanus toxoid',
      doseNumber: 1,
      administeredOn: '2020-01-15',
    });

    immunization.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(analytics.patientRegistrySummary()).resolves.toMatchObject({ totalPatients: 1 });

    immunization.health = () => Promise.resolve({ status: 'UP' });
    patients.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(analytics.immunizationSummary()).resolves.toEqual({
      totalRecords: 1,
      byStatus: { ACTIVE: 1, VOIDED: 0 },
    });
  });
});

describe('AnalyticsService.diagnosticsOrdersSummary', () => {
  it('counts diagnostic orders, broken down by status', async () => {
    const { charting, diagnosticsOrders, analytics } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    await diagnosticsOrders.orderDiagnostic(encounter.id, {
      clinicianId: 'clinician-1',
      kind: 'LAB',
      testName: 'Fasting blood glucose',
    });

    const summary = await analytics.diagnosticsOrdersSummary();

    expect(summary).toEqual({ totalOrders: 1, byStatus: { ORDERED: 1, RESULTED: 0, CANCELLED: 0 } });
  });

  it('refuses (503) while diagnostics-orders is down, even though the other six sources are up', async () => {
    const { diagnosticsOrders, analytics } = buildStack();
    diagnosticsOrders.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(analytics.diagnosticsOrdersSummary()).rejects.toThrow(ServiceUnavailableException);
  });

  it('a down diagnostics-orders does not block the patient or scheduling summaries, and vice versa', async () => {
    const { patients, charting, diagnosticsOrders, analytics } = buildStack();
    patients.register({
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
    });
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    await diagnosticsOrders.orderDiagnostic(encounter.id, {
      clinicianId: 'clinician-1',
      kind: 'LAB',
      testName: 'Fasting blood glucose',
    });

    diagnosticsOrders.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(analytics.patientRegistrySummary()).resolves.toMatchObject({ totalPatients: 1 });

    diagnosticsOrders.health = () => Promise.resolve({ status: 'UP' });
    patients.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(analytics.diagnosticsOrdersSummary()).resolves.toEqual({
      totalOrders: 1,
      byStatus: { ORDERED: 1, RESULTED: 0, CANCELLED: 0 },
    });
  });
});

describe('AnalyticsService.health', () => {
  it('reports UP', async () => {
    const { analytics } = buildStack();
    await expect(analytics.health()).resolves.toEqual({ status: 'UP' });
  });
});

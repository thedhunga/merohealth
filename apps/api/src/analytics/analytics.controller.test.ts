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
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

function buildController() {
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const scheduling = new SchedulingService(new SchedulingRepository(), patients);
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const billing = new BillingService(new BillingRepository(), charting);
  const referrals = new ReferralsService(new ReferralsRepository(), charting);
  const analytics = new AnalyticsService(patients, scheduling, billing, referrals);
  const controller = new AnalyticsController(analytics);
  return { controller, patients, scheduling, charting, billing, referrals };
}

const referralRequestInput = {
  clinicianId: 'clinician-1',
  referredToEntityId: 'demo-doctor-1',
  reason: 'Suspected renal involvement',
};

describe('AnalyticsController.patients', () => {
  it('returns the patient registry summary', async () => {
    const { controller, patients } = buildController();
    patients.register({
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
    });

    await expect(controller.patients()).resolves.toEqual({
      totalPatients: 1,
      bySex: { FEMALE: 1, MALE: 0, OTHER: 0, UNDISCLOSED: 0 },
    });
  });

  it('rejects (503) while patient-registry is down', async () => {
    const { controller, patients } = buildController();
    patients.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(controller.patients()).rejects.toThrow(ServiceUnavailableException);
  });
});

describe('AnalyticsController.scheduling', () => {
  it('returns the scheduling summary', async () => {
    const { controller, patients, scheduling } = buildController();
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

    await expect(controller.scheduling()).resolves.toEqual({
      totalAppointments: 1,
      byStatus: { SCHEDULED: 1, CANCELLED: 0 },
    });
  });

  it('rejects (503) while scheduling is down', async () => {
    const { controller, scheduling } = buildController();
    scheduling.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(controller.scheduling()).rejects.toThrow(ServiceUnavailableException);
  });
});

describe('AnalyticsController.billing', () => {
  it('returns the billing summary', async () => {
    const { controller, charting, billing } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    await billing.openInvoice(encounter.id, { clinicianId: 'clinician-1' });

    await expect(controller.billing()).resolves.toEqual({
      totalInvoices: 1,
      byStatus: { DRAFT: 1, ISSUED: 0, PAID: 0, VOID: 0 },
    });
  });

  it('rejects (503) while billing is down', async () => {
    const { controller, billing } = buildController();
    billing.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(controller.billing()).rejects.toThrow(ServiceUnavailableException);
  });
});

describe('AnalyticsController.referrals', () => {
  it('returns the referrals summary', async () => {
    const { controller, charting, referrals } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    await referrals.requestReferral(encounter.id, referralRequestInput);

    await expect(controller.referrals()).resolves.toEqual({
      totalReferrals: 1,
      byStatus: { REQUESTED: 1, ACCEPTED: 0, DECLINED: 0, CANCELLED: 0, COMPLETED: 0 },
    });
  });

  it('rejects (503) while referrals is down', async () => {
    const { controller, referrals } = buildController();
    referrals.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(controller.referrals()).rejects.toThrow(ServiceUnavailableException);
  });
});

describe('AnalyticsController.health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});

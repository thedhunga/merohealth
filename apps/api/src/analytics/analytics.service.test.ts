import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { SchedulingRepository } from '../scheduling/scheduling.repository.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { AnalyticsService } from './analytics.service.js';

function buildStack() {
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const scheduling = new SchedulingService(new SchedulingRepository(), patients);
  const analytics = new AnalyticsService(patients, scheduling);
  return { patients, scheduling, analytics };
}

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

describe('AnalyticsService.health', () => {
  it('reports UP', async () => {
    const { analytics } = buildStack();
    await expect(analytics.health()).resolves.toEqual({ status: 'UP' });
  });
});

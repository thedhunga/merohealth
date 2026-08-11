import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { SchedulingRepository } from '../scheduling/scheduling.repository.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

function buildController() {
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const scheduling = new SchedulingService(new SchedulingRepository(), patients);
  const analytics = new AnalyticsService(patients, scheduling);
  const controller = new AnalyticsController(analytics);
  return { controller, patients, scheduling };
}

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

describe('AnalyticsController.health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});

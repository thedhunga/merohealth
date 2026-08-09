import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { SchedulingController } from './scheduling.controller.js';
import { SchedulingRepository } from './scheduling.repository.js';
import { SchedulingService } from './scheduling.service.js';

const validDemographics = {
  displayName: 'Sita Rai',
  dateOfBirth: '1990-04-12',
  sex: 'FEMALE' as const,
  phone: '9800000000',
  preferredLocale: 'ne' as const,
};

function buildController() {
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const controller = new SchedulingController(new SchedulingService(new SchedulingRepository(), patients));
  return { controller, patients };
}

const validBody = (patientId: string) => ({
  patientId,
  clinicianId: 'clinician-1',
  scheduledStart: '2026-08-10T09:00:00.000Z',
  scheduledEnd: '2026-08-10T09:30:00.000Z',
});

describe('SchedulingController.schedule', () => {
  it('schedules an appointment from a valid body', async () => {
    const { controller, patients } = buildController();
    const patient = patients.register(validDemographics);

    const appointment = await controller.schedule(validBody(patient.id));
    expect(appointment.status).toBe('SCHEDULED');
  });

  it('rejects a request missing a required field', () => {
    const { controller, patients } = buildController();
    const patient = patients.register(validDemographics);

    expect(() => controller.schedule({ ...validBody(patient.id), clinicianId: undefined })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a scheduledStart that is not an ISO 8601 UTC instant', () => {
    const { controller, patients } = buildController();
    const patient = patients.register(validDemographics);

    expect(() => controller.schedule({ ...validBody(patient.id), scheduledStart: '10-08-2026 09:00' })).toThrow(
      BadRequestException,
    );
  });

  it('404s scheduling against an unknown patient', async () => {
    const { controller } = buildController();
    await expect(controller.schedule(validBody('missing'))).rejects.toThrow(NotFoundException);
  });
});

describe('SchedulingController read and cancel', () => {
  it('reads back a scheduled appointment', async () => {
    const { controller, patients } = buildController();
    const patient = patients.register(validDemographics);
    const appointment = await controller.schedule(validBody(patient.id));

    expect(controller.get(appointment.id).id).toBe(appointment.id);
  });

  it('404s a read for an unknown appointment', () => {
    const { controller } = buildController();
    expect(() => controller.get('missing')).toThrow(NotFoundException);
  });

  it('cancels a scheduled appointment', async () => {
    const { controller, patients } = buildController();
    const patient = patients.register(validDemographics);
    const appointment = await controller.schedule(validBody(patient.id));

    const cancelled = await controller.cancel(appointment.id);
    expect(cancelled.status).toBe('CANCELLED');
  });
});

describe('SchedulingController.health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});

describe('SchedulingController degraded mode', () => {
  it('refuses to schedule or cancel while patient-registry is unavailable, but still reads', async () => {
    const { controller, patients } = buildController();
    const patient = patients.register(validDemographics);
    const appointment = await controller.schedule(validBody(patient.id));

    patients.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(controller.schedule(validBody(patient.id))).rejects.toThrow(ServiceUnavailableException);
    await expect(controller.cancel(appointment.id)).rejects.toThrow(ServiceUnavailableException);
    expect(controller.get(appointment.id).id).toBe(appointment.id);
  });
});

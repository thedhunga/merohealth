import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AppointmentAlreadyCancelledError, InvalidAppointmentWindowError } from '@swasthya/scheduling';
import { describe, expect, it } from 'vitest';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { SchedulingRepository } from './scheduling.repository.js';
import { SchedulingService } from './scheduling.service.js';

const patientDemographics = {
  displayName: 'Sita Rai',
  dateOfBirth: '1990-04-12',
  sex: 'FEMALE' as const,
  phone: '9800000000',
  preferredLocale: 'ne' as const,
};

function buildScheduling() {
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const scheduling = new SchedulingService(new SchedulingRepository(), patients);
  return { scheduling, patients };
}

const appointmentInput = (patientId: string) => ({
  patientId,
  clinicianId: 'clinician-1',
  scheduledStart: '2026-08-10T09:00:00.000Z',
  scheduledEnd: '2026-08-10T09:30:00.000Z',
});

describe('SchedulingService.schedule', () => {
  it('schedules an appointment for a registered patient', async () => {
    const { scheduling, patients } = buildScheduling();
    const patient = patients.register(patientDemographics);

    const appointment = await scheduling.schedule(appointmentInput(patient.id));

    expect(appointment.patientId).toBe(patient.id);
    expect(appointment.status).toBe('SCHEDULED');
  });

  it('404s scheduling against a patient id patient-registry has never seen', async () => {
    const { scheduling } = buildScheduling();
    await expect(scheduling.schedule(appointmentInput('missing'))).rejects.toThrow(NotFoundException);
  });

  it('propagates a domain rejection, e.g. an end time before the start, unwrapped', async () => {
    const { scheduling, patients } = buildScheduling();
    const patient = patients.register(patientDemographics);

    await expect(
      scheduling.schedule({ ...appointmentInput(patient.id), scheduledEnd: '2026-08-10T08:00:00.000Z' }),
    ).rejects.toThrow(InvalidAppointmentWindowError);
  });

  it('refuses to schedule while patient-registry is unavailable', async () => {
    const { scheduling, patients } = buildScheduling();
    const patient = patients.register(patientDemographics);
    patients.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(scheduling.schedule(appointmentInput(patient.id))).rejects.toThrow(ServiceUnavailableException);
  });
});

describe('SchedulingService.get and cancel', () => {
  it('reads back a scheduled appointment', async () => {
    const { scheduling, patients } = buildScheduling();
    const patient = patients.register(patientDemographics);
    const appointment = await scheduling.schedule(appointmentInput(patient.id));

    expect(scheduling.get(appointment.id).id).toBe(appointment.id);
  });

  it('404s reading an unknown appointment', () => {
    const { scheduling } = buildScheduling();
    expect(() => scheduling.get('missing')).toThrow(NotFoundException);
  });

  it('reads continue to work while patient-registry is unavailable — READ_ONLY serves persisted data', async () => {
    const { scheduling, patients } = buildScheduling();
    const patient = patients.register(patientDemographics);
    const appointment = await scheduling.schedule(appointmentInput(patient.id));

    patients.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    expect(scheduling.get(appointment.id).id).toBe(appointment.id);
    expect(scheduling.list().map((a) => a.id)).toContain(appointment.id);
  });

  it('cancels a scheduled appointment', async () => {
    const { scheduling, patients } = buildScheduling();
    const patient = patients.register(patientDemographics);
    const appointment = await scheduling.schedule(appointmentInput(patient.id));

    const cancelled = await scheduling.cancel(appointment.id);
    expect(cancelled.status).toBe('CANCELLED');
  });

  it('rejects cancelling an already-cancelled appointment', async () => {
    const { scheduling, patients } = buildScheduling();
    const patient = patients.register(patientDemographics);
    const appointment = await scheduling.schedule(appointmentInput(patient.id));
    await scheduling.cancel(appointment.id);

    await expect(scheduling.cancel(appointment.id)).rejects.toThrow(AppointmentAlreadyCancelledError);
  });

  it('refuses to cancel while patient-registry is unavailable, even though cancel never looks a patient up', async () => {
    const { scheduling, patients } = buildScheduling();
    const patient = patients.register(patientDemographics);
    const appointment = await scheduling.schedule(appointmentInput(patient.id));

    patients.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(scheduling.cancel(appointment.id)).rejects.toThrow(ServiceUnavailableException);
  });

  it('reports UP with no failure mode of its own', async () => {
    const { scheduling } = buildScheduling();
    await expect(scheduling.health()).resolves.toEqual({ status: 'UP' });
  });
});

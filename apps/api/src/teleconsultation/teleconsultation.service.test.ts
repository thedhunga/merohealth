import { ServiceUnavailableException } from '@nestjs/common';
import { TeleconsultationSessionNotActiveError } from '@swasthya/teleconsultation';
import { describe, expect, it } from 'vitest';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { SchedulingRepository } from '../scheduling/scheduling.repository.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { TeleconsultationRepository } from './teleconsultation.repository.js';
import { TeleconsultationService } from './teleconsultation.service.js';

const validDemographics = {
  displayName: 'Sita Rai',
  dateOfBirth: '1990-04-12',
  sex: 'FEMALE' as const,
  phone: '9800000000',
  preferredLocale: 'ne' as const,
};

function buildStack() {
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const scheduling = new SchedulingService(new SchedulingRepository(), patients);
  const teleconsultation = new TeleconsultationService(new TeleconsultationRepository(), scheduling);
  return { patients, scheduling, teleconsultation };
}

async function bookAppointment(scheduling: SchedulingService, patientId: string) {
  return scheduling.schedule({
    patientId,
    clinicianId: 'clinician-1',
    scheduledStart: '2026-08-10T09:00:00.000Z',
    scheduledEnd: '2026-08-10T09:30:00.000Z',
  });
}

describe('TeleconsultationService.scheduleSession', () => {
  it('books a SCHEDULED session against an appointment, deriving patientId and clinicianId from it', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);

    const session = await teleconsultation.scheduleSession(appointment.id);

    expect(session.status).toBe('SCHEDULED');
    expect(session.patientId).toBe(patient.id);
    expect(session.clinicianId).toBe('clinician-1');
    expect(session.appointmentId).toBe(appointment.id);
    expect(session.connectionMode).toBe('MOCK');
  });

  it('refuses to book a session while scheduling is down', async () => {
    const { scheduling, teleconsultation } = buildStack();
    scheduling.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(teleconsultation.scheduleSession('appt-1')).rejects.toThrow(ServiceUnavailableException);
  });
});

describe('TeleconsultationService.startSession, completeSession and getSession', () => {
  it('starts, completes, then reads the session back', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await teleconsultation.scheduleSession(appointment.id);

    const started = teleconsultation.startSession(session.id);
    expect(started.status).toBe('ACTIVE');

    const completed = teleconsultation.completeSession(session.id);
    expect(completed.status).toBe('COMPLETED');
    expect(teleconsultation.getSession(session.id).status).toBe('COMPLETED');
  });

  it('starting and completing a session never touches scheduling — still works while it is down', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await teleconsultation.scheduleSession(appointment.id);
    scheduling.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    const started = teleconsultation.startSession(session.id);
    expect(started.status).toBe('ACTIVE');
  });

  it('propagates the domain error refusing to complete a session that was never started', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await teleconsultation.scheduleSession(appointment.id);

    expect(() => teleconsultation.completeSession(session.id)).toThrow(TeleconsultationSessionNotActiveError);
  });
});

describe('TeleconsultationService.cancelSession and markNoShow', () => {
  it('cancels a SCHEDULED session', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await teleconsultation.scheduleSession(appointment.id);

    const cancelled = teleconsultation.cancelSession(session.id, 'Patient rescheduled');

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelReason).toBe('Patient rescheduled');
  });

  it('marks a SCHEDULED session no-show', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await teleconsultation.scheduleSession(appointment.id);

    const noShow = teleconsultation.markNoShow(session.id);

    expect(noShow.status).toBe('NO_SHOW');
  });
});

describe('TeleconsultationService.listSessions', () => {
  it('lists sessions filtered by patientId', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await teleconsultation.scheduleSession(appointment.id);

    expect(teleconsultation.listSessions(patient.id)).toEqual([session]);
    expect(teleconsultation.listSessions('someone-else')).toEqual([]);
  });
});

describe('TeleconsultationService.health', () => {
  it('reports UP with no failure mode of its own', async () => {
    const { teleconsultation } = buildStack();
    await expect(teleconsultation.health()).resolves.toEqual({ status: 'UP' });
  });
});

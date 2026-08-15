import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
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

  it('refuses a second session for an appointment that already has one SCHEDULED, as a 400 with a code, not an uncaught 500', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    await teleconsultation.scheduleSession(appointment.id);

    await expect(teleconsultation.scheduleSession(appointment.id)).rejects.toThrow(BadRequestException);
    try {
      await teleconsultation.scheduleSession(appointment.id);
      expect.unreachable('expected scheduleSession to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'TeleconsultationSessionAlreadyBookedError',
      });
    }
  });

  it('allows rebooking an appointment whose only prior session was cancelled', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const first = await teleconsultation.scheduleSession(appointment.id);
    teleconsultation.cancelSession(first.id, patient.id, 'Patient rescheduled');

    const second = await teleconsultation.scheduleSession(appointment.id);
    expect(second.status).toBe('SCHEDULED');
  });
});

describe('TeleconsultationService.startSession, completeSession and getSession', () => {
  it('starts, completes, then reads the session back', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await teleconsultation.scheduleSession(appointment.id);

    const started = teleconsultation.startSession(session.id, patient.id);
    expect(started.status).toBe('ACTIVE');

    const completed = teleconsultation.completeSession(session.id, patient.id);
    expect(completed.status).toBe('COMPLETED');
    expect(teleconsultation.getSession(session.id, patient.id).status).toBe('COMPLETED');
  });

  it('starting and completing a session never touches scheduling — still works while it is down', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await teleconsultation.scheduleSession(appointment.id);
    scheduling.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    const started = teleconsultation.startSession(session.id, patient.id);
    expect(started.status).toBe('ACTIVE');
  });

  it('refuses to complete a session that was never started, as a 400 with a code, not an uncaught 500', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await teleconsultation.scheduleSession(appointment.id);

    expect(() => teleconsultation.completeSession(session.id, patient.id)).toThrow(BadRequestException);
    try {
      teleconsultation.completeSession(session.id, patient.id);
      expect.unreachable('expected completeSession to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'TeleconsultationSessionNotActiveError',
      });
    }
  });

  it('refuses to start a session that has already started, as a 400 with a code', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await teleconsultation.scheduleSession(appointment.id);
    teleconsultation.startSession(session.id, patient.id);

    try {
      teleconsultation.startSession(session.id, patient.id);
      expect.unreachable('expected startSession to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'TeleconsultationSessionNotScheduledError',
      });
    }
  });
});

describe('TeleconsultationService.cancelSession and markNoShow', () => {
  it('cancels a SCHEDULED session', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await teleconsultation.scheduleSession(appointment.id);

    const cancelled = teleconsultation.cancelSession(session.id, patient.id, 'Patient rescheduled');

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelReason).toBe('Patient rescheduled');
  });

  it('marks a SCHEDULED session no-show', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await teleconsultation.scheduleSession(appointment.id);

    const noShow = teleconsultation.markNoShow(session.id, patient.id);

    expect(noShow.status).toBe('NO_SHOW');
  });

  it('refuses to cancel an already-cancelled session, as a 400 with a code, not an uncaught 500', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await teleconsultation.scheduleSession(appointment.id);
    teleconsultation.cancelSession(session.id, patient.id, 'Patient rescheduled');

    try {
      teleconsultation.cancelSession(session.id, patient.id, 'Patient rescheduled again');
      expect.unreachable('expected cancelSession to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'TeleconsultationSessionAlreadyCancelledError',
      });
    }
  });

  it('refuses to cancel a session that has already started, distinguishing it from an already-cancelled one', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await teleconsultation.scheduleSession(appointment.id);
    teleconsultation.startSession(session.id, patient.id);

    try {
      teleconsultation.cancelSession(session.id, patient.id, 'Too late');
      expect.unreachable('expected cancelSession to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'TeleconsultationSessionNotScheduledError',
      });
    }
  });

  it('refuses to mark a started session no-show, as a 400 with a code', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await teleconsultation.scheduleSession(appointment.id);
    teleconsultation.startSession(session.id, patient.id);

    try {
      teleconsultation.markNoShow(session.id, patient.id);
      expect.unreachable('expected markNoShow to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'TeleconsultationSessionNotScheduledError',
      });
    }
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

// The gap a fresh survey found live: every route below `schedule` trusted a
// bare session id with no ownership check at all, so any caller who knew or
// guessed a session id — belonging to any patient in the system — could read,
// start, complete, cancel or no-show it. `getSession` is now the only path
// that resolves a session, and it 404s a real id that belongs to someone
// else exactly like `RecordsService.#requireObservation` already does for an
// observation id.
describe('TeleconsultationService cross-owner access', () => {
  it('404s getSession for a real session id when ownerId does not match', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await teleconsultation.scheduleSession(appointment.id);

    expect(() => teleconsultation.getSession(session.id, 'someone-else')).toThrow(NotFoundException);
  });

  it('404s startSession/completeSession/cancelSession/markNoShow for a session owned by someone else', async () => {
    const { patients, scheduling, teleconsultation } = buildStack();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await teleconsultation.scheduleSession(appointment.id);

    expect(() => teleconsultation.startSession(session.id, 'someone-else')).toThrow(NotFoundException);
    expect(() => teleconsultation.completeSession(session.id, 'someone-else')).toThrow(NotFoundException);
    expect(() => teleconsultation.cancelSession(session.id, 'someone-else', 'not mine')).toThrow(NotFoundException);
    expect(() => teleconsultation.markNoShow(session.id, 'someone-else')).toThrow(NotFoundException);
  });
});

describe('TeleconsultationService.health', () => {
  it('reports UP with no failure mode of its own', async () => {
    const { teleconsultation } = buildStack();
    await expect(teleconsultation.health()).resolves.toEqual({ status: 'UP' });
  });
});

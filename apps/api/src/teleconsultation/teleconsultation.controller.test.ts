import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { EntitlementsGuard } from '../entitlements/entitlements.guard.js';
import { REQUIRED_MODULE_KEY } from '../entitlements/require-entitlement.decorator.js';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { SchedulingRepository } from '../scheduling/scheduling.repository.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { TeleconsultationController } from './teleconsultation.controller.js';
import { TeleconsultationRepository } from './teleconsultation.repository.js';
import { TeleconsultationService } from './teleconsultation.service.js';

const validDemographics = {
  displayName: 'Sita Rai',
  dateOfBirth: '1990-04-12',
  sex: 'FEMALE' as const,
  phone: '9800000000',
  preferredLocale: 'ne' as const,
};

function buildController() {
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const scheduling = new SchedulingService(new SchedulingRepository(), patients);
  const teleconsultation = new TeleconsultationService(new TeleconsultationRepository(), scheduling);
  const controller = new TeleconsultationController(teleconsultation);
  return { controller, patients, scheduling };
}

function currentUserFor(subjectId: string): CurrentUserResult {
  return {
    subjectId,
    user: { id: subjectId, phone: '9800000000', role: 'PATIENT', locale: 'ne', assuranceLevel: 'REGISTERED' },
    patientProfileId: null,
    assuranceLevel: 'REGISTERED',
  };
}

async function bookAppointment(scheduling: SchedulingService, patientId: string) {
  return scheduling.schedule({
    patientId,
    clinicianId: 'clinician-1',
    scheduledStart: '2026-08-10T09:00:00.000Z',
    scheduledEnd: '2026-08-10T09:30:00.000Z',
  });
}

// Nest's own `@UseGuards` metadata key. Not part of `@nestjs/common`'s
// public exports (only `constants.ts` internally, which NodeNext module
// resolution can't reach as a subpath import here), so this mirrors the
// literal Nest itself defines rather than importing it.
const GUARDS_METADATA = '__guards__';

// Cast away the class-method typing so `@typescript-eslint/unbound-method`
// doesn't flag these as unsafe `this`-losing references — every use below
// only reads Reflect-metadata off the function object, never calls it.
const controllerProto = TeleconsultationController.prototype as unknown as Record<string, () => unknown>;

function guardsFor(method: string): unknown {
  return Reflect.getMetadata(GUARDS_METADATA, controllerProto[method]!);
}

describe('TeleconsultationController entitlement wiring', () => {
  const reflector = new Reflector();

  it('gates schedule behind SessionAuthGuard, EntitlementsGuard and the TELECONSULTATION module', () => {
    expect(guardsFor('schedule')).toEqual([SessionAuthGuard, EntitlementsGuard]);
    expect(reflector.get<string | undefined>(REQUIRED_MODULE_KEY, controllerProto['schedule']!)).toBe(
      'TELECONSULTATION',
    );
  });

  // A previous version of this suite locked in the opposite of this: every
  // route below was ungated, reasoning by a misreading of RecordsController's
  // precedent (only `capture` there carries `EntitlementsGuard` — but every
  // read/mutate route on it, including `list`/`confirm`/`correct`/`reject`,
  // still carries `SessionAuthGuard`). That let any unauthenticated caller
  // list or read every patient's teleconsultation sessions system-wide, and
  // cancel or mark no-show on a session that was not theirs.
  it('gates every read and mutation route behind SessionAuthGuard', () => {
    const gated = ['listSessions', 'getSession', 'start', 'complete', 'cancel', 'noShow'];
    for (const method of gated) {
      expect(guardsFor(method)).toEqual([SessionAuthGuard]);
    }
  });

  it('leaves only the health check ungated', () => {
    expect(guardsFor('health')).toBeUndefined();
  });
});

describe('TeleconsultationController.schedule', () => {
  it('books a session against an appointment', async () => {
    const { controller, patients, scheduling } = buildController();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);

    const session = await controller.schedule(appointment.id);

    expect(session.status).toBe('SCHEDULED');
  });
});

describe('TeleconsultationController start, complete, cancel and no-show endpoints', () => {
  it('starts and completes a session, reading it back', async () => {
    const { controller, patients, scheduling } = buildController();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await controller.schedule(appointment.id);
    const user = currentUserFor(patient.id);

    const started = controller.start(user, session.id);
    expect(started.status).toBe('ACTIVE');

    const completed = controller.complete(user, session.id);
    expect(completed.status).toBe('COMPLETED');
    expect(controller.getSession(user, session.id).status).toBe('COMPLETED');
  });

  it('rejects a cancel body missing reason', async () => {
    const { controller, patients, scheduling } = buildController();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await controller.schedule(appointment.id);
    const user = currentUserFor(patient.id);

    expect(() => controller.cancel(user, session.id, {})).toThrow(BadRequestException);
  });

  it('cancels a SCHEDULED session', async () => {
    const { controller, patients, scheduling } = buildController();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await controller.schedule(appointment.id);
    const user = currentUserFor(patient.id);

    const cancelled = controller.cancel(user, session.id, { reason: 'Patient rescheduled' });

    expect(cancelled.status).toBe('CANCELLED');
  });

  it('marks a SCHEDULED session no-show', async () => {
    const { controller, patients, scheduling } = buildController();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await controller.schedule(appointment.id);
    const user = currentUserFor(patient.id);

    const noShow = controller.noShow(user, session.id);

    expect(noShow.status).toBe('NO_SHOW');
  });
});

describe('TeleconsultationController.listSessions and getSession', () => {
  it("lists only the signed-in caller's own sessions and reads one by id", async () => {
    const { controller, patients, scheduling } = buildController();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await controller.schedule(appointment.id);
    const user = currentUserFor(patient.id);

    const listed = controller.listSessions(user);
    expect(listed).toEqual({ sessions: [session], total: 1 });
    expect(controller.getSession(user, session.id)).toEqual(session);
  });

  it("404s a real session id that belongs to a different caller, on every read and mutation route", async () => {
    const { controller, patients, scheduling } = buildController();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await controller.schedule(appointment.id);
    const stranger = currentUserFor('someone-else');

    expect(controller.listSessions(stranger)).toEqual({ sessions: [], total: 0 });
    expect(() => controller.getSession(stranger, session.id)).toThrow(NotFoundException);
    expect(() => controller.start(stranger, session.id)).toThrow(NotFoundException);
    expect(() => controller.complete(stranger, session.id)).toThrow(NotFoundException);
    expect(() => controller.cancel(stranger, session.id, { reason: 'not mine to cancel' })).toThrow(
      NotFoundException,
    );
    expect(() => controller.noShow(stranger, session.id)).toThrow(NotFoundException);
  });
});

describe('TeleconsultationController.health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});

import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
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

  // Booking is the one action that starts something new; reading or
  // transitioning a session that already exists follows RecordsController's
  // precedent of staying open, so this locks that boundary in rather than
  // letting a future run gate everything "for consistency".
  it('leaves every other route ungated', () => {
    const ungatedMethods = ['health', 'listSessions', 'getSession', 'start', 'complete', 'cancel', 'noShow'];
    for (const method of ungatedMethods) {
      expect(guardsFor(method)).toBeUndefined();
    }
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

    const started = controller.start(session.id);
    expect(started.status).toBe('ACTIVE');

    const completed = controller.complete(session.id);
    expect(completed.status).toBe('COMPLETED');
    expect(controller.getSession(session.id).status).toBe('COMPLETED');
  });

  it('rejects a cancel body missing reason', async () => {
    const { controller, patients, scheduling } = buildController();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await controller.schedule(appointment.id);

    expect(() => controller.cancel(session.id, {})).toThrow(BadRequestException);
  });

  it('cancels a SCHEDULED session', async () => {
    const { controller, patients, scheduling } = buildController();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await controller.schedule(appointment.id);

    const cancelled = controller.cancel(session.id, { reason: 'Patient rescheduled' });

    expect(cancelled.status).toBe('CANCELLED');
  });

  it('marks a SCHEDULED session no-show', async () => {
    const { controller, patients, scheduling } = buildController();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await controller.schedule(appointment.id);

    const noShow = controller.noShow(session.id);

    expect(noShow.status).toBe('NO_SHOW');
  });
});

describe('TeleconsultationController.listSessions and getSession', () => {
  it('lists sessions filtered by patientId and reads one by id', async () => {
    const { controller, patients, scheduling } = buildController();
    const patient = patients.register(validDemographics);
    const appointment = await bookAppointment(scheduling, patient.id);
    const session = await controller.schedule(appointment.id);

    const listed = controller.listSessions(patient.id);
    expect(listed).toEqual({ sessions: [session], total: 1 });
    expect(controller.getSession(session.id)).toEqual(session);
  });
});

describe('TeleconsultationController.health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});

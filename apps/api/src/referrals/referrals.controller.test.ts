import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { ReferralsController } from './referrals.controller.js';
import { ReferralsRepository } from './referrals.repository.js';
import { ReferralsService } from './referrals.service.js';

function buildController() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const referrals = new ReferralsService(new ReferralsRepository(), charting);
  const controller = new ReferralsController(referrals);
  return { controller, charting };
}

// Same pattern `immunization.controller.test.ts` uses: Nest's own
// `@UseGuards` metadata key, since a plain method call (every other test in
// this file) bypasses Nest's guard pipeline entirely.
const GUARDS_METADATA = '__guards__';
const controllerProto = ReferralsController.prototype as unknown as Record<string, () => unknown>;
function guardsFor(method: string): unknown {
  return Reflect.getMetadata(GUARDS_METADATA, controllerProto[method]!);
}

const currentUser: CurrentUserResult = {
  subjectId: 'patient-1',
  user: { id: 'patient-1', phone: '9812345678', role: 'PATIENT', locale: 'ne', assuranceLevel: 'REGISTERED' },
  patientProfileId: null,
  assuranceLevel: 'REGISTERED',
};
const otherUser: CurrentUserResult = { ...currentUser, subjectId: 'patient-2' };

const requestBody = { clinicianId: 'clinician-1', referredToEntityId: 'demo-doctor-1', reason: 'Suspected renal involvement' };

describe('ReferralsController auth wiring', () => {
  it('gates the patient-facing routes behind SessionAuthGuard', () => {
    expect(guardsFor('listReferrals')).toEqual([SessionAuthGuard]);
    expect(guardsFor('getReferral')).toEqual([SessionAuthGuard]);
  });

  it('leaves health and the clinician-workflow routes ungated', () => {
    // health: no auth concept at all. requestReferral/acceptReferral/
    // declineReferral/completeReferral/cancelReferral: no clinician-side
    // session exists yet — same documented exception
    // `clinical-charting.controller.ts` and `immunization.controller.ts`'s
    // `recordClinicianAdministered`/`voidRecord` carry.
    expect(guardsFor('health')).toBeUndefined();
    expect(guardsFor('requestReferral')).toBeUndefined();
    expect(guardsFor('acceptReferral')).toBeUndefined();
    expect(guardsFor('declineReferral')).toBeUndefined();
    expect(guardsFor('completeReferral')).toBeUndefined();
    expect(guardsFor('cancelReferral')).toBeUndefined();
  });
});

describe('ReferralsController.requestReferral', () => {
  it('requests a referral against an encounter', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    const referral = await controller.requestReferral(encounter.id, requestBody);

    expect(referral.status).toBe('REQUESTED');
  });

  it('rejects a request with no reason', () => {
    const { controller } = buildController();
    expect(() =>
      controller.requestReferral('enc-1', { clinicianId: 'clinician-1', referredToEntityId: 'demo-doctor-1' }),
    ).toThrow(BadRequestException);
  });
});

describe('ReferralsController.acceptReferral, declineReferral, completeReferral and cancelReferral', () => {
  it('accepts, then completes a referral', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const referral = await controller.requestReferral(encounter.id, requestBody);

    const accepted = controller.acceptReferral(referral.id);
    expect(accepted.status).toBe('ACCEPTED');

    const completed = controller.completeReferral(referral.id);
    expect(completed.status).toBe('COMPLETED');
    expect(controller.getReferral(currentUser, referral.id).status).toBe('COMPLETED');
  });

  it('declines a referral', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const referral = await controller.requestReferral(encounter.id, requestBody);

    const declined = controller.declineReferral(referral.id, { reason: 'Outside our specialty' });
    expect(declined.status).toBe('DECLINED');
  });

  it('rejects a decline request missing a reason', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const referral = await controller.requestReferral(encounter.id, requestBody);

    expect(() => controller.declineReferral(referral.id, {})).toThrow(BadRequestException);
  });

  it('cancels a referral', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const referral = await controller.requestReferral(encounter.id, requestBody);

    const cancelled = controller.cancelReferral(referral.id, { reason: 'Patient chose a different provider' });
    expect(cancelled.status).toBe('CANCELLED');
  });
});

describe('ReferralsController.listReferrals and getReferral', () => {
  it("lists the signed-in caller's own referrals and reads one by id", async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const referral = await controller.requestReferral(encounter.id, requestBody);

    const listed = controller.listReferrals(currentUser);
    expect(listed).toEqual({ referrals: [referral], total: 1 });
    expect(controller.getReferral(currentUser, referral.id)).toEqual(referral);
  });

  it("404s a read for another caller's referral instead of returning it", async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const referral = await controller.requestReferral(encounter.id, requestBody);

    expect(() => controller.getReferral(otherUser, referral.id)).toThrow(NotFoundException);
    expect(controller.listReferrals(otherUser).total).toBe(0);
  });
});

describe('ReferralsController.health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});

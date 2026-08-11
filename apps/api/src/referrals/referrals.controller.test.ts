import { BadRequestException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
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

const requestBody = { clinicianId: 'clinician-1', referredToEntityId: 'demo-doctor-1', reason: 'Suspected renal involvement' };

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
    expect(controller.getReferral(referral.id).status).toBe('COMPLETED');
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
  it('lists referrals filtered by patientId and reads one by id', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const referral = await controller.requestReferral(encounter.id, requestBody);

    const listed = controller.listReferrals('patient-1');
    expect(listed).toEqual({ referrals: [referral], total: 1 });
    expect(controller.getReferral(referral.id)).toEqual(referral);
  });
});

describe('ReferralsController.health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});

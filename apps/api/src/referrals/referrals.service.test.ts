import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ReferralNotAcceptedError, ReferralNotRequestedError } from '@swasthya/referrals';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { ReferralsRepository } from './referrals.repository.js';
import { ReferralsService } from './referrals.service.js';

function buildStack() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const referrals = new ReferralsService(new ReferralsRepository(), charting);
  return { charting, referrals };
}

const requestInput = { clinicianId: 'clinician-1', referredToEntityId: 'demo-doctor-1', reason: 'Suspected renal involvement' };

describe('ReferralsService.requestReferral', () => {
  it('requests a referral against an encounter, deriving patientId from it', async () => {
    const { charting, referrals } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    const referral = await referrals.requestReferral(encounter.id, requestInput);

    expect(referral.status).toBe('REQUESTED');
    expect(referral.patientId).toBe('patient-1');
    expect(referral.encounterId).toBe(encounter.id);
    expect(referral.referredToEntityId).toBe('demo-doctor-1');
  });

  it('refuses to request a referral while clinical-charting is down', async () => {
    const { charting, referrals } = buildStack();
    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(referrals.requestReferral('enc-1', requestInput)).rejects.toThrow(ServiceUnavailableException);
  });

  it('refuses a referredToEntityId no care-directory entity holds', async () => {
    const { charting, referrals } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    await expect(
      referrals.requestReferral(encounter.id, { ...requestInput, referredToEntityId: 'not-a-real-entity' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ReferralsService.acceptReferral, declineReferral, completeReferral and cancelReferral', () => {
  it('accepts a requested referral, then completes it', async () => {
    const { charting, referrals } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const referral = await referrals.requestReferral(encounter.id, requestInput);

    const accepted = referrals.acceptReferral(referral.id);
    expect(accepted.status).toBe('ACCEPTED');

    const completed = referrals.completeReferral(referral.id);
    expect(completed.status).toBe('COMPLETED');
    expect(referrals.getReferral(referral.id).status).toBe('COMPLETED');
  });

  it('declines a requested referral', async () => {
    const { charting, referrals } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const referral = await referrals.requestReferral(encounter.id, requestInput);

    const declined = referrals.declineReferral(referral.id, 'Outside our specialty');
    expect(declined.status).toBe('DECLINED');
    expect(declined.declineReason).toBe('Outside our specialty');
  });

  it('cancels a requested referral', async () => {
    const { charting, referrals } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const referral = await referrals.requestReferral(encounter.id, requestInput);

    const cancelled = referrals.cancelReferral(referral.id, 'Patient chose a different provider');
    expect(cancelled.status).toBe('CANCELLED');
  });

  it('accepting, declining, completing and cancelling never touch clinical-charting — still work while it is down', async () => {
    const { charting, referrals } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const referral = await referrals.requestReferral(encounter.id, requestInput);
    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    const accepted = referrals.acceptReferral(referral.id);
    expect(accepted.status).toBe('ACCEPTED');

    const completed = referrals.completeReferral(referral.id);
    expect(completed.status).toBe('COMPLETED');
  });

  it('propagates the domain error refusing completion of a referral that was never accepted', async () => {
    const { charting, referrals } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const referral = await referrals.requestReferral(encounter.id, requestInput);

    expect(() => referrals.completeReferral(referral.id)).toThrow(ReferralNotAcceptedError);
  });

  it('propagates the domain error refusing to cancel an already-accepted referral', async () => {
    const { charting, referrals } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const referral = await referrals.requestReferral(encounter.id, requestInput);
    referrals.acceptReferral(referral.id);

    expect(() => referrals.cancelReferral(referral.id, 'Changed my mind')).toThrow(ReferralNotRequestedError);
  });
});

describe('ReferralsService.listReferrals', () => {
  it('lists referrals filtered by patientId', async () => {
    const { charting, referrals } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const referral = await referrals.requestReferral(encounter.id, requestInput);

    expect(referrals.listReferrals('patient-1')).toEqual([referral]);
    expect(referrals.listReferrals('patient-2')).toEqual([]);
  });
});

describe('ReferralsService.health', () => {
  it('reports UP with no failure mode of its own', async () => {
    const { referrals } = buildStack();
    await expect(referrals.health()).resolves.toEqual({ status: 'UP' });
  });
});

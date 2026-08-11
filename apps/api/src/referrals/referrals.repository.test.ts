import { describe, expect, it } from 'vitest';
import { ReferralsRepository } from './referrals.repository.js';

const base = {
  status: 'REQUESTED' as const,
  referredToEntityId: 'demo-doctor-1',
  reason: 'Suspected renal involvement',
  acceptedAt: null,
  declinedAt: null,
  declineReason: null,
  cancelledAt: null,
  cancelReason: null,
  completedAt: null,
  createdAt: '2026-08-11T00:00:00.000Z',
  updatedAt: '2026-08-11T00:00:00.000Z',
  version: 1,
};

describe('ReferralsRepository', () => {
  it('starts empty', () => {
    expect(new ReferralsRepository().list()).toEqual([]);
  });

  it('finds a saved referral by id and returns null for an unknown one', () => {
    const repository = new ReferralsRepository();
    const referral = { ...base, id: 'ref-1', patientId: 'patient-1', clinicianId: 'clinician-1', encounterId: 'enc-1' };

    repository.save(referral);

    expect(repository.find('ref-1')).toEqual(referral);
    expect(repository.find('missing')).toBeNull();
  });

  it('lists only the requested patient when patientId is given', () => {
    const repository = new ReferralsRepository();
    repository.save({ ...base, id: 'ref-1', patientId: 'patient-1', clinicianId: 'clinician-1', encounterId: 'enc-1' });
    repository.save({ ...base, id: 'ref-2', patientId: 'patient-2', clinicianId: 'clinician-1', encounterId: 'enc-2' });

    expect(repository.list('patient-1').map((referral) => referral.id)).toEqual(['ref-1']);
  });
});

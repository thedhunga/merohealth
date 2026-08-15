import type { Referral } from '@swasthya/shared-types';
import { describe, expect, it } from 'vitest';
import {
  acceptReferral,
  cancelReferral,
  completeReferral,
  declineReferral,
  ReferralAlreadyCancelledError,
  ReferralNotAcceptedError,
  ReferralNotRequestedError,
  requestReferral,
} from './index.js';

const input = { clinicianId: 'clinician-1', referredToEntityId: 'demo-doctor-1', reason: 'Suspected renal involvement' };

function makeRequested(): Referral {
  return requestReferral('ref-1', 'patient-1', 'enc-1', input, '2026-08-11T00:00:00.000Z');
}

describe('requestReferral', () => {
  it('builds a REQUESTED referral at version 1 with no response recorded yet', () => {
    const referral = makeRequested();

    expect(referral).toEqual({
      id: 'ref-1',
      patientId: 'patient-1',
      clinicianId: 'clinician-1',
      encounterId: 'enc-1',
      referredToEntityId: 'demo-doctor-1',
      reason: 'Suspected renal involvement',
      status: 'REQUESTED',
      acceptedAt: null,
      declinedAt: null,
      declineReason: null,
      cancelledAt: null,
      cancelReason: null,
      completedAt: null,
      createdAt: '2026-08-11T00:00:00.000Z',
      updatedAt: '2026-08-11T00:00:00.000Z',
      version: 1,
    });
  });
});

describe('acceptReferral', () => {
  it('accepts a requested referral and records when', () => {
    const accepted = acceptReferral(makeRequested(), '2026-08-11T00:05:00.000Z');

    expect(accepted.status).toBe('ACCEPTED');
    expect(accepted.acceptedAt).toBe('2026-08-11T00:05:00.000Z');
    expect(accepted.version).toBe(2);
  });

  it('refuses to accept an already-accepted referral', () => {
    const accepted = acceptReferral(makeRequested(), '2026-08-11T00:05:00.000Z');

    expect(() => acceptReferral(accepted, '2026-08-11T00:10:00.000Z')).toThrow(ReferralNotRequestedError);
  });
});

describe('declineReferral', () => {
  it('declines a requested referral and records the reason', () => {
    const declined = declineReferral(makeRequested(), 'Outside our specialty', '2026-08-11T00:05:00.000Z');

    expect(declined.status).toBe('DECLINED');
    expect(declined.declinedAt).toBe('2026-08-11T00:05:00.000Z');
    expect(declined.declineReason).toBe('Outside our specialty');
    expect(declined.version).toBe(2);
  });

  it('refuses to decline an already-accepted referral', () => {
    const accepted = acceptReferral(makeRequested(), '2026-08-11T00:05:00.000Z');

    expect(() => declineReferral(accepted, 'Too late', '2026-08-11T00:10:00.000Z')).toThrow(ReferralNotRequestedError);
  });
});

describe('completeReferral', () => {
  it('completes an accepted referral and records when', () => {
    const accepted = acceptReferral(makeRequested(), '2026-08-11T00:05:00.000Z');

    const completed = completeReferral(accepted, '2026-08-11T00:15:00.000Z');

    expect(completed.status).toBe('COMPLETED');
    expect(completed.completedAt).toBe('2026-08-11T00:15:00.000Z');
    expect(completed.version).toBe(3);
  });

  it('refuses to complete a referral that was never accepted', () => {
    expect(() => completeReferral(makeRequested(), '2026-08-11T00:15:00.000Z')).toThrow(ReferralNotAcceptedError);
  });

  it('refuses to complete a declined referral', () => {
    const declined = declineReferral(makeRequested(), 'Outside our specialty', '2026-08-11T00:05:00.000Z');

    expect(() => completeReferral(declined, '2026-08-11T00:15:00.000Z')).toThrow(ReferralNotAcceptedError);
  });
});

describe('cancelReferral', () => {
  it('cancels a requested referral and records the reason', () => {
    const cancelled = cancelReferral(makeRequested(), 'Patient chose a different provider', '2026-08-11T00:05:00.000Z');

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledAt).toBe('2026-08-11T00:05:00.000Z');
    expect(cancelled.cancelReason).toBe('Patient chose a different provider');
    expect(cancelled.version).toBe(2);
  });

  it('refuses to cancel an already-cancelled referral', () => {
    const cancelled = cancelReferral(makeRequested(), 'Patient chose a different provider', '2026-08-11T00:05:00.000Z');

    expect(() => cancelReferral(cancelled, 'Again', '2026-08-11T00:10:00.000Z')).toThrow(ReferralAlreadyCancelledError);
  });

  it('refuses to cancel an already-accepted referral — an agreement reached outside this system should not be misrepresented', () => {
    const accepted = acceptReferral(makeRequested(), '2026-08-11T00:05:00.000Z');

    expect(() => cancelReferral(accepted, 'Changed my mind', '2026-08-11T00:10:00.000Z')).toThrow(
      ReferralNotRequestedError,
    );
  });
});

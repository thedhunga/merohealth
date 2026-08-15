import { describe, expect, it } from 'vitest';
import type { CredentialingApplication } from '@swasthya/shared-types';

import {
  ApplicationNotApprovedError,
  ApplicationTransitionError,
  approveApplication,
  badgeRenderStatus,
  beginReview,
  canTransitionApplication,
  councilRegistry,
  isBadgeCurrent,
  isKnownCouncil,
  issueBadge,
  recheckBadge,
  rejectApplication,
  reviewQueue,
  submitApplication,
} from './index';

function makeApplication(overrides: Partial<CredentialingApplication> = {}): CredentialingApplication {
  return {
    id: 'app-1',
    applicantId: 'clinician-1',
    council: 'NMC',
    registrationNumber: '',
    status: 'NOT_STARTED',
    certificateImageRef: null,
    identityImageRef: null,
    submittedAt: null,
    rejectionReason: null,
    reviewerId: null,
    decidedAt: null,
    ...overrides,
  };
}

describe('council registry', () => {
  it('covers all five councils identity-and-credentialing.md §3 names', () => {
    expect(Object.keys(councilRegistry).toSorted()).toEqual(
      ['AYURVEDIC_COUNCIL', 'NHPC', 'NMC', 'NNC', 'PHARMACY_COUNCIL'].toSorted(),
    );
  });

  it('isKnownCouncil rejects a key not in the registry', () => {
    expect(isKnownCouncil('NMC')).toBe(true);
    expect(isKnownCouncil('WHO')).toBe(false);
  });
});

describe('application state machine', () => {
  it('walks NOT_STARTED through to APPROVED', () => {
    let application = makeApplication();
    application = submitApplication(
      application,
      'NMC',
      'NMC-12345',
      'cert-ref-1',
      'id-ref-1',
      '2026-08-01T00:00:00.000Z',
    );
    expect(application.status).toBe('EVIDENCE_SUBMITTED');

    application = beginReview(application);
    expect(application.status).toBe('UNDER_REVIEW');

    application = approveApplication(application, 'reviewer-1', '2026-08-02T00:00:00.000Z');
    expect(application.status).toBe('APPROVED');
    expect(application.reviewerId).toBe('reviewer-1');
    expect(application.decidedAt).toBe('2026-08-02T00:00:00.000Z');
  });

  it('rejects an out-of-order transition rather than allowing a skip to UNDER_REVIEW', () => {
    const application = makeApplication();
    expect(() => beginReview(application)).toThrow(ApplicationTransitionError);
    expect(canTransitionApplication('NOT_STARTED', 'UNDER_REVIEW')).toBe(false);
  });

  it('never allows a jump straight from EVIDENCE_SUBMITTED to APPROVED', () => {
    expect(canTransitionApplication('EVIDENCE_SUBMITTED', 'APPROVED')).toBe(false);
  });

  it('allows resubmission after a rejection, but not after an approval', () => {
    expect(canTransitionApplication('REJECTED', 'EVIDENCE_SUBMITTED')).toBe(true);
    expect(canTransitionApplication('APPROVED', 'EVIDENCE_SUBMITTED')).toBe(false);
  });

  it('a resubmission clears the prior rejection reason and decision', () => {
    const rejected = makeApplication({
      status: 'REJECTED',
      council: 'NNC',
      registrationNumber: 'NNC-999',
      rejectionReason: 'Certificate photo was blurred',
      reviewerId: 'reviewer-1',
      decidedAt: '2026-08-01T00:00:00.000Z',
    });

    const resubmitted = submitApplication(
      rejected,
      'NNC',
      'NNC-999',
      'cert-ref-2',
      'id-ref-2',
      '2026-08-03T00:00:00.000Z',
    );

    expect(resubmitted.status).toBe('EVIDENCE_SUBMITTED');
    expect(resubmitted.rejectionReason).toBeNull();
    expect(resubmitted.reviewerId).toBeNull();
    expect(resubmitted.decidedAt).toBeNull();
    expect(resubmitted.certificateImageRef).toBe('cert-ref-2');
  });

  it('rejectApplication requires a concrete reason and records the reviewer', () => {
    const underReview = makeApplication({
      status: 'UNDER_REVIEW',
      certificateImageRef: 'cert-ref-1',
      identityImageRef: 'id-ref-1',
    });

    const rejected = rejectApplication(underReview, 'reviewer-2', 'Registration number does not match the certificate', '2026-08-02T00:00:00.000Z');

    expect(rejected.status).toBe('REJECTED');
    expect(rejected.reviewerId).toBe('reviewer-2');
    expect(rejected.rejectionReason).toBe('Registration number does not match the certificate');
  });
});

describe('evidence lifecycle', () => {
  it('deletes both evidence images the moment approval is recorded', () => {
    const underReview = makeApplication({
      status: 'UNDER_REVIEW',
      certificateImageRef: 'cert-ref-1',
      identityImageRef: 'id-ref-1',
    });

    const approved = approveApplication(underReview, 'reviewer-1', '2026-08-02T00:00:00.000Z');

    expect(approved.certificateImageRef).toBeNull();
    expect(approved.identityImageRef).toBeNull();
  });

  it('deletes both evidence images on rejection too, not only on approval', () => {
    const underReview = makeApplication({
      status: 'UNDER_REVIEW',
      certificateImageRef: 'cert-ref-1',
      identityImageRef: 'id-ref-1',
    });

    const rejected = rejectApplication(underReview, 'reviewer-1', 'Council registration lapsed', '2026-08-02T00:00:00.000Z');

    expect(rejected.certificateImageRef).toBeNull();
    expect(rejected.identityImageRef).toBeNull();
  });

  it('cannot record a decision without first entering review', () => {
    const submitted = makeApplication({ status: 'EVIDENCE_SUBMITTED', certificateImageRef: 'cert-ref-1' });
    expect(() => approveApplication(submitted, 'reviewer-1', '2026-08-02T00:00:00.000Z')).toThrow(
      ApplicationTransitionError,
    );
  });
});

describe('review queue', () => {
  it('orders by submission time, oldest first, and excludes decided applications', () => {
    const applications: CredentialingApplication[] = [
      makeApplication({ id: 'app-later', status: 'EVIDENCE_SUBMITTED', submittedAt: '2026-08-03T00:00:00.000Z' }),
      makeApplication({ id: 'app-earlier', status: 'UNDER_REVIEW', submittedAt: '2026-08-01T00:00:00.000Z' }),
      makeApplication({ id: 'app-not-started', status: 'NOT_STARTED', submittedAt: null }),
      makeApplication({
        id: 'app-approved',
        status: 'APPROVED',
        submittedAt: '2026-07-01T00:00:00.000Z',
        reviewerId: 'reviewer-1',
        decidedAt: '2026-07-02T00:00:00.000Z',
      }),
    ];

    expect(reviewQueue(applications).map((application) => application.id)).toEqual(['app-earlier', 'app-later']);
  });
});

describe('badge rules', () => {
  it('issues a badge only from an APPROVED application, carrying the reviewer forward', () => {
    const approved = makeApplication({
      council: 'PHARMACY_COUNCIL',
      registrationNumber: 'PC-4321',
      status: 'APPROVED',
      reviewerId: 'reviewer-3',
      decidedAt: '2026-08-02T00:00:00.000Z',
    });

    const badge = issueBadge(approved, '2027-08-02T00:00:00.000Z');

    expect(badge).toEqual({
      council: 'PHARMACY_COUNCIL',
      registrationNumber: 'PC-4321',
      reviewerId: 'reviewer-3',
      verifiedAt: '2026-08-02T00:00:00.000Z',
      lastCheckedAt: '2026-08-02T00:00:00.000Z',
      recheckDueAt: '2027-08-02T00:00:00.000Z',
    });
  });

  it('refuses to issue a badge for anything short of an APPROVED, reviewed decision', () => {
    expect(() => issueBadge(makeApplication({ status: 'UNDER_REVIEW' }), '2027-01-01T00:00:00.000Z')).toThrow(
      ApplicationNotApprovedError,
    );
    expect(() =>
      issueBadge(makeApplication({ status: 'APPROVED', decidedAt: '2026-08-02T00:00:00.000Z' }), '2027-01-01T00:00:00.000Z'),
    ).toThrow(ApplicationNotApprovedError);
  });

  it('a badge is current before its recheck date and stale after', () => {
    const badge = issueBadge(
      makeApplication({ status: 'APPROVED', reviewerId: 'reviewer-1', decidedAt: '2026-08-02T00:00:00.000Z' }),
      '2027-08-02T00:00:00.000Z',
    );

    expect(isBadgeCurrent(badge, '2027-01-01T00:00:00.000Z')).toBe(true);
    expect(isBadgeCurrent(badge, '2027-09-01T00:00:00.000Z')).toBe(false);
  });

  it('compares recheckDueAt by parsed instant, not string order, across differing fractional-second precision', () => {
    const badge = issueBadge(
      makeApplication({ status: 'APPROVED', reviewerId: 'reviewer-1', decidedAt: '2026-08-02T00:00:00.000Z' }),
      '2027-08-02T00:00:00.9Z',
    );

    // '2027-08-02T00:00:00.950Z' < '2027-08-02T00:00:00.9Z' as strings, even
    // though 950ms is chronologically 50ms after recheckDueAt's 900ms — a raw
    // `<` would report this already-stale badge as still current.
    expect(isBadgeCurrent(badge, '2027-08-02T00:00:00.950Z')).toBe(false);
  });

  it('badgeRenderStatus degrades to UNVERIFIED past the recheck date rather than staying VERIFIED', () => {
    const badge = issueBadge(
      makeApplication({ status: 'APPROVED', reviewerId: 'reviewer-1', decidedAt: '2026-08-02T00:00:00.000Z' }),
      '2027-08-02T00:00:00.000Z',
    );

    expect(badgeRenderStatus(badge, '2027-01-01T00:00:00.000Z')).toBe('VERIFIED');
    expect(badgeRenderStatus(badge, '2027-09-01T00:00:00.000Z')).toBe('UNVERIFIED');
  });

  it('recheckBadge renews lastCheckedAt and recheckDueAt without disturbing verifiedAt', () => {
    const badge = issueBadge(
      makeApplication({ status: 'APPROVED', reviewerId: 'reviewer-1', decidedAt: '2026-08-02T00:00:00.000Z' }),
      '2027-08-02T00:00:00.000Z',
    );

    const rechecked = recheckBadge(badge, '2027-08-01T00:00:00.000Z', '2028-08-01T00:00:00.000Z');

    expect(rechecked.verifiedAt).toBe('2026-08-02T00:00:00.000Z');
    expect(rechecked.lastCheckedAt).toBe('2027-08-01T00:00:00.000Z');
    expect(rechecked.recheckDueAt).toBe('2028-08-01T00:00:00.000Z');
  });
});

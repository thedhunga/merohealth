import { describe, expect, it } from 'vitest';
import type { VerificationRequest } from '@swasthya/shared-types';

import {
  AssuranceTransitionError,
  VerificationTransitionError,
  approveVerification,
  beginReview,
  canReachAssurance,
  canTransitionVerification,
  meetsAssurance,
  meetsAssuranceForModule,
  minimumAssuranceLevel,
  raiseAssurance,
  rejectVerification,
  submitEvidence,
} from './index';

function makeRequest(overrides: Partial<VerificationRequest> = {}): VerificationRequest {
  return {
    id: 'ver-1',
    ownerId: 'user-1',
    status: 'NOT_STARTED',
    documentType: null,
    evidenceImageRef: null,
    rejectionReason: null,
    submittedAt: null,
    decidedAt: null,
    ...overrides,
  };
}

describe('assurance ladder', () => {
  it('allows only the next rung, never a skip', () => {
    expect(canReachAssurance('ANONYMOUS', 'REGISTERED')).toBe(true);
    expect(canReachAssurance('REGISTERED', 'IDENTITY_VERIFIED')).toBe(true);
    expect(canReachAssurance('ANONYMOUS', 'IDENTITY_VERIFIED')).toBe(false);
  });

  it('has no transitions out of IDENTITY_VERIFIED, including back down', () => {
    expect(canReachAssurance('IDENTITY_VERIFIED', 'REGISTERED')).toBe(false);
    expect(canReachAssurance('IDENTITY_VERIFIED', 'ANONYMOUS')).toBe(false);
  });

  it('raiseAssurance returns the target level on a legal move', () => {
    expect(raiseAssurance('ANONYMOUS', 'REGISTERED')).toBe('REGISTERED');
  });

  it('raiseAssurance throws rather than silently clamping an illegal jump', () => {
    expect(() => raiseAssurance('ANONYMOUS', 'IDENTITY_VERIFIED')).toThrow(AssuranceTransitionError);
  });

  it('meetsAssurance treats the ladder as ordered, not just equal', () => {
    expect(meetsAssurance('IDENTITY_VERIFIED', 'REGISTERED')).toBe(true);
    expect(meetsAssurance('REGISTERED', 'IDENTITY_VERIFIED')).toBe(false);
    expect(meetsAssurance('ANONYMOUS', 'ANONYMOUS')).toBe(true);
  });
});

describe('minimumAssuranceLevel', () => {
  it('matches the anonymous-reachable modules named in the architecture doc', () => {
    expect(minimumAssuranceLevel.ASSISTANT).toBe('ANONYMOUS');
    expect(minimumAssuranceLevel.CARE_DIRECTORY).toBe('ANONYMOUS');
  });

  it('requires IDENTITY_VERIFIED only for sharing, export and teleconsultation', () => {
    expect(minimumAssuranceLevel.RECORD_SHARING).toBe('IDENTITY_VERIFIED');
    expect(minimumAssuranceLevel.PROVIDER_EXPORT).toBe('IDENTITY_VERIFIED');
    expect(minimumAssuranceLevel.TELECONSULTATION).toBe('IDENTITY_VERIFIED');
  });

  it('defaults every other module to REGISTERED, never leaving one at ANONYMOUS by omission', () => {
    const anonymous: readonly string[] = ['ASSISTANT', 'CARE_DIRECTORY'];
    const identityVerified: readonly string[] = ['RECORD_SHARING', 'PROVIDER_EXPORT', 'TELECONSULTATION'];
    for (const [module, level] of Object.entries(minimumAssuranceLevel)) {
      if (anonymous.includes(module) || identityVerified.includes(module)) continue;
      expect(level).toBe('REGISTERED');
    }
  });

  it('meetsAssuranceForModule gates HEALTH_RECORD for an anonymous visitor', () => {
    expect(meetsAssuranceForModule('ANONYMOUS', 'HEALTH_RECORD')).toBe(false);
    expect(meetsAssuranceForModule('REGISTERED', 'HEALTH_RECORD')).toBe(true);
  });

  it('meetsAssuranceForModule gates RECORD_SHARING for a merely-registered person', () => {
    expect(meetsAssuranceForModule('REGISTERED', 'RECORD_SHARING')).toBe(false);
    expect(meetsAssuranceForModule('IDENTITY_VERIFIED', 'RECORD_SHARING')).toBe(true);
  });
});

describe('verification state machine', () => {
  it('walks NOT_STARTED through to APPROVED', () => {
    let request = makeRequest();
    request = submitEvidence(request, 'NATIONAL_ID', 'evidence-ref-1', '2026-08-01T00:00:00.000Z');
    expect(request.status).toBe('EVIDENCE_SUBMITTED');

    request = beginReview(request);
    expect(request.status).toBe('UNDER_REVIEW');

    request = approveVerification(request, '2026-08-02T00:00:00.000Z');
    expect(request.status).toBe('APPROVED');
    expect(request.decidedAt).toBe('2026-08-02T00:00:00.000Z');
  });

  it('rejects an out-of-order transition rather than allowing a skip to UNDER_REVIEW', () => {
    const request = makeRequest();
    expect(() => beginReview(request)).toThrow(VerificationTransitionError);
    expect(canTransitionVerification('NOT_STARTED', 'UNDER_REVIEW')).toBe(false);
  });

  it('allows resubmission after a rejection, but not after an approval', () => {
    expect(canTransitionVerification('REJECTED', 'EVIDENCE_SUBMITTED')).toBe(true);
    expect(canTransitionVerification('APPROVED', 'EVIDENCE_SUBMITTED')).toBe(false);
  });

  it('a resubmission clears the prior rejection reason and decision timestamp', () => {
    const rejected = makeRequest({
      status: 'REJECTED',
      documentType: 'CITIZENSHIP',
      rejectionReason: 'Certificate photo was blurred',
      decidedAt: '2026-08-01T00:00:00.000Z',
    });

    const resubmitted = submitEvidence(rejected, 'CITIZENSHIP', 'evidence-ref-2', '2026-08-03T00:00:00.000Z');

    expect(resubmitted.status).toBe('EVIDENCE_SUBMITTED');
    expect(resubmitted.rejectionReason).toBeNull();
    expect(resubmitted.decidedAt).toBeNull();
    expect(resubmitted.evidenceImageRef).toBe('evidence-ref-2');
  });
});

describe('evidence lifecycle', () => {
  it('deletes the evidence image reference the moment approval is recorded', () => {
    const underReview = makeRequest({
      status: 'UNDER_REVIEW',
      documentType: 'NATIONAL_ID',
      evidenceImageRef: 'evidence-ref-1',
      submittedAt: '2026-08-01T00:00:00.000Z',
    });

    const approved = approveVerification(underReview, '2026-08-02T00:00:00.000Z');

    expect(approved.evidenceImageRef).toBeNull();
  });

  it('deletes the evidence image reference on rejection too, not only on approval', () => {
    const underReview = makeRequest({
      status: 'UNDER_REVIEW',
      documentType: 'NATIONAL_ID',
      evidenceImageRef: 'evidence-ref-1',
      submittedAt: '2026-08-01T00:00:00.000Z',
    });

    const rejected = rejectVerification(underReview, 'Number does not match document', '2026-08-02T00:00:00.000Z');

    expect(rejected.evidenceImageRef).toBeNull();
    expect(rejected.rejectionReason).toBe('Number does not match document');
  });

  it('cannot record a decision without first entering review', () => {
    const submitted = makeRequest({ status: 'EVIDENCE_SUBMITTED', evidenceImageRef: 'evidence-ref-1' });
    expect(() => approveVerification(submitted, '2026-08-02T00:00:00.000Z')).toThrow(VerificationTransitionError);
  });
});

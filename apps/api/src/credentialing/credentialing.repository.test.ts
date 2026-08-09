import { describe, expect, it } from 'vitest';
import type { CredentialingApplication } from '@swasthya/shared-types';
import { CredentialingRepository } from './credentialing.repository.js';

function makeApplication(overrides: Partial<CredentialingApplication> = {}): CredentialingApplication {
  return {
    id: 'app-1',
    applicantId: 'applicant-1',
    council: 'NMC',
    registrationNumber: '12345',
    status: 'EVIDENCE_SUBMITTED',
    certificateImageRef: 'ref:certificate',
    identityImageRef: 'ref:identity',
    submittedAt: '2026-08-01T00:00:00.000Z',
    rejectionReason: null,
    reviewerId: null,
    decidedAt: null,
    ...overrides,
  };
}

describe('CredentialingRepository', () => {
  it('round-trips a saved application by id', () => {
    const repository = new CredentialingRepository();
    repository.save(makeApplication());

    expect(repository.find('app-1')?.registrationNumber).toBe('12345');
    expect(repository.find('missing')).toBeNull();
  });

  it('overwrites rather than duplicates on a second save with the same id', () => {
    const repository = new CredentialingRepository();
    repository.save(makeApplication({ status: 'EVIDENCE_SUBMITTED' }));
    repository.save(makeApplication({ status: 'UNDER_REVIEW' }));

    expect(repository.list()).toHaveLength(1);
    expect(repository.find('app-1')?.status).toBe('UNDER_REVIEW');
  });

  it('finds the one application in flight for an applicant', () => {
    const repository = new CredentialingRepository();
    repository.save(makeApplication({ id: 'app-1', applicantId: 'applicant-1' }));
    repository.save(makeApplication({ id: 'app-2', applicantId: 'applicant-2' }));

    expect(repository.findByApplicant('applicant-1')?.id).toBe('app-1');
    expect(repository.findByApplicant('unknown')).toBeNull();
  });

  it('scopes audit entries to the requested application and orders them oldest first', () => {
    const repository = new CredentialingRepository();
    repository.appendAuditEntry({
      id: 'audit-2',
      applicationId: 'app-1',
      actorId: 'reviewer-1',
      actorRole: 'CLINICAL_REVIEWER',
      action: 'REVIEW_STARTED',
      occurredAt: '2026-08-02T00:00:00.000Z',
    });
    repository.appendAuditEntry({
      id: 'audit-1',
      applicationId: 'app-1',
      actorId: 'reviewer-1',
      actorRole: 'CLINICAL_REVIEWER',
      action: 'EVIDENCE_READ',
      occurredAt: '2026-08-01T00:00:00.000Z',
    });
    repository.appendAuditEntry({
      id: 'audit-3',
      applicationId: 'app-2',
      actorId: 'reviewer-2',
      actorRole: 'CLINICAL_REVIEWER',
      action: 'EVIDENCE_READ',
      occurredAt: '2026-08-01T00:00:00.000Z',
    });

    expect(repository.listAuditEntries('app-1').map((entry) => entry.id)).toEqual(['audit-1', 'audit-2']);
  });
});

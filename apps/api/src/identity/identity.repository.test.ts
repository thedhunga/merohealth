import { describe, expect, it } from 'vitest';
import type { VerificationRequest } from '@swasthya/shared-types';
import { IdentityRepository } from './identity.repository.js';

function makeRequest(overrides: Partial<VerificationRequest> = {}): VerificationRequest {
  return {
    id: 'ver-1',
    ownerId: 'owner-1',
    status: 'EVIDENCE_SUBMITTED',
    documentType: 'NATIONAL_ID',
    evidenceImageRef: 'ref:evidence',
    submittedAt: '2026-08-01T00:00:00.000Z',
    rejectionReason: null,
    decidedAt: null,
    ...overrides,
  };
}

describe('IdentityRepository', () => {
  it('round-trips a saved request by id', () => {
    const repository = new IdentityRepository();
    repository.save(makeRequest());

    expect(repository.find('ver-1')?.ownerId).toBe('owner-1');
    expect(repository.find('missing')).toBeNull();
  });

  it('overwrites rather than duplicates on a second save with the same id', () => {
    const repository = new IdentityRepository();
    repository.save(makeRequest({ status: 'EVIDENCE_SUBMITTED' }));
    repository.save(makeRequest({ status: 'UNDER_REVIEW' }));

    expect(repository.list()).toHaveLength(1);
    expect(repository.find('ver-1')?.status).toBe('UNDER_REVIEW');
  });

  it('finds the one request in flight for an owner', () => {
    const repository = new IdentityRepository();
    repository.save(makeRequest({ id: 'ver-1', ownerId: 'owner-1' }));
    repository.save(makeRequest({ id: 'ver-2', ownerId: 'owner-2' }));

    expect(repository.findByOwner('owner-1')?.id).toBe('ver-1');
    expect(repository.findByOwner('unknown')).toBeNull();
  });

  it('scopes audit entries to the requested verification and orders them oldest first', () => {
    const repository = new IdentityRepository();
    repository.appendAuditEntry({
      id: 'audit-2',
      verificationId: 'ver-1',
      actorId: 'reviewer-1',
      actorRole: 'IDENTITY_REVIEWER',
      action: 'REVIEW_STARTED',
      occurredAt: '2026-08-02T00:00:00.000Z',
    });
    repository.appendAuditEntry({
      id: 'audit-1',
      verificationId: 'ver-1',
      actorId: 'reviewer-1',
      actorRole: 'IDENTITY_REVIEWER',
      action: 'EVIDENCE_READ',
      occurredAt: '2026-08-01T00:00:00.000Z',
    });
    repository.appendAuditEntry({
      id: 'audit-3',
      verificationId: 'ver-2',
      actorId: 'reviewer-2',
      actorRole: 'IDENTITY_REVIEWER',
      action: 'EVIDENCE_READ',
      occurredAt: '2026-08-01T00:00:00.000Z',
    });

    expect(repository.listAuditEntries('ver-1').map((entry) => entry.id)).toEqual(['audit-1', 'audit-2']);
  });
});

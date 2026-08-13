import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { InMemoryAuthStore } from '../auth/in-memory-auth.store.js';
import { IdentityRepository } from './identity.repository.js';
import { IdentityService } from './identity.service.js';

const validSubmission = {
  ownerId: 'owner-1',
  documentType: 'NATIONAL_ID' as const,
  evidenceImageRef: 'ref:evidence',
};

async function buildService() {
  const authStore = new InMemoryAuthStore();
  const owner = await authStore.createPatientUser({ phone: '9812345678', locale: 'ne' });
  return { service: new IdentityService(new IdentityRepository(), authStore), authStore, owner };
}

describe('IdentityService submission', () => {
  it('submits a fresh request landing EVIDENCE_SUBMITTED', async () => {
    const { service } = await buildService();
    const request = service.submit(validSubmission);

    expect(request.status).toBe('EVIDENCE_SUBMITTED');
    expect(request.documentType).toBe('NATIONAL_ID');
  });

  it('refuses a second submission from the same owner while the first is still pending, as a 400 with a code', async () => {
    const { service } = await buildService();
    service.submit(validSubmission);

    expect(() => service.submit({ ...validSubmission, evidenceImageRef: 'ref:another' })).toThrow(
      BadRequestException,
    );
    try {
      service.submit({ ...validSubmission, evidenceImageRef: 'ref:another' });
      expect.unreachable('expected submit to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'VerificationTransitionError' });
    }
  });
});

describe('IdentityService reviewer actions', () => {
  it('lists only submitted/under-review requests on the queue', async () => {
    const { service } = await buildService();
    service.submit(validSubmission);
    service.submit({ ...validSubmission, ownerId: 'owner-2' });

    expect(service.queue()).toHaveLength(2);
  });

  it('logs an EVIDENCE_READ entry, attributed to the reviewer, when a request is opened', async () => {
    const { service } = await buildService();
    const request = service.submit(validSubmission);

    service.read(request.id, 'reviewer-1');

    const log = service.auditLog(request.id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: 'EVIDENCE_READ', actorId: 'reviewer-1', actorRole: 'IDENTITY_REVIEWER' });
  });

  it('walks a request through to APPROVED and raises the owner to IDENTITY_VERIFIED', async () => {
    const { service, authStore, owner } = await buildService();
    const request = service.submit({ ...validSubmission, ownerId: owner.id });

    service.beginReview(request.id, 'reviewer-1');
    const approved = await service.approve(request.id, 'reviewer-1');

    expect(approved.status).toBe('APPROVED');
    expect(approved.evidenceImageRef).toBeNull();

    const stored = await authStore.findUserById(owner.id);
    expect(stored?.assuranceLevel).toBe('IDENTITY_VERIFIED');

    const actions = service.auditLog(request.id).map((entry) => entry.action);
    expect(actions).toEqual(['REVIEW_STARTED', 'VERIFICATION_APPROVED']);
  });

  it('rejects with a reason and clears the evidence ref, without touching assurance', async () => {
    const { service, authStore, owner } = await buildService();
    const request = service.submit({ ...validSubmission, ownerId: owner.id });
    service.beginReview(request.id, 'reviewer-1');

    const rejected = service.reject(request.id, 'reviewer-1', 'Photograph is blurred');

    expect(rejected.status).toBe('REJECTED');
    expect(rejected.rejectionReason).toBe('Photograph is blurred');
    expect(rejected.evidenceImageRef).toBeNull();

    const stored = await authStore.findUserById(owner.id);
    expect(stored?.assuranceLevel).toBe('REGISTERED');
  });

  it('supports resubmission after rejection, and a fresh review cycle to approval', async () => {
    const { service, authStore, owner } = await buildService();
    const request = service.submit({ ...validSubmission, ownerId: owner.id });
    service.beginReview(request.id, 'reviewer-1');
    service.reject(request.id, 'reviewer-1', 'Photograph is blurred');

    const resubmitted = service.submit({ ...validSubmission, ownerId: owner.id });
    expect(resubmitted.status).toBe('EVIDENCE_SUBMITTED');
    expect(resubmitted.rejectionReason).toBeNull();

    service.beginReview(resubmitted.id, 'reviewer-2');
    const approved = await service.approve(resubmitted.id, 'reviewer-2');
    expect(approved.status).toBe('APPROVED');

    const stored = await authStore.findUserById(owner.id);
    expect(stored?.assuranceLevel).toBe('IDENTITY_VERIFIED');
  });

  it('404s reviewer actions against an unknown request', async () => {
    const { service } = await buildService();
    expect(() => service.read('missing', 'reviewer-1')).toThrow(NotFoundException);
    expect(() => service.beginReview('missing', 'reviewer-1')).toThrow(NotFoundException);
    await expect(service.approve('missing', 'reviewer-1')).rejects.toThrow(NotFoundException);
    expect(() => service.reject('missing', 'reviewer-1', 'reason')).toThrow(NotFoundException);
    expect(() => service.auditLog('missing')).toThrow(NotFoundException);
  });
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { InMemoryAuthStore } from '../auth/in-memory-auth.store.js';
import { IdentityController } from './identity.controller.js';
import { IdentityRepository } from './identity.repository.js';
import { IdentityService } from './identity.service.js';

async function buildController() {
  const authStore = new InMemoryAuthStore();
  const owner = await authStore.createPatientUser({ phone: '9811111111', locale: 'ne' });
  const controller = new IdentityController(new IdentityService(new IdentityRepository(), authStore));
  return { controller, authStore, owner };
}

const reviewer: CurrentUserResult = {
  subjectId: 'reviewer-1',
  user: { id: 'reviewer-1', phone: '9812345678', role: 'IDENTITY_REVIEWER', locale: 'ne', assuranceLevel: 'REGISTERED' },
  patientProfileId: null,
  assuranceLevel: 'REGISTERED',
};

function applicantFor(owner: { id: string }): CurrentUserResult {
  return {
    subjectId: owner.id,
    user: { id: owner.id, phone: '9811111111', role: 'PATIENT', locale: 'ne', assuranceLevel: 'REGISTERED' },
    patientProfileId: null,
    assuranceLevel: 'REGISTERED',
  };
}

const validSubmission = { documentType: 'NATIONAL_ID', evidenceImageRef: 'ref:evidence' };

describe('IdentityController submit', () => {
  it('submits under the signed-in caller, ignoring any ownerId in the body', async () => {
    const { controller, owner } = await buildController();
    const applicant = applicantFor(owner);

    const request = controller.submit(applicant, { ...validSubmission, ownerId: 'someone-else' });

    expect(request.status).toBe('EVIDENCE_SUBMITTED');
    expect(request.ownerId).toBe(applicant.subjectId);
  });

  it('rejects a request missing a required field', async () => {
    const { controller, owner } = await buildController();
    const applicant = applicantFor(owner);

    expect(() => controller.submit(applicant, { ...validSubmission, evidenceImageRef: undefined })).toThrow(
      BadRequestException,
    );
  });

  it('rejects an unknown document type rather than silently accepting it', async () => {
    const { controller, owner } = await buildController();
    const applicant = applicantFor(owner);

    expect(() => controller.submit(applicant, { ...validSubmission, documentType: 'NOT_A_REAL_DOCUMENT' })).toThrow(
      BadRequestException,
    );
  });
});

describe('IdentityController mine', () => {
  it("reports the signed-in caller's own status, never someone else's", async () => {
    const { controller, owner } = await buildController();
    const applicant = applicantFor(owner);
    controller.submit(applicant, validSubmission);

    expect(controller.mine(applicant).status).toBe('EVIDENCE_SUBMITTED');
    expect(controller.mine(reviewer).status).toBe('NOT_STARTED');
  });
});

describe('IdentityController reviewer routes', () => {
  it('walks a request from submission through approval, raising the owner to IDENTITY_VERIFIED', async () => {
    const { controller, authStore, owner } = await buildController();
    const applicant = applicantFor(owner);
    const request = controller.submit(applicant, validSubmission);

    controller.read(reviewer, request.id);
    controller.beginReview(reviewer, request.id);
    const approved = await controller.approve(reviewer, request.id);

    expect(approved.status).toBe('APPROVED');

    const stored = await authStore.findUserById(owner.id);
    expect(stored?.assuranceLevel).toBe('IDENTITY_VERIFIED');

    const log = controller.auditLog(request.id);
    expect(log.items.map((entry) => entry.action)).toEqual(['EVIDENCE_READ', 'REVIEW_STARTED', 'VERIFICATION_APPROVED']);
  });

  it('rejects with a reason', async () => {
    const { controller, owner } = await buildController();
    const applicant = applicantFor(owner);
    const request = controller.submit(applicant, validSubmission);
    controller.beginReview(reviewer, request.id);

    const rejected = controller.reject(reviewer, request.id, { reason: 'Blurred photograph' });
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.rejectionReason).toBe('Blurred photograph');
  });

  it('rejects a reject body with no reason', async () => {
    const { controller, owner } = await buildController();
    const applicant = applicantFor(owner);
    const request = controller.submit(applicant, validSubmission);
    controller.beginReview(reviewer, request.id);

    expect(() => controller.reject(reviewer, request.id, {})).toThrow(BadRequestException);
  });

  it('404s reviewer routes for an unknown request', async () => {
    const { controller } = await buildController();
    expect(() => controller.read(reviewer, 'missing')).toThrow(NotFoundException);
    expect(() => controller.auditLog('missing')).toThrow(NotFoundException);
  });

  it('lists the queue', async () => {
    const { controller, owner } = await buildController();
    const applicant = applicantFor(owner);
    controller.submit(applicant, validSubmission);

    expect(controller.queue().total).toBe(1);
  });
});

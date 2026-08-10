import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CredentialingController } from './credentialing.controller.js';
import { CredentialingRepository } from './credentialing.repository.js';
import { CredentialingService } from './credentialing.service.js';

function buildController() {
  return new CredentialingController(new CredentialingService(new CredentialingRepository()));
}

const validSubmission = {
  applicantId: 'applicant-1',
  council: 'NMC',
  registrationNumber: 'NMC-12345',
  certificateImageRef: 'ref:certificate',
  identityImageRef: 'ref:identity',
};

describe('CredentialingController submit', () => {
  it('submits a valid application', () => {
    const controller = buildController();
    const application = controller.submit(validSubmission);

    expect(application.status).toBe('EVIDENCE_SUBMITTED');
  });

  it('rejects a request missing a required field', () => {
    const controller = buildController();
    expect(() => controller.submit({ ...validSubmission, applicantId: undefined })).toThrow(BadRequestException);
  });

  it('rejects an unknown council rather than silently accepting it', () => {
    const controller = buildController();
    expect(() => controller.submit({ ...validSubmission, council: 'NOT_A_REAL_COUNCIL' })).toThrow(
      BadRequestException,
    );
  });
});

describe('CredentialingController reviewer routes', () => {
  it('requires x-reviewer-id even though ReviewerGuard normally screens it out first', () => {
    const controller = buildController();
    const application = controller.submit(validSubmission);

    expect(() => controller.read(application.id, undefined)).toThrow(BadRequestException);
    expect(() => controller.beginReview(application.id, undefined)).toThrow(BadRequestException);
    expect(() => controller.approve(application.id, undefined)).toThrow(BadRequestException);
    expect(() => controller.reject(application.id, { reason: 'x' }, undefined)).toThrow(BadRequestException);
  });

  it('walks an application from submission through approval, attributed to the reviewer', () => {
    const controller = buildController();
    const application = controller.submit(validSubmission);

    controller.read(application.id, 'reviewer-1');
    controller.beginReview(application.id, 'reviewer-1');
    const approved = controller.approve(application.id, 'reviewer-1');

    expect(approved.status).toBe('APPROVED');
    expect(approved.reviewerId).toBe('reviewer-1');

    const log = controller.auditLog(application.id);
    expect(log.items.map((entry) => entry.action)).toEqual([
      'EVIDENCE_READ',
      'REVIEW_STARTED',
      'APPLICATION_APPROVED',
    ]);
  });

  it('rejects with a reason', () => {
    const controller = buildController();
    const application = controller.submit(validSubmission);
    controller.beginReview(application.id, 'reviewer-1');

    const rejected = controller.reject(application.id, { reason: 'Blurred certificate' }, 'reviewer-1');
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.rejectionReason).toBe('Blurred certificate');
  });

  it('rejects a reject body with no reason', () => {
    const controller = buildController();
    const application = controller.submit(validSubmission);
    controller.beginReview(application.id, 'reviewer-1');

    expect(() => controller.reject(application.id, {}, 'reviewer-1')).toThrow(BadRequestException);
  });

  it('404s reviewer routes for an unknown application', () => {
    const controller = buildController();
    expect(() => controller.read('missing', 'reviewer-1')).toThrow(NotFoundException);
    expect(() => controller.auditLog('missing')).toThrow(NotFoundException);
  });

  it('lists the queue', () => {
    const controller = buildController();
    controller.submit(validSubmission);
    controller.submit({ ...validSubmission, applicantId: 'applicant-2' });

    expect(controller.queue().total).toBe(2);
  });
});

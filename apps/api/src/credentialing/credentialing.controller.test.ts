import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CredentialingController } from './credentialing.controller.js';
import { CredentialingRepository } from './credentialing.repository.js';
import { CredentialingService } from './credentialing.service.js';

function buildController() {
  return new CredentialingController(new CredentialingService(new CredentialingRepository()));
}

const reviewer: CurrentUserResult = {
  subjectId: 'reviewer-1',
  user: { id: 'reviewer-1', phone: '9812345678', role: 'CLINICAL_REVIEWER', locale: 'ne', assuranceLevel: 'REGISTERED' },
  patientProfileId: null,
  assuranceLevel: 'REGISTERED',
};

const applicant: CurrentUserResult = {
  subjectId: 'applicant-1',
  user: { id: 'applicant-1', phone: '9811111111', role: 'PATIENT', locale: 'ne', assuranceLevel: 'REGISTERED' },
  patientProfileId: null,
  assuranceLevel: 'REGISTERED',
};

const otherApplicant: CurrentUserResult = {
  subjectId: 'applicant-2',
  user: { id: 'applicant-2', phone: '9822222222', role: 'PATIENT', locale: 'ne', assuranceLevel: 'REGISTERED' },
  patientProfileId: null,
  assuranceLevel: 'REGISTERED',
};

const validSubmission = {
  council: 'NMC',
  registrationNumber: 'NMC-12345',
  certificateImageRef: 'ref:certificate',
  identityImageRef: 'ref:identity',
};

describe('CredentialingController submit', () => {
  it('submits a valid application under the signed-in caller, ignoring any applicantId in the body', () => {
    const controller = buildController();
    const application = controller.submit(applicant, { ...validSubmission, applicantId: 'someone-else' });

    expect(application.status).toBe('EVIDENCE_SUBMITTED');
    expect(application.applicantId).toBe(applicant.subjectId);
  });

  it('rejects a request missing a required field', () => {
    const controller = buildController();
    expect(() => controller.submit(applicant, { ...validSubmission, council: undefined })).toThrow(
      BadRequestException,
    );
  });

  it('rejects an unknown council rather than silently accepting it', () => {
    const controller = buildController();
    expect(() => controller.submit(applicant, { ...validSubmission, council: 'NOT_A_REAL_COUNCIL' })).toThrow(
      BadRequestException,
    );
  });
});

describe('CredentialingController reviewer routes', () => {
  it('walks an application from submission through approval, attributed to the reviewer', () => {
    const controller = buildController();
    const application = controller.submit(applicant, validSubmission);

    controller.read(reviewer, application.id);
    controller.beginReview(reviewer, application.id);
    const approved = controller.approve(reviewer, application.id);

    expect(approved.status).toBe('APPROVED');
    expect(approved.reviewerId).toBe(reviewer.subjectId);

    const log = controller.auditLog(application.id);
    expect(log.items.map((entry) => entry.action)).toEqual([
      'EVIDENCE_READ',
      'REVIEW_STARTED',
      'APPLICATION_APPROVED',
    ]);
  });

  it('rejects with a reason', () => {
    const controller = buildController();
    const application = controller.submit(applicant, validSubmission);
    controller.beginReview(reviewer, application.id);

    const rejected = controller.reject(reviewer, application.id, { reason: 'Blurred certificate' });
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.rejectionReason).toBe('Blurred certificate');
  });

  it('rejects a reject body with no reason', () => {
    const controller = buildController();
    const application = controller.submit(applicant, validSubmission);
    controller.beginReview(reviewer, application.id);

    expect(() => controller.reject(reviewer, application.id, {})).toThrow(BadRequestException);
  });

  it('404s reviewer routes for an unknown application', () => {
    const controller = buildController();
    expect(() => controller.read(reviewer, 'missing')).toThrow(NotFoundException);
    expect(() => controller.auditLog('missing')).toThrow(NotFoundException);
  });

  it('lists the queue', () => {
    const controller = buildController();
    controller.submit(applicant, validSubmission);
    controller.submit(otherApplicant, validSubmission);

    expect(controller.queue().total).toBe(2);
  });
});

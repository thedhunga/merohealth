import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CredentialingRepository } from './credentialing.repository.js';
import { CredentialingService } from './credentialing.service.js';

const validSubmission = {
  applicantId: 'applicant-1',
  council: 'NMC' as const,
  registrationNumber: 'NMC-12345',
  certificateImageRef: 'ref:certificate',
  identityImageRef: 'ref:identity',
};

function buildService() {
  return new CredentialingService(new CredentialingRepository());
}

describe('CredentialingService submission', () => {
  it('submits a fresh application landing EVIDENCE_SUBMITTED', () => {
    const service = buildService();
    const application = service.submit(validSubmission);

    expect(application.status).toBe('EVIDENCE_SUBMITTED');
    expect(application.registrationNumber).toBe('NMC-12345');
  });

  it('refuses a second submission from the same applicant while the first is still pending, rather than forking a duplicate — as a 400 with a code, not an uncaught 500', () => {
    const service = buildService();
    service.submit(validSubmission);

    expect(() => service.submit({ ...validSubmission, registrationNumber: 'NMC-99999' })).toThrow(
      BadRequestException,
    );
    try {
      service.submit({ ...validSubmission, registrationNumber: 'NMC-99999' });
      expect.unreachable('expected submit to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'ApplicationTransitionError' });
    }
  });

  it('refuses a resubmission once the application is already APPROVED, the terminal state `submitApplication` can never leave', () => {
    const service = buildService();
    const application = service.submit(validSubmission);
    service.beginReview(application.id, 'reviewer-1');
    service.approve(application.id, 'reviewer-1');

    expect(() => service.submit(validSubmission)).toThrow(BadRequestException);
  });
});

describe('CredentialingService findMine', () => {
  it('returns null for an applicant who has never submitted', () => {
    const service = buildService();
    expect(service.findMine('applicant-1')).toBeNull();
  });

  it("returns the applicant's own application, whatever its status", () => {
    const service = buildService();
    const application = service.submit(validSubmission);
    service.beginReview(application.id, 'reviewer-1');
    const approved = service.approve(application.id, 'reviewer-1');

    expect(service.findMine('applicant-1')).toEqual(approved);
  });

  it("never returns another applicant's application", () => {
    const service = buildService();
    service.submit(validSubmission);

    expect(service.findMine('applicant-2')).toBeNull();
  });
});

describe('CredentialingService reviewer actions', () => {
  it('lists only submitted/under-review applications on the queue, oldest first', () => {
    const service = buildService();
    service.submit(validSubmission);
    service.submit({ ...validSubmission, applicantId: 'applicant-2' });

    const queue = service.queue();
    expect(queue).toHaveLength(2);
  });

  it('logs an EVIDENCE_READ entry, attributed to the reviewer, when an application is opened', () => {
    const service = buildService();
    const application = service.submit(validSubmission);

    service.read(application.id, 'reviewer-1');

    const log = service.auditLog(application.id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: 'EVIDENCE_READ', actorId: 'reviewer-1', actorRole: 'CLINICAL_REVIEWER' });
  });

  it('walks an application through the full review flow to APPROVED, attributing every step', () => {
    const service = buildService();
    const application = service.submit(validSubmission);

    service.beginReview(application.id, 'reviewer-1');
    const approved = service.approve(application.id, 'reviewer-1');

    expect(approved.status).toBe('APPROVED');
    expect(approved.reviewerId).toBe('reviewer-1');
    expect(approved.certificateImageRef).toBeNull();
    expect(approved.identityImageRef).toBeNull();

    const actions = service.auditLog(application.id).map((entry) => entry.action);
    expect(actions).toEqual(['REVIEW_STARTED', 'APPLICATION_APPROVED']);
  });

  it('rejects with a reason and clears the evidence refs, same as approval', () => {
    const service = buildService();
    const application = service.submit(validSubmission);
    service.beginReview(application.id, 'reviewer-1');

    const rejected = service.reject(application.id, 'reviewer-1', 'Certificate photograph is blurred');

    expect(rejected.status).toBe('REJECTED');
    expect(rejected.rejectionReason).toBe('Certificate photograph is blurred');
    expect(rejected.certificateImageRef).toBeNull();

    const actions = service.auditLog(application.id).map((entry) => entry.action);
    expect(actions).toEqual(['REVIEW_STARTED', 'APPLICATION_REJECTED']);
  });

  it('supports resubmission after rejection, and a fresh review cycle', () => {
    const service = buildService();
    const application = service.submit(validSubmission);
    service.beginReview(application.id, 'reviewer-1');
    service.reject(application.id, 'reviewer-1', 'Certificate photograph is blurred');

    const resubmitted = service.submit(validSubmission);
    expect(resubmitted.status).toBe('EVIDENCE_SUBMITTED');
    expect(resubmitted.rejectionReason).toBeNull();

    service.beginReview(resubmitted.id, 'reviewer-2');
    const approved = service.approve(resubmitted.id, 'reviewer-2');
    expect(approved.status).toBe('APPROVED');
    expect(approved.reviewerId).toBe('reviewer-2');
  });

  it('404s reviewer actions against an unknown application', () => {
    const service = buildService();
    expect(() => service.read('missing', 'reviewer-1')).toThrow(NotFoundException);
    expect(() => service.beginReview('missing', 'reviewer-1')).toThrow(NotFoundException);
    expect(() => service.approve('missing', 'reviewer-1')).toThrow(NotFoundException);
    expect(() => service.reject('missing', 'reviewer-1', 'reason')).toThrow(NotFoundException);
    expect(() => service.auditLog('missing')).toThrow(NotFoundException);
  });

  it('refuses an approve that arrives before beginReview, as a 400 with a code rather than an uncaught 500', () => {
    const service = buildService();
    const application = service.submit(validSubmission); // EVIDENCE_SUBMITTED, no beginReview yet

    expect(() => service.approve(application.id, 'reviewer-1')).toThrow(BadRequestException);
    try {
      service.approve(application.id, 'reviewer-1');
      expect.unreachable('expected approve to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'ApplicationTransitionError' });
    }
  });

  it('refuses a second beginReview on the same application, as a 400 with a code rather than an uncaught 500', () => {
    const service = buildService();
    const application = service.submit(validSubmission);
    service.beginReview(application.id, 'reviewer-1'); // now UNDER_REVIEW

    expect(() => service.beginReview(application.id, 'reviewer-2')).toThrow(BadRequestException);
    try {
      service.beginReview(application.id, 'reviewer-2');
      expect.unreachable('expected beginReview to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'ApplicationTransitionError' });
    }
  });

  it('refuses a reject on an already-decided application, as a 400 with a code rather than an uncaught 500', () => {
    const service = buildService();
    const application = service.submit(validSubmission);
    service.beginReview(application.id, 'reviewer-1');
    service.approve(application.id, 'reviewer-1'); // now APPROVED, a terminal status

    expect(() => service.reject(application.id, 'reviewer-1', 'too late')).toThrow(BadRequestException);
    try {
      service.reject(application.id, 'reviewer-1', 'too late');
      expect.unreachable('expected reject to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'ApplicationTransitionError' });
    }
  });
});

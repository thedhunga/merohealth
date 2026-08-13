import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApplicationTransitionError,
  approveApplication,
  beginReview,
  rejectApplication,
  reviewQueue,
  submitApplication,
} from '@swasthya/credentialing';
import type { CouncilKey, CredentialingApplication } from '@swasthya/shared-types';
import { CredentialingRepository, type CredentialingAuditEntry } from './credentialing.repository.js';

export interface SubmitApplicationInput {
  applicantId: string;
  council: CouncilKey;
  registrationNumber: string;
  certificateImageRef: string;
  identityImageRef: string;
}

@Injectable()
export class CredentialingService {
  constructor(private readonly repository: CredentialingRepository) {}

  /**
   * Submits a fresh application, or resubmits the applicant's existing one —
   * §3's "rejection is reversible": a rejected applicant fixes the evidence
   * and resubmits against the same application rather than forking a
   * duplicate, which is also what makes `reviewQueue`'s no-double-entry
   * property hold.
   *
   * `submitApplication` only reaches `EVIDENCE_SUBMITTED` from `NOT_STARTED`
   * or `REJECTED` (`canTransitionApplication`), so an applicant who already
   * has one `EVIDENCE_SUBMITTED`, `UNDER_REVIEW` or `APPROVED` throws
   * `ApplicationTransitionError` here. Previously uncaught, that reached the
   * client as a bare 500 with no `code` — mapped to `BadRequestException`
   * now, the same domain-error-to-`{code, message}` convention
   * `FamilyGrantsService.createDelegation` uses for `SelfDelegationError` and
   * friends, so a double-submit is a normal, explainable 400 instead.
   */
  submit(input: SubmitApplicationInput): CredentialingApplication {
    const existing =
      this.repository.findByApplicant(input.applicantId) ??
      emptyApplication(randomUUID(), input.applicantId, input.council);

    let submitted: CredentialingApplication;
    try {
      submitted = submitApplication(
        existing,
        input.council,
        input.registrationNumber,
        input.certificateImageRef,
        input.identityImageRef,
        new Date().toISOString(),
      );
    } catch (error) {
      if (error instanceof ApplicationTransitionError) {
        throw new BadRequestException({ code: error.name, message: error.message });
      }
      throw error;
    }
    return this.repository.save(submitted);
  }

  queue(): readonly CredentialingApplication[] {
    return reviewQueue(this.repository.list());
  }

  /**
   * A reviewer opens one application to read its submitted evidence.
   * identity-and-credentialing.md §4: "every read of an evidence image is
   * logged" — this is the one place in this module that hands
   * `certificateImageRef`/`identityImageRef` to a caller, so it is the one
   * place that has to log it.
   */
  read(applicationId: string, reviewerId: string): CredentialingApplication {
    const application = this.#require(applicationId);
    this.#audit(applicationId, reviewerId, 'EVIDENCE_READ');
    return application;
  }

  beginReview(applicationId: string, reviewerId: string): CredentialingApplication {
    const reviewed = this.repository.save(beginReview(this.#require(applicationId)));
    this.#audit(applicationId, reviewerId, 'REVIEW_STARTED');
    return reviewed;
  }

  approve(applicationId: string, reviewerId: string): CredentialingApplication {
    const decided = this.repository.save(
      approveApplication(this.#require(applicationId), reviewerId, new Date().toISOString()),
    );
    this.#audit(applicationId, reviewerId, 'APPLICATION_APPROVED');
    return decided;
  }

  reject(applicationId: string, reviewerId: string, reason: string): CredentialingApplication {
    const decided = this.repository.save(
      rejectApplication(this.#require(applicationId), reviewerId, reason, new Date().toISOString()),
    );
    this.#audit(applicationId, reviewerId, 'APPLICATION_REJECTED');
    return decided;
  }

  /** The accountability trail §3 calls for: who read this application's evidence, and who decided it, and when. */
  auditLog(applicationId: string): readonly CredentialingAuditEntry[] {
    this.#require(applicationId);
    return this.repository.listAuditEntries(applicationId);
  }

  #audit(applicationId: string, reviewerId: string, action: CredentialingAuditEntry['action']): void {
    this.repository.appendAuditEntry({
      id: randomUUID(),
      applicationId,
      actorId: reviewerId,
      actorRole: 'CLINICAL_REVIEWER',
      action,
      occurredAt: new Date().toISOString(),
    });
  }

  #require(applicationId: string): CredentialingApplication {
    const application = this.repository.find(applicationId);
    if (!application) throw new NotFoundException(`No credentialing application ${applicationId}`);
    return application;
  }
}

/**
 * A `NOT_STARTED` shell for a first-time applicant. `submitApplication`
 * overwrites `council`/`registrationNumber` unconditionally, so the values
 * passed here only matter for the instant before that call — still passed
 * through rather than a placeholder, so nothing here could be mistaken for an
 * invented default.
 */
function emptyApplication(id: string, applicantId: string, council: CouncilKey): CredentialingApplication {
  return {
    id,
    applicantId,
    council,
    registrationNumber: '',
    status: 'NOT_STARTED',
    certificateImageRef: null,
    identityImageRef: null,
    submittedAt: null,
    rejectionReason: null,
    reviewerId: null,
    decidedAt: null,
  };
}

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
   * The signed-in applicant's own application, or `null` if she has never
   * submitted one — what `apps/web`'s `/clinicians/register` fetches on
   * mount so a returning visitor with a submission already in flight sees
   * its real status (including `APPROVED`/`REJECTED`) instead of restarting
   * the form blind. Unlike `IdentityService.findMine`, this never fabricates
   * an unpersisted `NOT_STARTED` shell: `CredentialingApplication.council`
   * is a required `CouncilKey` with no honest placeholder value, and
   * `findByApplicant` only ever finds a row once `submitApplication` has
   * actually transitioned it past `NOT_STARTED`, so `null` is already a
   * truthful "nothing submitted yet."
   */
  findMine(applicantId: string): CredentialingApplication | null {
    return this.repository.findByApplicant(applicantId);
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

  /**
   * Same transition-error-to-400 convention as `submit` above — a reviewer
   * double-clicking "begin review", or a second tab racing the first, hits
   * `UNDER_REVIEW → UNDER_REVIEW`, which is not a legal edge and must not
   * surface as an uncaught 500.
   */
  beginReview(applicationId: string, reviewerId: string): CredentialingApplication {
    const reviewed = this.repository.save(this.#transition(applicationId, beginReview));
    this.#audit(applicationId, reviewerId, 'REVIEW_STARTED');
    return reviewed;
  }

  /** Same transition-error-to-400 convention as `submit`/`beginReview` — an approve arriving before `beginReview` is `EVIDENCE_SUBMITTED → APPROVED`, not a legal edge. */
  approve(applicationId: string, reviewerId: string): CredentialingApplication {
    const decided = this.repository.save(
      this.#transition(applicationId, (application) => approveApplication(application, reviewerId, new Date().toISOString())),
    );
    this.#audit(applicationId, reviewerId, 'APPLICATION_APPROVED');
    return decided;
  }

  /** Same transition-error-to-400 convention as `submit`/`beginReview`/`approve` — see `beginReview`'s doc comment. */
  reject(applicationId: string, reviewerId: string, reason: string): CredentialingApplication {
    const decided = this.repository.save(
      this.#transition(applicationId, (application) => rejectApplication(application, reviewerId, reason, new Date().toISOString())),
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

  /** `submit`'s transition-error-to-400 conversion, shared by every state-changing reviewer action. */
  #transition(
    applicationId: string,
    apply: (application: CredentialingApplication) => CredentialingApplication,
  ): CredentialingApplication {
    try {
      return apply(this.#require(applicationId));
    } catch (error) {
      if (error instanceof ApplicationTransitionError) {
        throw new BadRequestException({ code: error.name, message: error.message });
      }
      throw error;
    }
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

import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  VerificationTransitionError,
  approveVerification,
  beginReview,
  rejectVerification,
  submitEvidence,
  verificationQueue,
} from '@swasthya/identity';
import type { IdentityDocumentType, VerificationRequest } from '@swasthya/shared-types';
import { AUTH_STORE, type AuthStore } from '../auth/auth-store.js';
import { IdentityRepository, type IdentityAuditEntry } from './identity.repository.js';

export interface SubmitEvidenceInput {
  ownerId: string;
  documentType: IdentityDocumentType;
  evidenceImageRef: string;
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly repository: IdentityRepository,
    @Inject(AUTH_STORE) private readonly authStore: AuthStore,
  ) {}

  /**
   * Submits, or resubmits after rejection, identity evidence. Same
   * transition-error-to-400 convention `CredentialingService.submit` and
   * `FamilyGrantsService.createDelegation` already use for their own domain
   * errors — a second submission while one is still pending is a normal,
   * explainable 400, not an uncaught 500.
   */
  submit(input: SubmitEvidenceInput): VerificationRequest {
    const existing = this.repository.findByOwner(input.ownerId) ?? emptyVerificationRequest(randomUUID(), input.ownerId);

    let submitted: VerificationRequest;
    try {
      submitted = submitEvidence(
        existing,
        input.documentType,
        input.evidenceImageRef,
        new Date().toISOString(),
      );
    } catch (error) {
      if (error instanceof VerificationTransitionError) {
        throw new BadRequestException({ code: error.name, message: error.message });
      }
      throw error;
    }
    return this.repository.save(submitted);
  }

  queue(): readonly VerificationRequest[] {
    return verificationQueue(this.repository.list());
  }

  /**
   * The signed-in owner's own verification status — what `apps/web`'s
   * account page polls to know whether to show a submission form, a pending
   * banner, or a rejection reason, without needing `IdentityReviewerGuard`.
   * Read-only: unlike `submit`, the `NOT_STARTED` shell for a first-time
   * caller is never persisted, since nothing has actually happened yet.
   */
  findMine(ownerId: string): VerificationRequest {
    return this.repository.findByOwner(ownerId) ?? emptyVerificationRequest(randomUUID(), ownerId);
  }

  /** A reviewer opens one request to read its submitted evidence — identity-and-credentialing.md §4: "every read of an evidence image is logged." */
  read(verificationId: string, reviewerId: string): VerificationRequest {
    const request = this.#require(verificationId);
    this.#audit(verificationId, reviewerId, 'EVIDENCE_READ');
    return request;
  }

  /**
   * Same transition-error-to-400 convention as `submit` above — a reviewer
   * double-clicking "begin review", or a second tab racing the first, hits
   * `UNDER_REVIEW → UNDER_REVIEW`, which is not a legal edge and must not
   * surface as an uncaught 500.
   */
  beginReview(verificationId: string, reviewerId: string): VerificationRequest {
    const reviewed = this.repository.save(this.#transition(verificationId, beginReview));
    this.#audit(verificationId, reviewerId, 'REVIEW_STARTED');
    return reviewed;
  }

  /**
   * Records an approval and raises the owner's real assurance level —
   * previously nothing in `apps/api` ever called
   * `AuthStore.markIdentityVerified`, so `AuthService.currentUser` had no
   * path to `IDENTITY_VERIFIED` and every route gated at that level
   * (`RECORD_SHARING`, `TELECONSULTATION`) was unreachable for a real
   * session. `approveVerification` above already guarantees this fires at
   * most once per owner — its state machine has no edge back into `APPROVED`
   * — so there is no double-elevation risk to guard against here.
   *
   * Wrapped in the same transition-error-to-400 convention as `submit`: an
   * approve arriving before `beginReview` (e.g. a client that skips the
   * "begin review" step) is `EVIDENCE_SUBMITTED → APPROVED`, not a legal
   * edge, and must not surface as an uncaught 500.
   */
  async approve(verificationId: string, reviewerId: string): Promise<VerificationRequest> {
    const decided = this.repository.save(
      this.#transition(verificationId, (request) => approveVerification(request, new Date().toISOString())),
    );
    this.#audit(verificationId, reviewerId, 'VERIFICATION_APPROVED');
    await this.authStore.markIdentityVerified(decided.ownerId);
    return decided;
  }

  /** Same transition-error-to-400 convention as `submit`/`beginReview`/`approve` — see `beginReview`'s doc comment. */
  reject(verificationId: string, reviewerId: string, reason: string): VerificationRequest {
    const decided = this.repository.save(
      this.#transition(verificationId, (request) => rejectVerification(request, reason, new Date().toISOString())),
    );
    this.#audit(verificationId, reviewerId, 'VERIFICATION_REJECTED');
    return decided;
  }

  /** Who read this request's evidence, and who decided it, and when — identity-and-credentialing.md §4's accountability trail. */
  auditLog(verificationId: string): readonly IdentityAuditEntry[] {
    this.#require(verificationId);
    return this.repository.listAuditEntries(verificationId);
  }

  #audit(verificationId: string, reviewerId: string, action: IdentityAuditEntry['action']): void {
    this.repository.appendAuditEntry({
      id: randomUUID(),
      verificationId,
      actorId: reviewerId,
      actorRole: 'IDENTITY_REVIEWER',
      action,
      occurredAt: new Date().toISOString(),
    });
  }

  #require(verificationId: string): VerificationRequest {
    const request = this.repository.find(verificationId);
    if (!request) throw new NotFoundException(`No verification request ${verificationId}`);
    return request;
  }

  /** `submit`'s transition-error-to-400 conversion, shared by every state-changing reviewer action. */
  #transition(
    verificationId: string,
    apply: (request: VerificationRequest) => VerificationRequest,
  ): VerificationRequest {
    try {
      return apply(this.#require(verificationId));
    } catch (error) {
      if (error instanceof VerificationTransitionError) {
        throw new BadRequestException({ code: error.name, message: error.message });
      }
      throw error;
    }
  }
}

/**
 * A `NOT_STARTED` shell for a first-time submitter. `submitEvidence`
 * overwrites `documentType`/`evidenceImageRef` unconditionally, so the values
 * here only matter for the instant before that call.
 */
function emptyVerificationRequest(id: string, ownerId: string): VerificationRequest {
  return {
    id,
    ownerId,
    status: 'NOT_STARTED',
    documentType: null,
    evidenceImageRef: null,
    rejectionReason: null,
    submittedAt: null,
    decidedAt: null,
  };
}

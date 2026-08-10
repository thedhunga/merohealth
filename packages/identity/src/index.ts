import type {
  AssuranceLevel,
  IdentityDocumentType,
  ModuleKey,
  VerificationRequest,
  VerificationStatus,
} from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * Assurance ladder
 *
 * Linear and forward-only: nothing in identity-and-credentialing.md
 * describes a person losing `REGISTERED` or `IDENTITY_VERIFIED` once
 * reached. (Council registration lapses — see packages/credentialing,
 * not built yet — but that is a clinician's separate professional badge,
 * not this ladder.)
 * ------------------------------------------------------------------ */

const assuranceOrder: readonly AssuranceLevel[] = ['ANONYMOUS', 'REGISTERED', 'IDENTITY_VERIFIED'];

const assuranceTransitions: Readonly<Record<AssuranceLevel, readonly AssuranceLevel[]>> = {
  ANONYMOUS: ['REGISTERED'],
  REGISTERED: ['IDENTITY_VERIFIED'],
  IDENTITY_VERIFIED: [],
};

export function canReachAssurance(from: AssuranceLevel, to: AssuranceLevel): boolean {
  return (assuranceTransitions[from] ?? []).includes(to);
}

export class AssuranceTransitionError extends Error {
  constructor(from: AssuranceLevel, to: AssuranceLevel) {
    super(`Illegal assurance transition: ${from} → ${to}`);
    this.name = 'AssuranceTransitionError';
  }
}

/**
 * `REGISTERED` is reached by phone + OTP and `IDENTITY_VERIFIED` only by an
 * `APPROVED` `VerificationRequest` — this package does not perform either
 * check itself (OTP delivery is a distinct, unbuilt auth concern), it only
 * refuses an illegal jump such as `ANONYMOUS → IDENTITY_VERIFIED`.
 */
export function raiseAssurance(current: AssuranceLevel, to: AssuranceLevel): AssuranceLevel {
  if (!canReachAssurance(current, to)) {
    throw new AssuranceTransitionError(current, to);
  }
  return to;
}

/** True when `level` is at or above `required` on the ladder. */
export function meetsAssurance(level: AssuranceLevel, required: AssuranceLevel): boolean {
  return assuranceOrder.indexOf(level) >= assuranceOrder.indexOf(required);
}

/**
 * The minimum assurance level each module requires, read directly off the
 * "what it unlocks" column of identity-and-credentialing.md §2's table.
 * Modules that table does not name default to `REGISTERED` — "the level the
 * product is designed around" — rather than the weaker `ANONYMOUS`, so a
 * module gains anonymous access only by explicit listing here, never by
 * omission. Exhaustive over `ModuleKey` so a module added upstream without a
 * row here is a compile error, not a silent default.
 */
export const minimumAssuranceLevel: Readonly<Record<ModuleKey, AssuranceLevel>> = {
  ASSISTANT: 'ANONYMOUS',
  CARE_DIRECTORY: 'ANONYMOUS',
  HEALTH_RECORD: 'REGISTERED',
  DOCUMENT_EXTRACTION: 'REGISTERED',
  HOSTED_STORAGE: 'REGISTERED',
  BRING_YOUR_OWN_STORAGE: 'REGISTERED',
  DEVICE_SYNC: 'REGISTERED',
  RECORD_SHARING: 'IDENTITY_VERIFIED',
  PROVIDER_EXPORT: 'IDENTITY_VERIFIED',
  TELECONSULTATION: 'IDENTITY_VERIFIED',
};

export function meetsAssuranceForModule(level: AssuranceLevel, module: ModuleKey): boolean {
  return meetsAssurance(level, minimumAssuranceLevel[module]);
}

/* ------------------------------------------------------------------ *
 * Verification state machine and evidence lifecycle
 *
 * "Evidence lifecycle" per identity-and-credentialing.md §4: the document
 * image exists only between submission and decision. Every function below
 * that records a decision (`approveVerification`, `rejectVerification`)
 * nulls `evidenceImageRef` as part of the same state change — there is no
 * code path that reaches a decided status while still holding the image.
 * ------------------------------------------------------------------ */

const verificationTransitions: Readonly<Record<VerificationStatus, readonly VerificationStatus[]>> = {
  NOT_STARTED: ['EVIDENCE_SUBMITTED'],
  EVIDENCE_SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  // A rejection is reversible and explained (§3): the person resubmits fresh
  // evidence rather than being stuck.
  REJECTED: ['EVIDENCE_SUBMITTED'],
  APPROVED: [],
};

export function canTransitionVerification(from: VerificationStatus, to: VerificationStatus): boolean {
  return (verificationTransitions[from] ?? []).includes(to);
}

export class VerificationTransitionError extends Error {
  constructor(from: VerificationStatus, to: VerificationStatus) {
    super(`Illegal verification transition: ${from} → ${to}`);
    this.name = 'VerificationTransitionError';
  }
}

function transitionVerification(
  request: VerificationRequest,
  to: VerificationStatus,
): VerificationRequest {
  if (!canTransitionVerification(request.status, to)) {
    throw new VerificationTransitionError(request.status, to);
  }
  return { ...request, status: to };
}

/**
 * Submits (or resubmits, after a rejection) identity evidence. `documentType`
 * and `evidenceImageRef` are stated fresh each time rather than merged with
 * any prior attempt — a resubmission is a new piece of evidence, not a patch
 * to the rejected one, so the previous rejection reason is cleared here too.
 */
export function submitEvidence(
  request: VerificationRequest,
  documentType: IdentityDocumentType,
  evidenceImageRef: string,
  submittedAt: string,
): VerificationRequest {
  return {
    ...transitionVerification(request, 'EVIDENCE_SUBMITTED'),
    documentType,
    evidenceImageRef,
    submittedAt,
    rejectionReason: null,
    decidedAt: null,
  };
}

export function beginReview(request: VerificationRequest): VerificationRequest {
  return transitionVerification(request, 'UNDER_REVIEW');
}

/**
 * Records an approval. Per §4, once the decision exists the image no longer
 * needs to: `evidenceImageRef` is cleared here, in the same state change,
 * not as a follow-up step a caller could forget.
 */
export function approveVerification(
  request: VerificationRequest,
  decidedAt: string,
): VerificationRequest {
  return {
    ...transitionVerification(request, 'APPROVED'),
    evidenceImageRef: null,
    decidedAt,
  };
}

/** Records a rejection. `reason` must be concrete enough to act on when resubmitting. */
export function rejectVerification(
  request: VerificationRequest,
  reason: string,
  decidedAt: string,
): VerificationRequest {
  return {
    ...transitionVerification(request, 'REJECTED'),
    evidenceImageRef: null,
    rejectionReason: reason,
    decidedAt,
  };
}

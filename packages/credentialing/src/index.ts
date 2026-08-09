import type {
  CouncilKey,
  CredentialingApplication,
  CredentialingApplicationStatus,
  CredentialingBadge,
} from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * Council registry
 *
 * Nepal has five statutory registers (identity-and-credentialing.md §3), one
 * per profession, and the right one depends on what the applicant practises.
 * `nameNe` is each council's own name, cross-checked against its governing
 * Act on the Nepal Law Commission site (NNC: "nepal-nursing-council-act-205",
 * NHPC: "nepal-health-provident-council-2053") and, for Pharmacy and
 * Ayurvedic, each council's own site — not translated from the English by
 * this codebase, per the standing "invent no facts" constraint applied to a
 * proper noun. `professionEn` is copied verbatim from §3's own list of who
 * registers where. A Nepali profession label is deliberately left out: that
 * is UI copy for the not-yet-built clinician-registration-flow task, which
 * owns per-locale strings in `ne.json`/`en.json`, not this domain package.
 * ------------------------------------------------------------------ */

export interface CouncilDefinition {
  key: CouncilKey;
  nameEn: string;
  nameNe: string;
  professionEn: string;
}

export const councilRegistry: Readonly<Record<CouncilKey, CouncilDefinition>> = {
  NMC: {
    key: 'NMC',
    nameEn: 'Nepal Medical Council',
    nameNe: 'नेपाल चिकित्सक परिषद्',
    professionEn: 'Doctors',
  },
  NNC: {
    key: 'NNC',
    nameEn: 'Nepal Nursing Council',
    nameNe: 'नेपाल नर्सिङ परिषद्',
    professionEn: 'Nurses and midwives',
  },
  NHPC: {
    key: 'NHPC',
    nameEn: 'Nepal Health Professional Council',
    nameNe: 'नेपाल स्वास्थ्य व्यवसायी परिषद्',
    professionEn: 'Allied health professionals',
  },
  PHARMACY_COUNCIL: {
    key: 'PHARMACY_COUNCIL',
    nameEn: 'Nepal Pharmacy Council',
    nameNe: 'नेपाल फार्मेसी परिषद्',
    professionEn: 'Pharmacists',
  },
  AYURVEDIC_COUNCIL: {
    key: 'AYURVEDIC_COUNCIL',
    nameEn: 'Nepal Ayurvedic Medical Council',
    nameNe: 'नेपाल आयुर्वेद चिकित्सा परिषद्',
    professionEn: 'Ayurvedic practitioners',
  },
};

export function isKnownCouncil(key: string): key is CouncilKey {
  return Object.hasOwn(councilRegistry, key);
}

/* ------------------------------------------------------------------ *
 * Application state machine
 *
 * Deliberately the same shape as `packages/identity`'s verification state
 * machine (submit → review → decide, rejection resubmits, approval is
 * terminal) — §3's flow is the same four steps, just against a council
 * register instead of a national ID.
 * ------------------------------------------------------------------ */

const transitions: Readonly<Record<CredentialingApplicationStatus, readonly CredentialingApplicationStatus[]>> = {
  NOT_STARTED: ['EVIDENCE_SUBMITTED'],
  EVIDENCE_SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  // Rejection is reversible and explained (§3): the applicant fixes the
  // evidence — most often a blurred certificate photograph — and resubmits.
  REJECTED: ['EVIDENCE_SUBMITTED'],
  APPROVED: [],
};

export function canTransitionApplication(
  from: CredentialingApplicationStatus,
  to: CredentialingApplicationStatus,
): boolean {
  return (transitions[from] ?? []).includes(to);
}

export class ApplicationTransitionError extends Error {
  constructor(from: CredentialingApplicationStatus, to: CredentialingApplicationStatus) {
    super(`Illegal credentialing application transition: ${from} → ${to}`);
    this.name = 'ApplicationTransitionError';
  }
}

function transitionApplication(
  application: CredentialingApplication,
  to: CredentialingApplicationStatus,
): CredentialingApplication {
  if (!canTransitionApplication(application.status, to)) {
    throw new ApplicationTransitionError(application.status, to);
  }
  return { ...application, status: to };
}

/**
 * Submits (or resubmits, after a rejection) a council application: which
 * council, the registration number, and photographs of the certificate and a
 * photo ID. Stated fresh each time rather than merged with a prior attempt —
 * a resubmission is new evidence, not a patch to the rejected one, so the
 * previous decision is cleared here too.
 */
export function submitApplication(
  application: CredentialingApplication,
  council: CouncilKey,
  registrationNumber: string,
  certificateImageRef: string,
  identityImageRef: string,
  submittedAt: string,
): CredentialingApplication {
  return {
    ...transitionApplication(application, 'EVIDENCE_SUBMITTED'),
    council,
    registrationNumber,
    certificateImageRef,
    identityImageRef,
    submittedAt,
    rejectionReason: null,
    reviewerId: null,
    decidedAt: null,
  };
}

/** A reviewer picks the application up off the queue to read the register. */
export function beginReview(application: CredentialingApplication): CredentialingApplication {
  return transitionApplication(application, 'UNDER_REVIEW');
}

/**
 * Records an approval. Per §4, once the decision exists the certificate and
 * ID photographs no longer need to: both are cleared here, in the same state
 * change, not as a follow-up step a caller could forget.
 */
export function approveApplication(
  application: CredentialingApplication,
  reviewerId: string,
  decidedAt: string,
): CredentialingApplication {
  return {
    ...transitionApplication(application, 'APPROVED'),
    certificateImageRef: null,
    identityImageRef: null,
    reviewerId,
    decidedAt,
  };
}

/** Records a rejection. `reason` must be concrete enough for the applicant to act on when resubmitting. */
export function rejectApplication(
  application: CredentialingApplication,
  reviewerId: string,
  reason: string,
  decidedAt: string,
): CredentialingApplication {
  return {
    ...transitionApplication(application, 'REJECTED'),
    certificateImageRef: null,
    identityImageRef: null,
    rejectionReason: reason,
    reviewerId,
    decidedAt,
  };
}

/* ------------------------------------------------------------------ *
 * Review queue
 * ------------------------------------------------------------------ */

/**
 * What a reviewer works through — oldest submission first, so no applicant
 * waits behind one that arrived later. This only orders the queue; §3's "no
 * automatic approval, ever" means nothing here ever decides on a reviewer's
 * behalf.
 */
export function reviewQueue(
  applications: readonly CredentialingApplication[],
): readonly CredentialingApplication[] {
  return applications
    .filter((application) => application.status === 'EVIDENCE_SUBMITTED' || application.status === 'UNDER_REVIEW')
    .toSorted((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''));
}

/* ------------------------------------------------------------------ *
 * Badge rules
 *
 * §3's "never render 'verified' for a submission no person has reviewed" is
 * enforced as a runtime fact here, not left to a UI to remember: the only way
 * to construct a `CredentialingBadge` is `issueBadge`, and it refuses any
 * application that is not `APPROVED` with a recorded reviewer and decision
 * timestamp.
 * ------------------------------------------------------------------ */

export class ApplicationNotApprovedError extends Error {
  constructor(applicationId: string) {
    super(`Cannot issue a badge for application ${applicationId}: no recorded APPROVED decision`);
    this.name = 'ApplicationNotApprovedError';
  }
}

/**
 * `recheckDueAt` is supplied by the caller rather than computed here: §3
 * states registration lapses and every verification carries a re-check date,
 * but names no interval, and inventing a renewal cadence this codebase has
 * never confirmed with a council would be exactly the kind of fabricated
 * fact the standing constraints forbid.
 */
export function issueBadge(
  application: CredentialingApplication,
  recheckDueAt: string,
): CredentialingBadge {
  if (application.status !== 'APPROVED' || application.reviewerId === null || application.decidedAt === null) {
    throw new ApplicationNotApprovedError(application.id);
  }
  return {
    council: application.council,
    registrationNumber: application.registrationNumber,
    reviewerId: application.reviewerId,
    verifiedAt: application.decidedAt,
    lastCheckedAt: application.decidedAt,
    recheckDueAt,
  };
}

/** A human re-checked the register and the badge is renewed for another period. */
export function recheckBadge(
  badge: CredentialingBadge,
  lastCheckedAt: string,
  recheckDueAt: string,
): CredentialingBadge {
  return { ...badge, lastCheckedAt, recheckDueAt };
}

/** True until `recheckDueAt` passes. */
export function isBadgeCurrent(badge: CredentialingBadge, now: string): boolean {
  return now < badge.recheckDueAt;
}

export type CredentialingBadgeRenderStatus = 'VERIFIED' | 'UNVERIFIED';

/**
 * What a UI is allowed to render. §3: "a stale verification degrades to
 * unverified rather than silently persisting" — this is the one function a
 * badge component should call, so that rule lives in one place rather than
 * every caller re-deriving it from `recheckDueAt` themselves. Also §5's own
 * non-negotiable: this never recomputes trust live from a service that can
 * fail, it only reads the persisted badge's own dates.
 */
export function badgeRenderStatus(badge: CredentialingBadge, now: string): CredentialingBadgeRenderStatus {
  return isBadgeCurrent(badge, now) ? 'VERIFIED' : 'UNVERIFIED';
}

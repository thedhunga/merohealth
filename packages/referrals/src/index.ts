import type { Referral, RequestReferralInput } from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * Referrals
 *
 * clinical-suite.md capability map row 12: "Referral management ... Pairs
 * with care-directory." Pure domain layer only, matching every sibling
 * clinical-suite module's own split: `patientId`/`clinicianId`/
 * `encounterId`/`referredToEntityId` are accepted as already-resolved
 * opaque ids (see `apps/api/src/referrals/referrals.service.ts` for how
 * `encounterId` is resolved through `clinical-charting`'s port and
 * `referredToEntityId` through `care-directory`'s `findDirectoryEntity`).
 *
 * The state machine is REQUESTED -> ACCEPTED -> COMPLETED, with REQUESTED
 * also reachable to DECLINED or CANCELLED. Once ACCEPTED, the only forward
 * transition is COMPLETED — see `completeReferral` below.
 * ------------------------------------------------------------------ */

/**
 * Reused by every mutation that requires a referral still awaiting a
 * response (`acceptReferral`, `declineReferral`, `cancelReferral` after its
 * own already-cancelled check), the same way `packages/billing`'s
 * `InvoiceNotDraftError` covers multiple functions rather than each
 * inventing its own "wrong state" error.
 */
export class ReferralNotRequestedError extends Error {
  constructor(id: string) {
    super(`Referral ${id} is not awaiting a response — it has already been accepted, declined, cancelled, or completed`);
    this.name = 'ReferralNotRequestedError';
  }
}

export class ReferralNotAcceptedError extends Error {
  constructor(id: string) {
    super(`Referral ${id} is not accepted — it must be accepted before it can be completed`);
    this.name = 'ReferralNotAcceptedError';
  }
}

/**
 * Rejected rather than silently idempotent, matching
 * `InvoiceAlreadyVoidedError`/`TeleconsultationSessionAlreadyCancelledError`'s
 * own precedent: a caller relying on this throwing to detect "did my cancel
 * actually do anything" would otherwise get a false positive.
 */
export class ReferralAlreadyCancelledError extends Error {
  constructor(id: string) {
    super(`Referral ${id} is already cancelled`);
    this.name = 'ReferralAlreadyCancelledError';
  }
}

export function requestReferral(
  id: string,
  patientId: string,
  encounterId: string,
  input: RequestReferralInput,
  now: string,
): Referral {
  return {
    id,
    patientId,
    clinicianId: input.clinicianId,
    encounterId,
    referredToEntityId: input.referredToEntityId,
    reason: input.reason,
    status: 'REQUESTED',
    acceptedAt: null,
    declinedAt: null,
    declineReason: null,
    cancelledAt: null,
    cancelReason: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function assertRequested(referral: Referral): void {
  if (referral.status !== 'REQUESTED') throw new ReferralNotRequestedError(referral.id);
}

/**
 * Recorded by the referring clinic's own staff, not a live response from
 * the target provider — see this file's header comment. There is no
 * network call here; this is the honest record that an outcome was reached
 * through some real-world channel this system cannot see.
 */
export function acceptReferral(referral: Referral, now: string): Referral {
  assertRequested(referral);
  return { ...referral, status: 'ACCEPTED', acceptedAt: now, updatedAt: now, version: referral.version + 1 };
}

export function declineReferral(referral: Referral, reason: string, now: string): Referral {
  assertRequested(referral);
  return {
    ...referral,
    status: 'DECLINED',
    declinedAt: now,
    declineReason: reason,
    updatedAt: now,
    version: referral.version + 1,
  };
}

/**
 * Only reaches an ACCEPTED referral — an ACCEPTED referral can only move
 * forward to COMPLETED (see this file's header comment for why), and a
 * REQUESTED/DECLINED/CANCELLED one has never been accepted in the first
 * place.
 */
export function completeReferral(referral: Referral, now: string): Referral {
  if (referral.status !== 'ACCEPTED') throw new ReferralNotAcceptedError(referral.id);
  return { ...referral, status: 'COMPLETED', completedAt: now, updatedAt: now, version: referral.version + 1 };
}

/**
 * Only reaches a REQUESTED referral — `assertRequested` rejects an
 * ACCEPTED/DECLINED/COMPLETED one with `ReferralNotRequestedError` (once
 * accepted, cancelling would misrepresent an agreement reached outside this
 * system), and an already-CANCELLED one gets its own more specific error,
 * checked first so the two wrong-state cases are distinguishable.
 */
export function cancelReferral(referral: Referral, reason: string, now: string): Referral {
  if (referral.status === 'CANCELLED') throw new ReferralAlreadyCancelledError(referral.id);
  assertRequested(referral);
  return {
    ...referral,
    status: 'CANCELLED',
    cancelledAt: now,
    cancelReason: reason,
    updatedAt: now,
    version: referral.version + 1,
  };
}

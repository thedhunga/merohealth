/**
 * Family, proxy access and inherited risk — round two §C, first task.
 *
 * docs/architecture/family-and-proxy.md §1: every person is their own
 * subject, never a profile nested inside someone else's account. This
 * package therefore never introduces a `Subject` type of its own — a
 * subject is just whichever plain `string` id the rest of the platform
 * already uses (`ownerId` on a health document, `subjectId` in retrieval,
 * `patientId` in the registry). What this package adds is the two
 * relationships one subject can have to another: `GuardianshipGrant` (the
 * guardian acts *as* the ward — full access, no scope to check) and
 * `DelegationGrant` (a competent adult grants a helper narrower, revocable
 * access). §2 is explicit that conflating these is the failure mode — "a
 * competent grandmother is not a dependent" — so they are modelled as two
 * separate types with no shared base and no function that accepts either
 * interchangeably.
 *
 * Deliberately not in this file: the four independently-grantable
 * delegation scopes (`VIEW_RECORD` / `ASK_ASSISTANT` /
 * `MANAGE_APPOINTMENTS` / `UPLOAD_DOCUMENTS`, queue's next bullet, "Scoped
 * delegation"), assisted enrolment and its consent-method provenance
 * (queue bullet after that), the owner-visible access log, and family
 * history assertions. Each is its own queue item and its own task.
 */

/* ------------------------------------------------------------------ *
 * Guardianship
 *
 * For a minor, or an adult assessed to lack capacity (§2, "Guardianship").
 * The guardian acts *as* the ward: this package never models a scope for
 * it, because there is nothing narrower than full access to check.
 *
 * The one property that matters is the mandatory expiry. §2: "an adult
 * whose parent still has full access to their record because nobody wrote
 * the expiry is a real harm." `expiresAt` is a required field on the type
 * itself, not an optional one a caller can omit — there is no code path
 * that constructs a `GuardianshipGrant` without one. Combined with
 * `isGuardianshipActive` deriving liveness from `expiresAt` on every read
 * (the same pattern `packages/language-corpus`'s `ConsentGrant.isLive`
 * already uses for consent), that is what "must transition rather than
 * silently continue" means in code: there is no scheduled job to forget to
 * write, because nothing ever reads the grant as active past its expiry in
 * the first place.
 * ------------------------------------------------------------------ */

export type GuardianshipGrounds = 'MINOR' | 'INCAPACITY';

export interface GuardianshipGrant {
  id: string;
  /** The person represented — their own subject, per §1, never a field on the guardian's account. */
  wardId: string;
  guardianId: string;
  grounds: GuardianshipGrounds;
  grantedAt: string;
  /** Mandatory. For `MINOR`, the ward's 18th birthday — see `guardianshipExpiryForMinor`. */
  expiresAt: string;
  /** Set the moment guardianship ends early (reassessment, court order). Never delete the row. */
  revokedAt: string | null;
}

export class WardAlreadyOfAgeError extends Error {
  constructor(wardId: string, dateOfBirth: string, grantedAt: string) {
    super(`Cannot grant MINOR guardianship for ${wardId}: date of birth ${dateOfBirth} is already 18+ at ${grantedAt}`);
    this.name = 'WardAlreadyOfAgeError';
  }
}

export class InvalidGuardianshipExpiryError extends Error {
  constructor(expiresAt: string, grantedAt: string) {
    super(`Guardianship expiresAt (${expiresAt}) must be after grantedAt (${grantedAt})`);
    this.name = 'InvalidGuardianshipExpiryError';
  }
}

/**
 * The ward's 18th birthday, computed from their date of birth rather than
 * accepted from the caller. Unlike `packages/credentialing`'s
 * `recheckDueAt` (a genuinely arbitrary interval this codebase has never
 * confirmed with a council, so it must come from the caller), "18" is a
 * fact already stated in family-and-proxy.md §2 — inventing a *different*
 * number here would be the fabrication, not computing this one.
 */
export function guardianshipExpiryForMinor(dateOfBirth: string): string {
  const dob = new Date(dateOfBirth);
  return new Date(Date.UTC(dob.getUTCFullYear() + 18, dob.getUTCMonth(), dob.getUTCDate())).toISOString();
}

/** Grants guardianship over a minor. `expiresAt` is always the ward's 18th birthday — never accepted as a parameter. */
export function grantGuardianshipForMinor(
  id: string,
  wardId: string,
  guardianId: string,
  wardDateOfBirth: string,
  grantedAt: string,
): GuardianshipGrant {
  const expiresAt = guardianshipExpiryForMinor(wardDateOfBirth);
  if (expiresAt <= grantedAt) throw new WardAlreadyOfAgeError(wardId, wardDateOfBirth, grantedAt);
  return { id, wardId, guardianId, grounds: 'MINOR', grantedAt, expiresAt, revokedAt: null };
}

/**
 * Grants guardianship over an adult assessed to lack capacity. §2 requires
 * a mandatory expiry here too, but names no reassessment interval — like
 * `issueBadge`'s `recheckDueAt`, that is for the caller (whoever records
 * the capacity assessment) to supply, not for this package to invent.
 */
export function grantGuardianshipForIncapacity(
  id: string,
  wardId: string,
  guardianId: string,
  expiresAt: string,
  grantedAt: string,
): GuardianshipGrant {
  if (expiresAt <= grantedAt) throw new InvalidGuardianshipExpiryError(expiresAt, grantedAt);
  return { id, wardId, guardianId, grounds: 'INCAPACITY', grantedAt, expiresAt, revokedAt: null };
}

/** Idempotent, matching `ConsentGrant`'s revoke: a second call after revocation is a no-op, not an error. */
export function revokeGuardianship(grant: GuardianshipGrant, now: string): GuardianshipGrant {
  return grant.revokedAt === null ? { ...grant, revokedAt: now } : grant;
}

/** True only between `grantedAt` and whichever of `expiresAt` / `revokedAt` comes first. */
export function isGuardianshipActive(grant: GuardianshipGrant, now: string): boolean {
  if (grant.grantedAt > now) return false;
  if (grant.revokedAt !== null && grant.revokedAt <= now) return false;
  return now < grant.expiresAt;
}

/* ------------------------------------------------------------------ *
 * Delegation
 *
 * For a competent adult who wants help (§2, "Delegation"). She grants, and
 * she can revoke — this is the opposite direction of control from
 * guardianship, which is exactly why it cannot share that state machine.
 * Time-bounded by default (§2: "so an abandoned grant lapses instead of
 * persisting forever"), so `expiresAt` is required here too, though — unlike
 * guardianship — nothing in the design names a specific duration, so the
 * caller supplies it.
 * ------------------------------------------------------------------ */

export interface DelegationGrant {
  id: string;
  /** Whose record this is — the person granting access. */
  granterId: string;
  /** Who is granted access. */
  delegateId: string;
  grantedAt: string;
  expiresAt: string;
  /** Set the moment she revokes. §2: must work through any channel, not only the app — that is a caller concern, not this function's. */
  revokedAt: string | null;
}

export class SelfDelegationError extends Error {
  constructor(subjectId: string) {
    super(`${subjectId} cannot delegate access to themself`);
    this.name = 'SelfDelegationError';
  }
}

export class InvalidDelegationExpiryError extends Error {
  constructor(expiresAt: string, grantedAt: string) {
    super(`Delegation expiresAt (${expiresAt}) must be after grantedAt (${grantedAt})`);
    this.name = 'InvalidDelegationExpiryError';
  }
}

export function grantDelegation(
  id: string,
  granterId: string,
  delegateId: string,
  grantedAt: string,
  expiresAt: string,
): DelegationGrant {
  if (granterId === delegateId) throw new SelfDelegationError(granterId);
  if (expiresAt <= grantedAt) throw new InvalidDelegationExpiryError(expiresAt, grantedAt);
  return { id, granterId, delegateId, grantedAt, expiresAt, revokedAt: null };
}

/** Idempotent, same reasoning as `revokeGuardianship`. */
export function revokeDelegation(grant: DelegationGrant, now: string): DelegationGrant {
  return grant.revokedAt === null ? { ...grant, revokedAt: now } : grant;
}

/** True only between `grantedAt` and whichever of `expiresAt` / `revokedAt` comes first. */
export function isDelegationActive(grant: DelegationGrant, now: string): boolean {
  if (grant.grantedAt > now) return false;
  if (grant.revokedAt !== null && grant.revokedAt <= now) return false;
  return now < grant.expiresAt;
}

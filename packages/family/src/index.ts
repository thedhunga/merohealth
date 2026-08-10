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
 * §5's family history and explicit condition sharing are also here (bottom
 * of file) — two more types with no shared base, following the same
 * "conflating these is the failure mode" reasoning as guardianship versus
 * delegation above.
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
 *
 * §2 also requires the grant itself to be scoped — "booking an appointment
 * does not require reading her mental-health notes" — so unlike
 * `GuardianshipGrant` (full access, nothing narrower to check), a
 * `DelegationGrant` carries the exact set of `DelegationScope`s it was given.
 * There is deliberately no route or UI checking `hasScope` yet: nothing in
 * the repo grants access to a record, an appointment or a document upload by
 * delegation today, so there is no real call site to wire this into. Adding
 * one now would mean fabricating an enforcement point that doesn't exist.
 *
 * §3 adds a second path into this same type: **assisted enrolment**, for a
 * granter who cannot use the app at all, so someone else records the grant
 * for her after her consent is captured out of band. `grantDelegation`
 * covers the first path (she uses the app herself); `grantDelegationByAssistedEnrolment`
 * covers the second. Both return a `DelegationGrant` — the type carries the
 * distinction (`enrolment`), not a separate parallel type, because every
 * other property (scopes, expiry, revocation) works identically either way.
 * ------------------------------------------------------------------ */

/**
 * The four scopes named in family-and-proxy.md §2, granted independently —
 * a delegate may hold any non-empty subset, not all-or-nothing.
 */
export type DelegationScope = 'VIEW_RECORD' | 'ASK_ASSISTANT' | 'MANAGE_APPOINTMENTS' | 'UPLOAD_DOCUMENTS';

/**
 * The four ways §3 names for capturing consent out of band, when the
 * granter cannot tap "I agree" herself. No fifth value: an in-app grant
 * needs no method (see `DelegationGrant.enrolment`), and inventing a
 * broader taxonomy than the design doc states would be exactly the kind of
 * fabricated precision the "invent no facts" constraint rules out.
 */
export type ConsentMethod = 'IN_PERSON_VERBAL' | 'WITNESSED' | 'CLINICIAN_ATTESTED' | 'WRITTEN';

/** How, and by whom, an assisted-enrolment grant's consent was captured and recorded — §3 points 2-3. */
export interface AssistedEnrolmentConsent {
  method: ConsentMethod;
  /** Whoever entered this grant into the app — never the granter herself; see `grantDelegationByAssistedEnrolment`. */
  recordedBy: string;
}

export interface DelegationGrant {
  id: string;
  /** Whose record this is — the person granting access. */
  granterId: string;
  /** Who is granted access. */
  delegateId: string;
  /** What the delegate may do. Never empty — a delegation that grants nothing is not a delegation. */
  scopes: readonly DelegationScope[];
  grantedAt: string;
  expiresAt: string;
  /** Set the moment she revokes. §2: must work through any channel, not only the app — that is a caller concern, not this function's. */
  revokedAt: string | null;
  /**
   * `null` when the granter created this grant herself, directly, through
   * the app — her own use of the interface *is* her consent, and nothing
   * further needs recording. Present only when someone else recorded the
   * grant on her behalf (§3, "assisted enrolment"), and then it is never
   * optional: §3 requires the *how*, not merely the fact that consent was
   * obtained. Every UI surface must branch on this field rather than
   * rendering every grant the same way — see `wasAssistedEnrolment`.
   */
  enrolment: AssistedEnrolmentConsent | null;
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

export class EmptyDelegationScopeError extends Error {
  constructor(granterId: string, delegateId: string) {
    super(`Delegation from ${granterId} to ${delegateId} must grant at least one scope`);
    this.name = 'EmptyDelegationScopeError';
  }
}

/**
 * Constructs and validates a `DelegationGrant`, shared by the self-service
 * and assisted-enrolment paths below so the two never drift out of sync on
 * what makes a delegation valid.
 */
function buildDelegationGrant(
  id: string,
  granterId: string,
  delegateId: string,
  scopes: readonly DelegationScope[],
  grantedAt: string,
  expiresAt: string,
  enrolment: AssistedEnrolmentConsent | null,
): DelegationGrant {
  if (granterId === delegateId) throw new SelfDelegationError(granterId);
  if (scopes.length === 0) throw new EmptyDelegationScopeError(granterId, delegateId);
  if (expiresAt <= grantedAt) throw new InvalidDelegationExpiryError(expiresAt, grantedAt);
  return { id, granterId, delegateId, scopes, grantedAt, expiresAt, revokedAt: null, enrolment };
}

/** The granter creates this grant herself, through the app. `enrolment` is always `null` — see the field's doc comment. */
export function grantDelegation(
  id: string,
  granterId: string,
  delegateId: string,
  scopes: readonly DelegationScope[],
  grantedAt: string,
  expiresAt: string,
): DelegationGrant {
  return buildDelegationGrant(id, granterId, delegateId, scopes, grantedAt, expiresAt, null);
}

export class SelfRecordedAssistedEnrolmentError extends Error {
  constructor(granterId: string) {
    super(`${granterId} cannot be both the granter and the person recording assisted enrolment — use grantDelegation instead`);
    this.name = 'SelfRecordedAssistedEnrolmentError';
  }
}

/**
 * §3: "enrolling someone who cannot use the app." A helper (`recordedBy`)
 * enters the grant on the granter's behalf, but her consent was still
 * obtained — just out of band, in one of the four ways §3 names. This
 * function records *how*, not merely that consent happened, and refuses the
 * one input that would make "assisted" a lie: the granter recording her own
 * consent is self-service, not assistance, and belongs in `grantDelegation`.
 */
export function grantDelegationByAssistedEnrolment(
  id: string,
  granterId: string,
  delegateId: string,
  scopes: readonly DelegationScope[],
  grantedAt: string,
  expiresAt: string,
  consentMethod: ConsentMethod,
  recordedBy: string,
): DelegationGrant {
  if (recordedBy === granterId) throw new SelfRecordedAssistedEnrolmentError(granterId);
  return buildDelegationGrant(id, granterId, delegateId, scopes, grantedAt, expiresAt, {
    method: consentMethod,
    recordedBy,
  });
}

/**
 * §3: "Never display a delegated relationship as if the person had
 * self-enrolled." This is the guard a rendering surface is expected to call
 * before choosing how to present a grant — `true` means it must show the
 * consent method and who recorded it, never the plain self-service form.
 */
export function wasAssistedEnrolment(grant: DelegationGrant): boolean {
  return grant.enrolment !== null;
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

/**
 * The check a call site is expected to make before letting a delegate act:
 * the grant must be active *and* carry the specific scope being exercised.
 * A delegate with `MANAGE_APPOINTMENTS` but not `VIEW_RECORD` still fails
 * this for a record read — §2's "booking does not require reading notes"
 * only holds if the two are checked independently, never as one bundle.
 */
export function hasScope(grant: DelegationGrant, scope: DelegationScope, now: string): boolean {
  return isDelegationActive(grant, now) && grant.scopes.includes(scope);
}

/* ------------------------------------------------------------------ *
 * Owner-visible access log
 *
 * §4: every access to someone else's record is logged, and the log is
 * visible to the record's **owner** — not only to an administrator. "This
 * is the check that makes delegation safe in practice": elder abuse is
 * usually committed by a relative with legitimate-looking access, so the
 * owner herself must be able to see that her grandson opened her record
 * and what he looked at, not merely trust that someone else is watching on
 * her behalf.
 *
 * An `AccessLogEntry` is produced only through `recordGuardianshipAccess`
 * or `recordDelegatedAccess` below, and both re-check the authorizing
 * grant is actually active at `occurredAt` before logging anything — an
 * entry that could exist for an access that was never actually authorized
 * would be worse than no log at all, since it would misrepresent what "the
 * check that makes delegation safe" is checking. There is no third
 * constructor for a subject reading their own record: §4 is about access
 * to *someone else's* record, and `DelegationGrant`/`GuardianshipGrant`
 * already make granterId/delegateId and wardId/guardianId distinct, so an
 * entry logged through either constructor can never have `ownerId ===
 * actorId`.
 *
 * `accessLogForOwner` is the read side: exactly what a rendering surface
 * may show when the caller is the record's owner. There is deliberately no
 * "admin" variant here — an administrator needs no filtering at all, so
 * the unfiltered `entries` array already serves that case; this function
 * exists to name the *narrower* one, which is the actual gap §4 identifies
 * ("not only to an administrator").
 * ------------------------------------------------------------------ */

/**
 * Which grant authorized the access, and — for a delegate, who only ever
 * holds a subset of scopes — which one was exercised. Guardianship carries
 * no scope of its own (§2: nothing narrower than full access to check), so
 * only the `DELEGATION` case names one.
 */
export type AccessAuthority =
  | { readonly type: 'GUARDIANSHIP'; readonly grantId: string }
  | { readonly type: 'DELEGATION'; readonly grantId: string; readonly scope: DelegationScope };

export interface AccessLogEntry {
  id: string;
  /** Whose record this is — the person this entry is visible to. */
  ownerId: string;
  /** Who accessed it. Never equal to `ownerId`; see the section note above. */
  actorId: string;
  /**
   * What was looked at — a document id, an observation id, "assistant
   * conversation", whatever identifies the thing to the caller. This
   * package fixes no resource taxonomy of its own; nothing in the repo yet
   * reads a record via delegation, so there is no real call site to derive
   * one from (see `apps/api`'s `RecordsController`, which today only
   * accepts a caller-supplied `ownerId` with no delegate distinction).
   */
  resource: string;
  occurredAt: string;
  authority: AccessAuthority;
}

export class UnauthorizedAccessError extends Error {
  constructor(actorId: string, ownerId: string, occurredAt: string) {
    super(`${actorId} has no active authority over ${ownerId}'s record at ${occurredAt}`);
    this.name = 'UnauthorizedAccessError';
  }
}

/**
 * Logs a guardian's access to their ward's record. Guardianship that has
 * expired or been revoked by `occurredAt` throws `UnauthorizedAccessError`
 * instead of producing an entry — see the section note on why a log entry
 * must never outrun what the grant actually authorized.
 */
export function recordGuardianshipAccess(
  id: string,
  grant: GuardianshipGrant,
  resource: string,
  occurredAt: string,
): AccessLogEntry {
  if (!isGuardianshipActive(grant, occurredAt)) {
    throw new UnauthorizedAccessError(grant.guardianId, grant.wardId, occurredAt);
  }
  return {
    id,
    ownerId: grant.wardId,
    actorId: grant.guardianId,
    resource,
    occurredAt,
    authority: { type: 'GUARDIANSHIP', grantId: grant.id },
  };
}

/**
 * Logs a delegate's access to the granter's record under one specific
 * scope. `hasScope` already composes liveness with scope membership, so a
 * delegate acting outside what she was granted — an expired grant, a
 * revoked one, or simply a scope she never held — throws the same
 * `UnauthorizedAccessError` rather than logging an unauthorized read as if
 * it were a legitimate one.
 */
export function recordDelegatedAccess(
  id: string,
  grant: DelegationGrant,
  scope: DelegationScope,
  resource: string,
  occurredAt: string,
): AccessLogEntry {
  if (!hasScope(grant, scope, occurredAt)) {
    throw new UnauthorizedAccessError(grant.delegateId, grant.granterId, occurredAt);
  }
  return {
    id,
    ownerId: grant.granterId,
    actorId: grant.delegateId,
    resource,
    occurredAt,
    authority: { type: 'DELEGATION', grantId: grant.id, scope },
  };
}

/**
 * §4's read side: every entry the record's owner is entitled to see, and
 * nothing she is not — an entry where she was only the *actor* (what she
 * looked at in someone else's record) belongs to that other person's log,
 * not hers. Oldest first, so "your grandson opened your record on ..."
 * reads as a chronological history rather than a shuffled dump; the same
 * ordering `apps/api`'s `CredentialingRepository.listAuditEntries` already
 * uses for the same reason.
 */
export function accessLogForOwner(entries: readonly AccessLogEntry[], viewerId: string): readonly AccessLogEntry[] {
  return entries.filter((entry) => entry.ownerId === viewerId).toSorted((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

/* ------------------------------------------------------------------ *
 * Acting-as query (family-and-proxy.md §1, round two §C6)
 *
 * §1: "the convenience of the streaming-profile model is preserved by the
 * client — a profile switcher in the app — without the ownership being
 * wrong underneath." A switcher needs a bounded, authoritative list of
 * whose record a person may currently open on someone else's behalf; until
 * now this package only answered the opposite-direction questions (what did
 * X do on *my* record, via `accessLogForOwner`; what was shared *with* me,
 * via `conditionSharesVisibleTo`). These two are the missing direction:
 * given a guardian or delegate, which subjects can they act as right now.
 *
 * Filtered to active-at-`now`, the same liveness check every read in this
 * package already applies — an expired or revoked grant must not appear as
 * something to switch into, or the switcher itself would be the leak §2's
 * mandatory-expiry rule exists to prevent. Sorted oldest-grant-first for a
 * stable, predictable render order, the same convention `accessLogForOwner`
 * already uses.
 * ------------------------------------------------------------------ */

/** Every ward this guardian may currently act as. */
export function listActiveGuardianshipsFor(
  grants: readonly GuardianshipGrant[],
  guardianId: string,
  now: string,
): readonly GuardianshipGrant[] {
  return grants
    .filter((grant) => grant.guardianId === guardianId && isGuardianshipActive(grant, now))
    .toSorted((a, b) => a.grantedAt.localeCompare(b.grantedAt));
}

/**
 * Every granter this delegate may currently act as. Each grant still carries
 * its own `scopes` — the switcher shows *what* the delegate may do once
 * switched in, not merely *that* they may switch, so booking an appointment
 * for someone who only granted `VIEW_RECORD` still needs `hasScope` checked
 * afterwards; this function only answers "who," not "what."
 */
export function listActiveDelegationsFor(
  grants: readonly DelegationGrant[],
  delegateId: string,
  now: string,
): readonly DelegationGrant[] {
  return grants
    .filter((grant) => grant.delegateId === delegateId && isDelegationActive(grant, now))
    .toSorted((a, b) => a.grantedAt.localeCompare(b.grantedAt));
}

/* ------------------------------------------------------------------ *
 * Family history and explicit condition sharing (family-and-proxy.md §5)
 *
 * "The wrong design: a shared family health graph where the grandmother's
 * diagnoses automatically appear on her descendants' records." §5's fix is
 * two deliberately separate mechanisms, mirroring guardianship-versus-
 * delegation above: no shared base type, no function that accepts either
 * interchangeably, because collapsing them is exactly the failure this
 * section exists to prevent ("reported by you" and "shared by your
 * grandmother" are different claims with different evidentiary weight).
 *
 * `FamilyHistoryAssertion` is the granddaughter's own statement, living on
 * her own record — it never reads from the grandmother's record and does
 * not require the grandmother to be a Mero Health user at all.
 * `ConditionShare` is the opposite direction: the grandmother, who does
 * have an account and does have the diagnosis, explicitly grants one named
 * relative visibility of that one condition. Neither is built on top of
 * `DelegationGrant` — §5 is explicit that `ASK_ASSISTANT` access "does not
 * entitle anyone to a genetic finding," so nothing here reads `scopes` or
 * calls `hasScope`.
 * ------------------------------------------------------------------ */

/**
 * Free text, not a closed enum. §5's own example is a single illustration
 * ("MATERNAL_GRANDMOTHER"), not an exhaustive list the way §3's four
 * `ConsentMethod` values are — inventing a full kinship taxonomy the design
 * doc never enumerated would be the same fabricated precision that section's
 * own comment already rules out, just in the opposite direction (there, too
 * few values would be wrong; here, a closed set at all would be).
 */
export type FamilialRelation = string;

/**
 * The granddaughter's own statement about her family, held on her own
 * record. Constructible only through `assertFamilyHistory` below — every
 * field that could otherwise be mistaken for a clinical fact about the
 * relative is fixed rather than caller-supplied: `provenance` is always
 * `PATIENT_REPORTED` (this mechanism has no clinician-authored path — §5's
 * worked example is deliberately "exactly how family history is taken in a
 * clinic," i.e. asked of the patient, never pulled from the relative's own
 * chart), and `sensitivity` is always `RESTRICTED` (§5's rule, not a
 * judgement call left to the caller).
 */
export interface FamilyHistoryAssertion {
  id: string;
  /** Whose record this lives on — the person making the statement. Never the relative it is about. */
  subjectId: string;
  relation: FamilialRelation;
  /**
   * Free text, the same unstructured-label convention
   * `MedicationSafetyFinding.detail` and `ClinicalSummaryItem.label` already
   * use elsewhere in this codebase for clinical text with no coded system
   * behind it yet.
   */
  condition: string;
  /** Approximate, as reported ("60s", "mid-40s") — never a precise age nobody actually confirmed. Null when not given. */
  onsetAgeApprox: string | null;
  provenance: 'PATIENT_REPORTED';
  sensitivity: 'RESTRICTED';
  recordedAt: string;
}

/**
 * Records a family history assertion on the asking person's own record.
 * Pure and total — there is no invariant here to violate the way self-
 * delegation or an empty scope set are, because a `subjectId` stating
 * something about a `relation` that is free text has nothing to compare
 * against itself.
 */
export function assertFamilyHistory(
  id: string,
  subjectId: string,
  relation: FamilialRelation,
  condition: string,
  onsetAgeApprox: string | null,
  recordedAt: string,
): FamilyHistoryAssertion {
  return {
    id,
    subjectId,
    relation,
    condition,
    onsetAgeApprox,
    provenance: 'PATIENT_REPORTED',
    sensitivity: 'RESTRICTED',
    recordedAt,
  };
}

/**
 * §5's other half: the person who actually has the diagnosis chooses to
 * share that one named condition with one named relative. Narrow (one
 * condition, one recipient — sharing with several relatives means several
 * `ConditionShare`s, the same one-delegate-per-grant shape `DelegationGrant`
 * already uses) and revocable. There is deliberately no `expiresAt`: unlike
 * guardianship and delegation, §5 never says this needs a mandatory
 * duration, and inventing one here would add a constraint the design doc
 * does not state.
 */
export interface ConditionShare {
  id: string;
  /** Whose diagnosis this is — the person sharing it. */
  ownerId: string;
  /** The one named relative granted visibility. */
  sharedWithId: string;
  /** Free text, same convention as `FamilyHistoryAssertion.condition`. */
  condition: string;
  sharedAt: string;
  /** Null while active. Revocation is permanent, same as `DelegationGrant.revokedAt`. */
  revokedAt: string | null;
  sensitivity: 'RESTRICTED';
}

export class SelfConditionShareError extends Error {
  constructor(ownerId: string) {
    super(`${ownerId} cannot share a condition with themself`);
    this.name = 'SelfConditionShareError';
  }
}

/** Shares one named condition with one named relative. Refuses self-sharing, the same shape `SelfDelegationError` already guards for delegation. */
export function shareCondition(
  id: string,
  ownerId: string,
  sharedWithId: string,
  condition: string,
  sharedAt: string,
): ConditionShare {
  if (ownerId === sharedWithId) throw new SelfConditionShareError(ownerId);
  return { id, ownerId, sharedWithId, condition, sharedAt, revokedAt: null, sensitivity: 'RESTRICTED' };
}

/** Idempotent, same reasoning as `revokeDelegation`. */
export function revokeConditionShare(share: ConditionShare, now: string): ConditionShare {
  return share.revokedAt === null ? { ...share, revokedAt: now } : share;
}

/** True from `sharedAt` until revoked — there is no expiry to also check, per the type's own comment. */
export function isConditionShareActive(share: ConditionShare, now: string): boolean {
  if (share.sharedAt > now) return false;
  return share.revokedAt === null || now < share.revokedAt;
}

/**
 * The read side a relative's own view would call: every condition
 * currently shared *with* her, and nothing merely delegated to her — the
 * structural proof that a share is "never implied by a delegation" is that
 * this function takes `ConditionShare[]`, not `DelegationGrant[]`, so a
 * `DelegationGrant` with every scope set still returns nothing here.
 */
export function conditionSharesVisibleTo(
  shares: readonly ConditionShare[],
  viewerId: string,
  now: string,
): readonly ConditionShare[] {
  return shares.filter((share) => share.sharedWithId === viewerId && isConditionShareActive(share, now));
}

import type { LanguageCode } from '@swasthya/shared-types';

/**
 * Nepali language corpus.
 *
 * The purpose of this package is to make it *possible* to train a Nepali
 * health model later, by capturing the consent and provenance now. It
 * deliberately contains no training code: that is a different problem, needs
 * scale this product does not yet have, and can be built at any time.
 *
 * Consent, however, cannot be built later. A conversation retained without a
 * training-use basis recorded at the moment of capture is unusable for
 * training afterwards, and no amount of subsequent engineering fixes that.
 * That asymmetry is the whole reason this exists this early.
 */

/* ------------------------------------------------------------------ *
 * Consent
 * ------------------------------------------------------------------ */

/**
 * Consent purposes are separate and independently revocable.
 *
 * `SERVICE_DELIVERY` is what makes the product work and is not optional.
 * Everything else is, and none of it may ride along on acceptance of the
 * terms of service — bundling secondary use into a terms checkbox is exactly
 * the pattern that makes a consent record worthless.
 */
export type ConsentPurpose =
  | 'SERVICE_DELIVERY'
  | 'MODEL_TRAINING_TEXT'
  | 'MODEL_TRAINING_VOICE'
  | 'HUMAN_REVIEW';

/** Purposes a person must actively opt into. Default is always off. */
export const optionalPurposes: readonly ConsentPurpose[] = [
  'MODEL_TRAINING_TEXT',
  'MODEL_TRAINING_VOICE',
  'HUMAN_REVIEW',
];

export interface ConsentGrant {
  purpose: ConsentPurpose;
  ownerId: string;
  grantedAt: string;
  /** Set the moment it is withdrawn. Never delete the row — see below. */
  revokedAt: string | null;
  /** Wording the person actually agreed to, so an old grant stays auditable. */
  policyVersion: string;
}

/**
 * Whether a grant is live at a given instant.
 *
 * Takes an explicit `at` rather than reading the clock: the same utterance is
 * evaluated at capture time and again at snapshot time, and those answers can
 * legitimately differ.
 */
export function isLive(grant: ConsentGrant, at: string): boolean {
  const t = Date.parse(at);
  if (Number.isNaN(t) || Date.parse(grant.grantedAt) > t) return false;
  return grant.revokedAt === null || Date.parse(grant.revokedAt) > t;
}

export function hasPurpose(
  grants: readonly ConsentGrant[],
  purpose: ConsentPurpose,
  at: string,
): boolean {
  return grants.some((grant) => grant.purpose === purpose && isLive(grant, at));
}

/**
 * Wording version stamped on every grant produced by the consent screen
 * (`apps/mobile`'s `app/consent.tsx`, `apps/web`'s `DataConsentView`), so a
 * grant made under today's copy stays distinguishable from one made under a
 * future rewrite — see §6 on why `policyVersion` exists on the type at all.
 */
export const CURRENT_POLICY_VERSION = 'consent-copy-v1';

/**
 * Wording version for the *Voice Contribution* consent copy —
 * `messages.voiceContribution.consent` in `apps/web` — kept separate from
 * `CURRENT_POLICY_VERSION` above because it governs a different flow.
 * `CURRENT_POLICY_VERSION` stamps `ConsentGrant`s for opting *existing*
 * health conversations into training (§4 stream B of
 * `docs/product/freemium-and-voice-corpus.md`); this stamps consent for the
 * separate, not-yet-built Common-Voice-style flow that records someone
 * reading a prompt or speaking freely, purely to train a Nepali speech
 * model (§4 stream A). Not wired into a `ConsentGrant` yet — the `/contribute`
 * page and its own API-side consent record (Round six §M's later boxes) do
 * not exist yet — but the copy needs a stable version identifier from the
 * moment it ships, per this file's own note on why consent cannot be built
 * later: a recording kept without a version-stamped basis at capture time
 * is unusable afterwards, however carefully the engineering catches up.
 */
export const VOICE_CONTRIBUTION_CONSENT_VERSION = 'voice-contribution-consent-v1';

/**
 * Grants a purpose. Building a fresh row rather than reviving a revoked one
 * keeps the history honest: a person who turns training off and back on has
 * two grants on record, not one edited row that hides the gap.
 */
export function grantConsent(purpose: ConsentPurpose, ownerId: string, now: string): ConsentGrant {
  return { purpose, ownerId, grantedAt: now, revokedAt: null, policyVersion: CURRENT_POLICY_VERSION };
}

/**
 * Revokes a purpose by setting `revokedAt` on whichever grant is currently
 * live for it — never by deleting the row, per `ConsentGrant.revokedAt`'s own
 * doc comment. A no-op when nothing is live for that purpose, since there is
 * nothing to revoke and this must stay safe to call from a toggle a person
 * can flip either direction at any time.
 */
export function revokeConsent(
  grants: readonly ConsentGrant[],
  purpose: ConsentPurpose,
  now: string,
): ConsentGrant[] {
  return grants.map((grant) =>
    grant.purpose === purpose && isLive(grant, now) ? { ...grant, revokedAt: now } : grant,
  );
}

/**
 * Which audio stream a person has opted into, per
 * `docs/product/freemium-and-voice-corpus.md` §4 — distinct from
 * `ConsentPurpose` above. That axis is *why* text/voice from an ordinary
 * health conversation may be retained once it happens; this axis is *which
 * stream* a person has opted into in the first place, before any capture
 * happens. `VOICE_CONTRIBUTION` is the separate Common-Voice-style flow
 * (§4 stream A, non-health, read prompts and free speech).
 * `HEALTH_CONVERSATION_AUDIO` is the opt-in to keep the raw recording of a
 * person's own health conversations (§4 stream B) — a materially bigger
 * commitment than `MODEL_TRAINING_VOICE` above, which only ever covers a
 * de-identified transcript, never the recording itself.
 */
export type CorpusConsentKind = 'VOICE_CONTRIBUTION' | 'HEALTH_CONVERSATION_AUDIO';

export interface CorpusConsentGrant {
  id: string;
  userId: string;
  kind: CorpusConsentKind;
  /** Wording version the person actually agreed to — see `versionForCorpusConsentKind`. */
  version: string;
  grantedAt: string;
  /** Set the moment it is withdrawn. Never delete the row — the row history is the audit trail. */
  revokedAt: string | null;
}

/**
 * Each kind is stamped against its own copy version, never a client-supplied
 * value — the same reason `VOICE_CONTRIBUTION_CONSENT_VERSION`'s own doc
 * comment gives: a recording kept without a version-stamped basis at
 * capture time is unusable afterwards, so the caller derives the version
 * from the kind rather than trusting whatever a request sends.
 */
export function versionForCorpusConsentKind(kind: CorpusConsentKind): string {
  return kind === 'VOICE_CONTRIBUTION' ? VOICE_CONTRIBUTION_CONSENT_VERSION : CURRENT_POLICY_VERSION;
}

export function isCorpusConsentLive(grant: CorpusConsentGrant, at: string): boolean {
  const t = Date.parse(at);
  if (Number.isNaN(t) || Date.parse(grant.grantedAt) > t) return false;
  return grant.revokedAt === null || Date.parse(grant.revokedAt) > t;
}

export function hasCorpusConsent(grants: readonly CorpusConsentGrant[], kind: CorpusConsentKind, at: string): boolean {
  return grants.some((grant) => grant.kind === kind && isCorpusConsentLive(grant, at));
}

/** Building a fresh row rather than reviving a revoked one keeps the history honest — same reasoning as `grantConsent` above. */
export function grantCorpusConsent(id: string, userId: string, kind: CorpusConsentKind, now: string): CorpusConsentGrant {
  return { id, userId, kind, version: versionForCorpusConsentKind(kind), grantedAt: now, revokedAt: null };
}

/**
 * Revokes a kind by setting `revokedAt` on whichever grant is currently live
 * for it — never by deleting the row. A no-op when nothing is live for that
 * kind, since there is nothing to revoke and this must stay safe to call
 * from a toggle a person can flip either direction at any time. Mirrors
 * `revokeConsent` above exactly; kept separate because it operates on
 * `kind`, not `purpose`, and the two are not interchangeable.
 */
export function revokeCorpusConsent(
  grants: readonly CorpusConsentGrant[],
  kind: CorpusConsentKind,
  now: string,
): CorpusConsentGrant[] {
  return grants.map((grant) => (grant.kind === kind && isCorpusConsentLive(grant, now) ? { ...grant, revokedAt: now } : grant));
}

/* ------------------------------------------------------------------ *
 * De-identification
 * ------------------------------------------------------------------ */

export type RedactionKind =
  | 'PHONE' | 'EMAIL' | 'CITIZENSHIP' | 'NMC_NUMBER' | 'LONG_DIGITS' | 'URL';

export interface Redaction {
  kind: RedactionKind;
  /** Character offset in the *original* text. */
  start: number;
  length: number;
}

export interface DeidentifiedText {
  text: string;
  redactions: readonly Redaction[];
  /**
   * True when nothing matched. Not a guarantee of safety — see the note on
   * `deidentify` — but useful for routing the risky ones to human review.
   */
  clean: boolean;
}

/**
 * Patterns are ordered longest-match-first so a citizenship number is not
 * partially eaten by the generic long-digit rule.
 */
const patterns: ReadonlyArray<{ kind: RedactionKind; re: RegExp }> = [
  { kind: 'EMAIL', re: /[\w.+-]+@[\w-]+\.[\w.]{2,}/g },
  { kind: 'URL', re: /https?:\/\/\S+/g },
  // Nepali citizenship certificate: 2-2-2-5 digit groups, various separators.
  { kind: 'CITIZENSHIP', re: /\b\d{2}[-/]\d{2}[-/]\d{2}[-/]\d{4,6}\b/g },
  // Nepali mobile numbers are ten digits opening 97 or 98, often with +977.
  { kind: 'PHONE', re: /(?:\+?977[-\s]?)?\b9[78]\d{8}\b/g },
  // Kathmandu-style landline: 01-XXXXXXX.
  { kind: 'PHONE', re: /\b0\d{1,2}[-\s]?\d{6,7}\b/g },
  { kind: 'NMC_NUMBER', re: /\b(?:NMC|एनएमसी)[-\s:]*\d{3,6}\b/gi },
  // Catch-all for anything long enough to be an identifier.
  { kind: 'LONG_DIGITS', re: /\b\d{7,}\b/g },
];

const placeholder: Record<RedactionKind, string> = {
  PHONE: '[फोन]',
  EMAIL: '[इमेल]',
  CITIZENSHIP: '[नागरिकता]',
  NMC_NUMBER: '[दर्ता नम्बर]',
  LONG_DIGITS: '[नम्बर]',
  URL: '[लिंक]',
};

/**
 * Removes structured identifiers from an utterance before it is retained.
 *
 * **This is not sufficient on its own and must not be treated as if it were.**
 * It catches identifiers with regular structure — phone numbers, emails,
 * citizenship numbers. It cannot catch a Nepali personal name, a village, or a
 * relationship ("मेरो बुहारी"), because those have no reliable surface form to
 * match on and a name list would be both incomplete and a privacy problem of
 * its own.
 *
 * The mitigations for that residue are human review before any corpus is used
 * and the fact that retention is opt-in in the first place — not a cleverer
 * regular expression.
 */
export function deidentify(text: string): DeidentifiedText {
  const redactions: Redaction[] = [];
  const taken: Array<[number, number]> = [];

  let out = text;

  for (const { kind, re } of patterns) {
    // Reset because these are module-level /g regexes reused across calls.
    re.lastIndex = 0;
    for (const match of text.matchAll(re)) {
      const start = match.index;
      const length = match[0].length;
      // Skip anything already covered by an earlier, more specific pattern.
      if (taken.some(([s, l]) => start < s + l && s < start + length)) continue;
      taken.push([start, length]);
      redactions.push({ kind, start, length });
    }
  }

  // Replace back-to-front so earlier offsets stay valid.
  for (const r of [...redactions].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, r.start) + placeholder[r.kind] + out.slice(r.start + r.length);
  }

  return { text: out, redactions, clean: redactions.length === 0 };
}

/* ------------------------------------------------------------------ *
 * Utterances
 * ------------------------------------------------------------------ */

/**
 * `CORRECTION` is the most valuable row in this table and the cheapest to
 * collect: the person told the assistant it had misunderstood, and rephrased.
 * That pair is a labelled example of exactly the failure the model needs to
 * learn, and the moment it happens is a natural, honest place to ask whether
 * the exchange may be kept.
 */
export type UtteranceKind = 'USER_MESSAGE' | 'CORRECTION' | 'VOICE_TRANSCRIPT';

export interface CorpusUtterance {
  id: string;
  ownerId: string;
  kind: UtteranceKind;
  /** Already de-identified. Raw text is never stored in the corpus. */
  text: string;
  locale: LanguageCode;
  capturedAt: string;
  /** What the assistant had said, for a CORRECTION. */
  precedingAssistantText: string | null;
  redactionCount: number;
  /** Cleared once a human has checked the residual-identifier risk. */
  awaitingHumanReview: boolean;
  /**
   * Set when a reviewer decides the residual risk is real and this utterance
   * must never enter a training snapshot — distinct from consent withdrawal,
   * which is the person's own decision, and from the not-yet-built erasure
   * path (agent-progress.md's language-corpus queue), which is the person's
   * own request rather than a reviewer's judgement call. Null while
   * undecided or cleared.
   */
  discardedAt: string | null;
}

export class CorpusConsentError extends Error {
  constructor(purpose: ConsentPurpose) {
    super(`No live consent for ${purpose}; refusing to retain utterance.`);
    this.name = 'CorpusConsentError';
  }
}

/**
 * Which consent purpose governs a given utterance kind. Exported so a caller
 * (the companion screen, before it ever calls `retainUtterance`) can gate on
 * the right purpose itself rather than re-deriving this mapping by hand.
 */
export function purposeForUtteranceKind(kind: UtteranceKind): ConsentPurpose {
  return kind === 'VOICE_TRANSCRIPT' ? 'MODEL_TRAINING_VOICE' : 'MODEL_TRAINING_TEXT';
}

export interface RetainInput {
  id: string;
  ownerId: string;
  kind: UtteranceKind;
  rawText: string;
  locale: LanguageCode;
  capturedAt: string;
  precedingAssistantText?: string | null;
}

/**
 * The single way an utterance enters the corpus.
 *
 * Throws rather than returning null when consent is absent: silently dropping
 * would let a caller believe capture succeeded, and a corpus that quietly
 * contains fewer rows than expected is far harder to notice than one that
 * fails loudly.
 */
export function retainUtterance(
  input: RetainInput,
  grants: readonly ConsentGrant[],
): CorpusUtterance {
  const purpose = purposeForUtteranceKind(input.kind);
  if (!hasPurpose(grants, purpose, input.capturedAt)) {
    throw new CorpusConsentError(purpose);
  }

  const { text, redactions } = deidentify(input.rawText);

  return {
    id: input.id,
    ownerId: input.ownerId,
    kind: input.kind,
    text,
    locale: input.locale,
    capturedAt: input.capturedAt,
    precedingAssistantText: input.precedingAssistantText ?? null,
    redactionCount: redactions.length,
    // Anything that carried an identifier gets a human look before use; so
    // does every voice transcript, where speech-to-text may have introduced
    // a name the text pipeline never saw.
    awaitingHumanReview: redactions.length > 0 || input.kind === 'VOICE_TRANSCRIPT',
    discardedAt: null,
  };
}

/* ------------------------------------------------------------------ *
 * Review queue
 *
 * §5: "anything that matched a pattern is held for human review before
 * use" — this is what a reviewer works through, and the two ways a review
 * can end. Deliberately the same shape as `packages/credentialing`'s own
 * queue/decision functions (queue oldest-first, a decision is a small pure
 * transition, attribution and audit logging live in the API layer that
 * calls these, not here) — reviewing an utterance for residual
 * identifiers and reviewing a council registration are different domains
 * but the same "a human must look before this is trusted" shape.
 * ------------------------------------------------------------------ */

/** Utterances still awaiting a human look, oldest capture first — so nothing waits behind one that arrived later. */
export function corpusReviewQueue(
  utterances: readonly CorpusUtterance[],
): readonly CorpusUtterance[] {
  return utterances
    .filter((utterance) => utterance.awaitingHumanReview)
    .toSorted((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

export class UtteranceNotAwaitingReviewError extends Error {
  constructor(utteranceId: string) {
    super(`Utterance ${utteranceId} is not awaiting human review`);
    this.name = 'UtteranceNotAwaitingReviewError';
  }
}

function requireAwaitingReview(utterance: CorpusUtterance): void {
  if (!utterance.awaitingHumanReview) throw new UtteranceNotAwaitingReviewError(utterance.id);
}

/** A reviewer found no residual risk: the utterance may enter a future snapshot, subject to consent still being live at that time. */
export function clearForTraining(utterance: CorpusUtterance): CorpusUtterance {
  requireAwaitingReview(utterance);
  return { ...utterance, awaitingHumanReview: false };
}

/**
 * A reviewer found a real residual identifier `deidentify` could not catch
 * (§5: "it does not catch names"). Discarding rather than re-flagging is
 * deliberate: leaving it `awaitingHumanReview` would just put it back in
 * front of the next reviewer, and the risk was already confirmed once.
 */
export function discardUtterance(utterance: CorpusUtterance, discardedAt: string): CorpusUtterance {
  requireAwaitingReview(utterance);
  return { ...utterance, awaitingHumanReview: false, discardedAt };
}

/* ------------------------------------------------------------------ *
 * Snapshots
 * ------------------------------------------------------------------ */

export interface CorpusSnapshot {
  takenAt: string;
  utterances: readonly CorpusUtterance[];
  /** Excluded counts, so a snapshot can be explained rather than just trusted. */
  excluded: {
    consentRevoked: number;
    awaitingReview: number;
    discarded: number;
    /** Removed after the snapshot was taken, by `eraseFromSnapshot` — see there. */
    erased: number;
  };
}

/**
 * Builds the exact set of utterances a training run is allowed to see.
 *
 * Consent is re-checked here, not just at capture: someone may have withdrawn
 * in between, and the withdrawal has to bite before the data is used rather
 * than after. This is also why a model version must record the snapshot it was
 * trained on — once weights exist, an utterance cannot be unlearned, so the
 * only honest guarantee is that it was still consented at the moment training
 * began.
 */
export function buildSnapshot(
  utterances: readonly CorpusUtterance[],
  grantsByOwner: ReadonlyMap<string, readonly ConsentGrant[]>,
  takenAt: string,
): CorpusSnapshot {
  let consentRevoked = 0;
  let awaitingReview = 0;
  let discarded = 0;
  const included: CorpusUtterance[] = [];

  for (const utterance of utterances) {
    const grants = grantsByOwner.get(utterance.ownerId) ?? [];
    if (!hasPurpose(grants, purposeForUtteranceKind(utterance.kind), takenAt)) {
      consentRevoked += 1;
      continue;
    }
    if (utterance.discardedAt !== null) {
      discarded += 1;
      continue;
    }
    if (utterance.awaitingHumanReview) {
      awaitingReview += 1;
      continue;
    }
    included.push(utterance);
  }

  return { takenAt, utterances: included, excluded: { consentRevoked, awaitingReview, discarded, erased: 0 } };
}

/**
 * Removes one person from a snapshot already taken — the "every derived
 * snapshot" leg of the erasure path in language-corpus.md §4. A snapshot is a
 * value here, not a store: whoever persists one (no caller does yet — see
 * `apps/api`'s language-corpus module) is responsible for calling this on
 * every snapshot it still holds and re-persisting the result, the same way
 * `utteranceIdsForOwner` hands back ids rather than deleting from a store it
 * does not own.
 *
 * This can only reach a snapshot still sitting as data. It cannot reach a
 * model already trained on one — §4 is explicit that unlearning from trained
 * weights is not possible, so a caller answering an erasure request must say
 * so truthfully rather than implying this function undoes that too.
 */
export function eraseFromSnapshot(snapshot: CorpusSnapshot, ownerId: string): CorpusSnapshot {
  const kept = snapshot.utterances.filter((utterance) => utterance.ownerId !== ownerId);
  const removed = snapshot.utterances.length - kept.length;
  if (removed === 0) return snapshot;

  return {
    ...snapshot,
    utterances: kept,
    excluded: { ...snapshot.excluded, erased: snapshot.excluded.erased + removed },
  };
}

/**
 * Everything belonging to one person, for a deletion request.
 *
 * Returns the ids rather than performing the delete: the caller owns the
 * storage, and a right-to-erasure request has to reach the corpus, any
 * derived snapshots, and the review queue — not just one table.
 */
export function utteranceIdsForOwner(
  utterances: readonly CorpusUtterance[],
  ownerId: string,
): readonly string[] {
  return utterances.filter((u) => u.ownerId === ownerId).map((u) => u.id);
}

import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  buildVoiceCorpusDatasheet,
  buildVoiceCorpusRelease,
  clearForTraining,
  corpusReviewQueue,
  ClipAlreadyResolvedError,
  deriveClipVerificationStatus,
  discardUtterance,
  DuplicateClipValidationError,
  earnsRewardMonth,
  grantCorpusConsent,
  hasCorpusConsent,
  isCorpusConsentLive,
  isDuplicateVoiceClip,
  nextClipToValidate,
  OwnClipValidationError,
  recordClipValidation,
  revokeCorpusConsent,
  UtteranceNotAwaitingReviewError,
  utteranceIdsForOwner,
  validateVoiceClipDuration,
  VOICE_CONTRIBUTION_CONSENT_VERSION,
  type ClipValidation,
  type ClipValidationVerdict,
  type ClipVerificationStatus,
  type CorpusConsentGrant,
  type CorpusConsentKind,
  type CorpusUtterance,
  type VoiceClip,
  type VoiceClipSelfReport,
  type VoiceContributionTaskKind,
  type VoiceCorpusDatasheet,
  type VoiceCorpusRelease,
} from '@swasthya/language-corpus';
import type { DocumentBlob, HealthDocumentStore } from '@swasthya/storage-adapters';
import { SUBSCRIPTION_GRANT_STORE, type SubscriptionGrantStore } from '../entitlements/subscription-grant.store.js';
import { LanguageCorpusRepository, type CorpusAuditEntry } from './language-corpus.repository.js';

/** DI token for the Voice Contribution audio store — bound to a concrete adapter in LanguageCorpusModule. */
export const VOICE_CLIP_AUDIO_STORE = 'VOICE_CLIP_AUDIO_STORE';

export interface IngestUtteranceInput {
  id: string;
  ownerId: string;
  kind: CorpusUtterance['kind'];
  text: string;
  locale: CorpusUtterance['locale'];
  capturedAt: string;
  precedingAssistantText: string | null;
  redactionCount: number;
  awaitingHumanReview: boolean;
}

export interface SubmitVoiceClipInput {
  id: string;
  contributorId: string;
  taskId: string;
  taskKind: VoiceContributionTaskKind;
  selfReport: VoiceClipSelfReport;
  device: string;
  durationMs: number;
  bytes: Buffer;
  contentType: string;
}

@Injectable()
export class LanguageCorpusService {
  private readonly logger = new Logger(LanguageCorpusService.name);

  constructor(
    private readonly repository: LanguageCorpusRepository,
    @Inject(VOICE_CLIP_AUDIO_STORE) private readonly audioStore: HealthDocumentStore,
    @Inject(SUBSCRIPTION_GRANT_STORE) private readonly subscriptionGrants: SubscriptionGrantStore,
  ) {}

  /**
   * Stores an utterance already produced by `retainUtterance` — consent
   * gating and de-identification happen wherever the utterance was
   * captured (today, `apps/mobile`'s companion, per
   * `packages/language-corpus`'s own doc comment on why that logic lives in
   * a shared package rather than here). This endpoint's job is narrower:
   * persist what was already retained so the review queue below has
   * something to work through. `discardedAt` is always `null` on ingest —
   * only a reviewer decision sets it.
   */
  ingest(input: IngestUtteranceInput): CorpusUtterance {
    return this.repository.save({ ...input, discardedAt: null });
  }

  queue(): readonly CorpusUtterance[] {
    return corpusReviewQueue(this.repository.list());
  }

  /**
   * A reviewer opens one utterance to read its de-identified text.
   * language-corpus.md §5's mitigations only hold if that reading is
   * actually accountable, so this is the one place in this module that
   * hands the text to a caller, and the one place that has to log it.
   */
  read(utteranceId: string, reviewerId: string): CorpusUtterance {
    const utterance = this.#require(utteranceId);
    this.#audit(utteranceId, reviewerId, 'UTTERANCE_READ');
    return utterance;
  }

  clear(utteranceId: string, reviewerId: string): CorpusUtterance {
    const cleared = this.repository.save(
      this.#runTransition(() => clearForTraining(this.#require(utteranceId))),
    );
    this.#audit(utteranceId, reviewerId, 'UTTERANCE_CLEARED');
    return cleared;
  }

  discard(utteranceId: string, reviewerId: string): CorpusUtterance {
    const discarded = this.repository.save(
      this.#runTransition(() => discardUtterance(this.#require(utteranceId), new Date().toISOString())),
    );
    this.#audit(utteranceId, reviewerId, 'UTTERANCE_DISCARDED');
    return discarded;
  }

  /**
   * A person's right-to-erasure request (language-corpus.md §4, the
   * "unlearning problem"). `utteranceIdsForOwner` names what belongs to
   * them; deleting those rows reaches the corpus and, because
   * `corpusReviewQueue` above is a filter over the same repository rather
   * than a separate store, the review queue for free. It does **not** reach
   * a training snapshot, because nothing in this repository persists one
   * yet — `buildSnapshot` is called on demand, nowhere, today — and it
   * cannot reach a model already trained on one, because §4 is explicit
   * that trained weights cannot be unlearned from. Both are true today
   * without this function lying about either: there is no snapshot to miss
   * and no model that exists to have trained on this person's data. The
   * moment a snapshot store exists, its owner must call
   * `eraseFromSnapshot` here too, per that function's own doc comment.
   *
   * The controller now gates this behind `SessionAuthGuard` and checks the
   * path `ownerId` against the caller's verified `subjectId` before this is
   * ever called — the same shape `RecordsController`'s cross-owner fix
   * required. `ingest` carries the same `SessionAuthGuard` now too, sourcing
   * `ownerId` from the session rather than the request body, the same shape
   * `RecordsController.capture`'s `captureSchema` uses.
   */
  erase(ownerId: string): { erasedUtteranceIds: readonly string[] } {
    const ids = utteranceIdsForOwner(this.repository.list(), ownerId);
    const erasedUtteranceIds = this.repository.deleteMany(ids);

    const occurredAt = new Date().toISOString();
    for (const utteranceId of erasedUtteranceIds) {
      this.repository.appendAuditEntry({
        id: randomUUID(),
        utteranceId,
        actorId: ownerId,
        actorRole: 'DATA_SUBJECT',
        action: 'UTTERANCE_ERASED',
        occurredAt,
      });
    }

    return { erasedUtteranceIds };
  }

  /**
   * A contributor's Voice Contribution right-to-erasure request — separate
   * from `erase` above because Voice Contribution clips (§4 stream A) are a
   * distinct pipeline with its own storage (`audioStore`), not the
   * repository-only `#utterances` map that method covers. Deletes the audio
   * bytes before the metadata row, not after: if this is interrupted between
   * the two, a retry re-lists the same still-present row and safely deletes
   * the (already-gone) bytes again, whereas deleting the row first and then
   * losing the bytes step would leak storage nothing can find its way back
   * to. `LanguageCorpusRepository.deleteVoiceClipsFor`'s own doc comment
   * covers the second half — the metadata and validation rows.
   */
  async eraseVoiceClips(contributorId: string): Promise<{ erasedClipIds: readonly string[] }> {
    const clips = this.repository.voiceClipsByContributor(contributorId);
    for (const clip of clips) {
      await this.audioStore.delete(clip.ref);
    }
    const erased = this.repository.deleteVoiceClipsFor(contributorId);
    return { erasedClipIds: erased.map((clip) => clip.id) };
  }

  /**
   * Round six §M's Release tooling box — "versioned export + datasheet."
   * Built on demand from the repository's live state, never persisted here:
   * a clip already erased by `eraseVoiceClips` above is already absent from
   * `listVoiceClips()` by the time this runs, so deletion is honoured by
   * construction — this method needs no knowledge that an erasure happened.
   * `buildVoiceCorpusRelease`'s own doc comment covers the harder case, a
   * release already handed to a training pipeline before an erasure request
   * arrives, which is why `eraseFromVoiceCorpusRelease` exists as a pure
   * function ready for whichever future release *store* needs it.
   */
  buildRelease(version: string, releasedAt: string): VoiceCorpusRelease {
    return buildVoiceCorpusRelease(this.repository.listVoiceClips(), this.repository.clipValidationsByClip(), version, releasedAt);
  }

  /** The datasheet §4 requires alongside every release — "who, where, how consented, known gaps" — computed from the release `buildRelease` just built. */
  datasheet(release: VoiceCorpusRelease): VoiceCorpusDatasheet {
    return buildVoiceCorpusDatasheet(release);
  }

  /** The accountability trail §5 depends on: who read this utterance and who decided it, and when. */
  auditLog(utteranceId: string): readonly CorpusAuditEntry[] {
    this.#require(utteranceId);
    return this.repository.listAuditEntries(utteranceId);
  }

  /** Every corpus-consent grant for this user, live or revoked — the full history is the audit trail (see the repository's own doc comment on why). */
  consentGrantsFor(userId: string): readonly CorpusConsentGrant[] {
    return this.repository.consentGrantsFor(userId);
  }

  /**
   * Idempotent: a second grant call while one is already live returns the
   * existing row rather than creating a duplicate, the same "check live
   * before adding" rule `apps/web`'s `DataConsentView` already applies
   * client-side for `packages/language-corpus`'s other `ConsentGrant`.
   */
  grantConsent(userId: string, kind: CorpusConsentKind): CorpusConsentGrant {
    const now = new Date().toISOString();
    const live = this.repository.consentGrantsFor(userId).find((grant) => grant.kind === kind && isCorpusConsentLive(grant, now));
    if (live) return live;
    return this.repository.saveConsentGrant(grantCorpusConsent(randomUUID(), userId, kind, now));
  }

  /** Idempotent on a kind with nothing currently live — `revokeCorpusConsent` itself is a no-op in that case, per its own doc comment. */
  revokeConsent(userId: string, kind: CorpusConsentKind): readonly CorpusConsentGrant[] {
    const now = new Date().toISOString();
    const updated = revokeCorpusConsent(this.repository.consentGrantsFor(userId), kind, now);
    for (const grant of updated) this.repository.saveConsentGrant(grant);
    return updated;
  }

  /**
   * Round six §M's third box — the `/contribute` capture endpoint.
   *
   * Ordering matters: consent and duration are checked *before* any bytes
   * reach the store, both because they are the cheap checks and because a
   * consent check has to gate storage, not merely gate whether a database
   * row later says the clip was allowed. Duplicate detection has to run
   * *after* `put`, because the checksum it compares against only exists once
   * the adapter has hashed the actual bytes (`StoredRef.checksumSha256`) —
   * on a match the just-stored object is deleted again rather than kept
   * orphaned, so a duplicate never quietly consumes storage.
   *
   * `packages/language-corpus`'s own doc comments on `validateVoiceClipDuration`
   * and `isDuplicateVoiceClip` explain why the doc's fuller quality-gate list
   * (SNR floor, silence trim, real near-duplicate *audio* similarity,
   * profanity/PII on a transcript) is not implemented here: each needs either
   * a decoded waveform (a new server-side audio dependency this box does not
   * introduce) or a draft transcript (does not exist until the ASR step,
   * Round six §M's next-but-one box). Picking those up is the next
   * `/contribute`-adjacent box's job, not silently skipped.
   */
  async submitVoiceClip(input: SubmitVoiceClipInput): Promise<VoiceClip> {
    const now = new Date().toISOString();
    if (!hasCorpusConsent(this.repository.consentGrantsFor(input.contributorId), 'VOICE_CONTRIBUTION', now)) {
      throw new ForbiddenException({
        code: 'VOICE_CONTRIBUTION_CONSENT_REQUIRED',
        message: 'No live VOICE_CONTRIBUTION consent; refusing to store a clip.',
      });
    }

    const rejection = validateVoiceClipDuration(input.durationMs);
    if (rejection) {
      throw new BadRequestException({ code: `VOICE_CLIP_${rejection}`, message: `Voice clip rejected: ${rejection}` });
    }

    const blob: DocumentBlob = { bytes: input.bytes, contentType: input.contentType, clientEncrypted: false };
    // `voice-contribution-` keeps these objects visibly distinct from
    // health-document uploads within the same bucket/owner prefix — see this
    // method's own module-level doc comment in `LanguageCorpusModule` for why
    // this reuses that store rather than a bucket of its own.
    const ref = await this.audioStore.put({
      ownerId: input.contributorId,
      filename: `voice-contribution-${input.id}.webm`,
      blob,
    });

    const existingChecksums = this.repository
      .voiceClipsByContributor(input.contributorId)
      .map((clip) => clip.ref.checksumSha256);
    if (isDuplicateVoiceClip(existingChecksums, ref.checksumSha256)) {
      await this.audioStore.delete(ref);
      throw new BadRequestException({ code: 'VOICE_CLIP_DUPLICATE', message: 'This exact recording has already been submitted.' });
    }

    return this.repository.saveVoiceClip({
      id: input.id,
      contributorId: input.contributorId,
      consentVersion: VOICE_CONTRIBUTION_CONSENT_VERSION,
      taskId: input.taskId,
      taskKind: input.taskKind,
      selfReport: input.selfReport,
      device: input.device,
      durationMs: input.durationMs,
      capturedAt: now,
      ref,
    });
  }

  /**
   * Round six §M's Validation flow box — "contributors validate others'
   * clips". Unlike `voice-contribution/clips`' own gating, this needs no
   * `VOICE_CONTRIBUTION` consent check: listening to and judging someone
   * else's already-consented clip is not itself a new act of contributing
   * one's own voice. `nextClipToValidate` already excludes the caller's own
   * clips, clips they have already voted on, and clips already resolved.
   */
  nextClipForValidation(validatorId: string): VoiceClip | null {
    return nextClipToValidate(this.repository.listVoiceClips(), this.repository.clipValidationsByClip(), validatorId);
  }

  /**
   * The clip's audio bytes, for a validator to listen to before judging.
   * Refuses a contributor's own clip with the same `OWN_CLIP_VALIDATION`
   * code `validateClip` throws below — `nextClipForValidation` never hands
   * one out, so this only bites a caller who fetched a clip id some other
   * way.
   */
  async clipAudio(clipId: string, callerId: string): Promise<DocumentBlob> {
    const clip = this.#requireVoiceClip(clipId);
    if (clip.contributorId === callerId) {
      throw new ForbiddenException({
        code: 'OWN_CLIP_VALIDATION_FORBIDDEN',
        message: 'A contributor cannot validate their own clip.',
      });
    }
    return this.audioStore.get(clip.ref);
  }

  async validateClip(
    clipId: string,
    validatorId: string,
    verdict: ClipValidationVerdict,
  ): Promise<{ validation: ClipValidation; status: ClipVerificationStatus }> {
    const clip = this.#requireVoiceClip(clipId);
    const existing = this.repository.clipValidationsFor(clipId);

    const validation = this.#runValidationTransition(() =>
      recordClipValidation(clip, existing, {
        id: randomUUID(),
        clipId,
        validatorId,
        verdict,
        validatedAt: new Date().toISOString(),
      }),
    );
    this.repository.saveClipValidation(validation);

    const status = deriveClipVerificationStatus([...existing, validation]);
    if (status === 'VERIFIED') await this.#rewardContributorIfMilestone(clip.contributorId);

    return { validation, status };
  }

  /**
   * §4's "Reward, don't coerce": every `REWARD_VERIFIED_CLIPS_PER_MONTH`th
   * verified clip earns the contributor a month of Plus, via the real
   * `Subscription` row (`SubscriptionGrantStore`) — not a flag nothing else
   * reads. Best-effort: a grant failure (the subscription store's own DB
   * down, say) must never mask that the *validation* itself already
   * succeeded — the vote is recorded either way, so this only logs.
   */
  async #rewardContributorIfMilestone(contributorId: string): Promise<void> {
    const verifiedClipCount = this.#verifiedClipCount(contributorId);
    if (!earnsRewardMonth(verifiedClipCount)) return;

    try {
      await this.subscriptionGrants.grantPlusMonths(contributorId, 1);
    } catch (error) {
      this.logger.warn(`Reward grant failed for contributor ${contributorId}: ${String(error)}`);
    }
  }

  /** Every clip this contributor has had crowd-resolved `VERIFIED` — `#rewardContributorIfMilestone`'s own trigger source. */
  #verifiedClipCount(contributorId: string): number {
    return this.repository
      .voiceClipsByContributor(contributorId)
      .filter((clip) => deriveClipVerificationStatus(this.repository.clipValidationsFor(clip.id)) === 'VERIFIED').length;
  }

  #requireVoiceClip(clipId: string): VoiceClip {
    const clip = this.repository.findVoiceClip(clipId);
    if (!clip) throw new NotFoundException(`No voice clip ${clipId}`);
    return clip;
  }

  /**
   * Maps the three `packages/language-corpus` validation errors to the
   * client-facing shape `#runTransition` below already establishes for the
   * review-queue's own domain errors: a `BadRequestException`/`ForbiddenException`
   * carrying a machine-readable `code`, not a bare 500.
   */
  #runValidationTransition(transition: () => ClipValidation): ClipValidation {
    try {
      return transition();
    } catch (error) {
      if (error instanceof OwnClipValidationError) {
        throw new ForbiddenException({ code: 'OWN_CLIP_VALIDATION_FORBIDDEN', message: error.message });
      }
      if (error instanceof ClipAlreadyResolvedError) {
        throw new BadRequestException({ code: 'CLIP_ALREADY_RESOLVED', message: error.message });
      }
      if (error instanceof DuplicateClipValidationError) {
        throw new BadRequestException({ code: 'CLIP_ALREADY_VALIDATED_BY_YOU', message: error.message });
      }
      throw error;
    }
  }

  #audit(utteranceId: string, reviewerId: string, action: CorpusAuditEntry['action']): void {
    this.repository.appendAuditEntry({
      id: randomUUID(),
      utteranceId,
      actorId: reviewerId,
      actorRole: 'CORPUS_REVIEWER',
      action,
      occurredAt: new Date().toISOString(),
    });
  }

  #require(utteranceId: string): CorpusUtterance {
    const utterance = this.repository.find(utteranceId);
    if (!utterance) throw new NotFoundException(`No corpus utterance ${utteranceId}`);
    return utterance;
  }

  /**
   * `clearForTraining`/`discardUtterance` both throw
   * `UtteranceNotAwaitingReviewError` on an utterance that isn't
   * `awaitingHumanReview` — already decided once, or never flagged for
   * review at all. Previously uncaught, that reached the client as a bare
   * 500 with no `code`, the same wrong-state-domain-error shape the
   * clinical-suite services' own `runTransition` helpers already guard
   * against.
   */
  #runTransition(transition: () => CorpusUtterance): CorpusUtterance {
    try {
      return transition();
    } catch (error) {
      if (error instanceof UtteranceNotAwaitingReviewError) {
        throw new BadRequestException({ code: error.name, message: error.message });
      }
      throw error;
    }
  }
}

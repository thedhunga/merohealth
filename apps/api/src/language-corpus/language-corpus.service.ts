import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  clearForTraining,
  corpusReviewQueue,
  discardUtterance,
  grantCorpusConsent,
  hasCorpusConsent,
  isCorpusConsentLive,
  isDuplicateVoiceClip,
  revokeCorpusConsent,
  UtteranceNotAwaitingReviewError,
  utteranceIdsForOwner,
  validateVoiceClipDuration,
  VOICE_CONTRIBUTION_CONSENT_VERSION,
  type CorpusConsentGrant,
  type CorpusConsentKind,
  type CorpusUtterance,
  type VoiceClip,
  type VoiceClipSelfReport,
  type VoiceContributionTaskKind,
} from '@swasthya/language-corpus';
import type { DocumentBlob, HealthDocumentStore } from '@swasthya/storage-adapters';
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
  constructor(
    private readonly repository: LanguageCorpusRepository,
    @Inject(VOICE_CLIP_AUDIO_STORE) private readonly audioStore: HealthDocumentStore,
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

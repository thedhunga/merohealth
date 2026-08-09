import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { clearForTraining, corpusReviewQueue, discardUtterance, type CorpusUtterance } from '@swasthya/language-corpus';
import { LanguageCorpusRepository, type CorpusAuditEntry } from './language-corpus.repository.js';

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

@Injectable()
export class LanguageCorpusService {
  constructor(private readonly repository: LanguageCorpusRepository) {}

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
    const cleared = this.repository.save(clearForTraining(this.#require(utteranceId)));
    this.#audit(utteranceId, reviewerId, 'UTTERANCE_CLEARED');
    return cleared;
  }

  discard(utteranceId: string, reviewerId: string): CorpusUtterance {
    const discarded = this.repository.save(discardUtterance(this.#require(utteranceId), new Date().toISOString()));
    this.#audit(utteranceId, reviewerId, 'UTTERANCE_DISCARDED');
    return discarded;
  }

  /** The accountability trail §5 depends on: who read this utterance and who decided it, and when. */
  auditLog(utteranceId: string): readonly CorpusAuditEntry[] {
    this.#require(utteranceId);
    return this.repository.listAuditEntries(utteranceId);
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
}

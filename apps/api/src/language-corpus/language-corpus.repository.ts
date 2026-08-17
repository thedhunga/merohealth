import { Injectable } from '@nestjs/common';
import type { ClipValidation, CorpusConsentGrant, CorpusUtterance, VoiceClip } from '@swasthya/language-corpus';

/**
 * Who touched a corpus utterance and when — language-corpus.md §5's
 * mitigations depend on human review actually happening, and an
 * accountability trail is what makes that checkable rather than asserted.
 * Kept local to `apps/api`, not `packages/language-corpus`, mirroring
 * `credentialing.repository.ts`'s own split: the domain package owns
 * whether an utterance is still awaiting review, not who looked at it or
 * when — that is a side effect of the API layer.
 */
export interface CorpusAuditEntry {
  id: string;
  utteranceId: string;
  actorId: string;
  /**
   * `DATA_SUBJECT` covers the erasure path (agent-progress.md's language
   * corpus queue): the person themselves acting on their own utterances,
   * not a reviewer acting on someone else's.
   */
  actorRole: 'CORPUS_REVIEWER' | 'DATA_SUBJECT';
  action: 'UTTERANCE_READ' | 'UTTERANCE_CLEARED' | 'UTTERANCE_DISCARDED' | 'UTTERANCE_ERASED';
  occurredAt: string;
}

/**
 * Process-local stand-in for a real store, same convention every other
 * `apps/api` repository in this codebase already uses (`RecordsRepository`,
 * `CredentialingRepository`, ...): the service/controller code above this
 * does not change once the in-memory maps are swapped for real persistence,
 * only this file does.
 */
@Injectable()
export class LanguageCorpusRepository {
  readonly #utterances = new Map<string, CorpusUtterance>();
  readonly #auditEntries: CorpusAuditEntry[] = [];
  readonly #consentGrants = new Map<string, CorpusConsentGrant>();
  readonly #voiceClips = new Map<string, VoiceClip>();
  readonly #clipValidations = new Map<string, ClipValidation>();

  save(utterance: CorpusUtterance): CorpusUtterance {
    this.#utterances.set(utterance.id, utterance);
    return utterance;
  }

  find(id: string): CorpusUtterance | null {
    return this.#utterances.get(id) ?? null;
  }

  list(): CorpusUtterance[] {
    return [...this.#utterances.values()];
  }

  /**
   * The erasure path's reach into the corpus itself: once a row is gone from
   * this map, `list()` no longer surfaces it, which is also how it stops
   * appearing in `corpusReviewQueue` — that queue is a filter over `list()`,
   * not a separate store, so there is nothing further to erase it from.
   * Returns the ids actually found, so a caller can tell erasure of an
   * already-erased or never-existed id apart from a real deletion.
   */
  deleteMany(ids: readonly string[]): readonly string[] {
    const deleted: string[] = [];
    for (const id of ids) {
      if (this.#utterances.delete(id)) deleted.push(id);
    }
    return deleted;
  }

  appendAuditEntry(entry: CorpusAuditEntry): void {
    this.#auditEntries.push(entry);
  }

  listAuditEntries(utteranceId: string): CorpusAuditEntry[] {
    return this.#auditEntries
      .filter((entry) => entry.utteranceId === utteranceId)
      .toSorted((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }

  /**
   * No separate audit-entry log for consent, unlike the utterance one above:
   * a consent grant is always acted on by the person it belongs to, never a
   * reviewer acting on someone else's data, so there is no "who else looked
   * at this" question to answer. The grant row history itself — never
   * deleted, `revokedAt` set rather than the row removed — already is the
   * audit trail, the same reasoning `CorpusConsentGrant.revokedAt`'s own doc
   * comment in `packages/language-corpus` gives.
   */
  saveConsentGrant(grant: CorpusConsentGrant): CorpusConsentGrant {
    this.#consentGrants.set(grant.id, grant);
    return grant;
  }

  consentGrantsFor(userId: string): CorpusConsentGrant[] {
    return [...this.#consentGrants.values()].filter((grant) => grant.userId === userId);
  }

  saveVoiceClip(clip: VoiceClip): VoiceClip {
    this.#voiceClips.set(clip.id, clip);
    return clip;
  }

  /** Every clip a contributor has already submitted — `submitVoiceClip`'s own source for the exact-duplicate checksum check. */
  voiceClipsByContributor(contributorId: string): VoiceClip[] {
    return [...this.#voiceClips.values()].filter((clip) => clip.contributorId === contributorId);
  }

  findVoiceClip(id: string): VoiceClip | null {
    return this.#voiceClips.get(id) ?? null;
  }

  /** Every submitted clip, regardless of contributor — `nextClipForValidation`'s own source pool. */
  listVoiceClips(): VoiceClip[] {
    return [...this.#voiceClips.values()];
  }

  saveClipValidation(validation: ClipValidation): ClipValidation {
    this.#clipValidations.set(validation.id, validation);
    return validation;
  }

  clipValidationsFor(clipId: string): ClipValidation[] {
    return [...this.#clipValidations.values()].filter((validation) => validation.clipId === clipId);
  }

  /**
   * Every clip validation, grouped by clip — `nextClipForValidation` needs
   * every clip's status at once to pick the next eligible one, so this
   * groups in one pass rather than the caller calling `clipValidationsFor`
   * once per clip.
   */
  clipValidationsByClip(): Map<string, ClipValidation[]> {
    const byClip = new Map<string, ClipValidation[]>();
    for (const validation of this.#clipValidations.values()) {
      const forClip = byClip.get(validation.clipId) ?? [];
      forClip.push(validation);
      byClip.set(validation.clipId, forClip);
    }
    return byClip;
  }
}

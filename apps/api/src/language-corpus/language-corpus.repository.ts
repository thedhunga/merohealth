import { Injectable } from '@nestjs/common';
import type { CorpusUtterance } from '@swasthya/language-corpus';

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
  actorRole: 'CORPUS_REVIEWER';
  action: 'UTTERANCE_READ' | 'UTTERANCE_CLEARED' | 'UTTERANCE_DISCARDED';
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

  appendAuditEntry(entry: CorpusAuditEntry): void {
    this.#auditEntries.push(entry);
  }

  listAuditEntries(utteranceId: string): CorpusAuditEntry[] {
    return this.#auditEntries
      .filter((entry) => entry.utteranceId === utteranceId)
      .toSorted((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }
}

import type { CorpusUtterance } from '@swasthya/language-corpus';
import { describe, expect, it } from 'vitest';
import { LanguageCorpusRepository } from './language-corpus.repository.js';

function makeUtterance(overrides: Partial<CorpusUtterance> = {}): CorpusUtterance {
  return {
    id: 'utterance-1',
    ownerId: 'owner-1',
    kind: 'USER_MESSAGE',
    text: 'फोन [फोन] मा सम्पर्क गर्नुहोस्',
    locale: 'ne',
    capturedAt: '2026-08-01T00:00:00.000Z',
    precedingAssistantText: null,
    redactionCount: 1,
    awaitingHumanReview: true,
    discardedAt: null,
    ...overrides,
  };
}

describe('LanguageCorpusRepository', () => {
  it('round-trips a saved utterance by id', () => {
    const repository = new LanguageCorpusRepository();
    repository.save(makeUtterance());

    expect(repository.find('utterance-1')?.redactionCount).toBe(1);
    expect(repository.find('missing')).toBeNull();
  });

  it('overwrites rather than duplicates on a second save with the same id', () => {
    const repository = new LanguageCorpusRepository();
    repository.save(makeUtterance({ awaitingHumanReview: true }));
    repository.save(makeUtterance({ awaitingHumanReview: false }));

    expect(repository.list()).toHaveLength(1);
    expect(repository.find('utterance-1')?.awaitingHumanReview).toBe(false);
  });

  it('scopes audit entries to the requested utterance and orders them oldest first', () => {
    const repository = new LanguageCorpusRepository();
    repository.appendAuditEntry({
      id: 'audit-2',
      utteranceId: 'utterance-1',
      actorId: 'reviewer-1',
      actorRole: 'CORPUS_REVIEWER',
      action: 'UTTERANCE_CLEARED',
      occurredAt: '2026-08-02T00:00:00.000Z',
    });
    repository.appendAuditEntry({
      id: 'audit-1',
      utteranceId: 'utterance-1',
      actorId: 'reviewer-1',
      actorRole: 'CORPUS_REVIEWER',
      action: 'UTTERANCE_READ',
      occurredAt: '2026-08-01T00:00:00.000Z',
    });
    repository.appendAuditEntry({
      id: 'audit-3',
      utteranceId: 'utterance-2',
      actorId: 'reviewer-2',
      actorRole: 'CORPUS_REVIEWER',
      action: 'UTTERANCE_READ',
      occurredAt: '2026-08-01T00:00:00.000Z',
    });

    expect(repository.listAuditEntries('utterance-1').map((entry) => entry.id)).toEqual(['audit-1', 'audit-2']);
  });

  it('deletes only the requested ids, returning the ones actually found', () => {
    const repository = new LanguageCorpusRepository();
    repository.save(makeUtterance({ id: 'a' }));
    repository.save(makeUtterance({ id: 'b' }));

    const deleted = repository.deleteMany(['a', 'missing']);

    expect(deleted).toEqual(['a']);
    expect(repository.find('a')).toBeNull();
    expect(repository.find('b')).not.toBeNull();
  });
});

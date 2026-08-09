import { NotFoundException } from '@nestjs/common';
import { UtteranceNotAwaitingReviewError } from '@swasthya/language-corpus';
import { describe, expect, it } from 'vitest';
import { LanguageCorpusRepository } from './language-corpus.repository.js';
import { LanguageCorpusService, type IngestUtteranceInput } from './language-corpus.service.js';

const validIngest: IngestUtteranceInput = {
  id: 'utterance-1',
  ownerId: 'owner-1',
  kind: 'USER_MESSAGE',
  text: 'फोन [फोन] मा सम्पर्क गर्नुहोस्',
  locale: 'ne',
  capturedAt: '2026-08-01T00:00:00.000Z',
  precedingAssistantText: null,
  redactionCount: 1,
  awaitingHumanReview: true,
};

function buildService() {
  return new LanguageCorpusService(new LanguageCorpusRepository());
}

describe('LanguageCorpusService ingest', () => {
  it('stores an already-retained utterance', () => {
    const service = buildService();
    const stored = service.ingest(validIngest);

    expect(stored.id).toBe('utterance-1');
    expect(stored.discardedAt).toBeNull();
  });
});

describe('LanguageCorpusService reviewer actions', () => {
  it('lists only utterances awaiting review, oldest first', () => {
    const service = buildService();
    service.ingest({ ...validIngest, id: 'a', capturedAt: '2026-08-02T00:00:00.000Z' });
    service.ingest({ ...validIngest, id: 'b', capturedAt: '2026-08-01T00:00:00.000Z' });
    service.ingest({ ...validIngest, id: 'c', awaitingHumanReview: false });

    expect(service.queue().map((u) => u.id)).toEqual(['b', 'a']);
  });

  it('logs an UTTERANCE_READ entry, attributed to the reviewer, when an utterance is opened', () => {
    const service = buildService();
    service.ingest(validIngest);

    service.read('utterance-1', 'reviewer-1');

    const log = service.auditLog('utterance-1');
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: 'UTTERANCE_READ', actorId: 'reviewer-1', actorRole: 'CORPUS_REVIEWER' });
  });

  it('clears an utterance for training, attributing the decision', () => {
    const service = buildService();
    service.ingest(validIngest);

    const cleared = service.clear('utterance-1', 'reviewer-1');

    expect(cleared.awaitingHumanReview).toBe(false);
    expect(service.queue()).toHaveLength(0);
    expect(service.auditLog('utterance-1').map((entry) => entry.action)).toEqual(['UTTERANCE_CLEARED']);
  });

  it('discards an utterance, stamping discardedAt and attributing the decision', () => {
    const service = buildService();
    service.ingest(validIngest);

    const discarded = service.discard('utterance-1', 'reviewer-1');

    expect(discarded.awaitingHumanReview).toBe(false);
    expect(discarded.discardedAt).not.toBeNull();
    expect(service.auditLog('utterance-1').map((entry) => entry.action)).toEqual(['UTTERANCE_DISCARDED']);
  });

  it('refuses to decide an utterance not awaiting review', () => {
    const service = buildService();
    service.ingest({ ...validIngest, awaitingHumanReview: false });

    expect(() => service.clear('utterance-1', 'reviewer-1')).toThrow(UtteranceNotAwaitingReviewError);
    expect(() => service.discard('utterance-1', 'reviewer-1')).toThrow(UtteranceNotAwaitingReviewError);
  });

  it('404s reviewer actions against an unknown utterance', () => {
    const service = buildService();
    expect(() => service.read('missing', 'reviewer-1')).toThrow(NotFoundException);
    expect(() => service.clear('missing', 'reviewer-1')).toThrow(NotFoundException);
    expect(() => service.discard('missing', 'reviewer-1')).toThrow(NotFoundException);
    expect(() => service.auditLog('missing')).toThrow(NotFoundException);
  });
});

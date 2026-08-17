import { BadRequestException, NotFoundException } from '@nestjs/common';
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

  it('refuses to decide an utterance not awaiting review, as a 400 with a code', () => {
    const service = buildService();
    service.ingest({ ...validIngest, id: 'a', awaitingHumanReview: false });
    service.ingest({ ...validIngest, id: 'b', awaitingHumanReview: false });

    try {
      service.clear('a', 'reviewer-1');
      expect.unreachable('expected clear to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'UtteranceNotAwaitingReviewError' });
    }

    try {
      service.discard('b', 'reviewer-1');
      expect.unreachable('expected discard to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'UtteranceNotAwaitingReviewError' });
    }
  });

  it('404s reviewer actions against an unknown utterance', () => {
    const service = buildService();
    expect(() => service.read('missing', 'reviewer-1')).toThrow(NotFoundException);
    expect(() => service.clear('missing', 'reviewer-1')).toThrow(NotFoundException);
    expect(() => service.discard('missing', 'reviewer-1')).toThrow(NotFoundException);
    expect(() => service.auditLog('missing')).toThrow(NotFoundException);
  });
});

describe('LanguageCorpusService erase', () => {
  it('removes every utterance belonging to the owner, leaving others untouched', () => {
    const service = buildService();
    service.ingest({ ...validIngest, id: 'a', ownerId: 'owner-1' });
    service.ingest({ ...validIngest, id: 'b', ownerId: 'owner-2' });
    service.ingest({ ...validIngest, id: 'c', ownerId: 'owner-1' });

    const { erasedUtteranceIds } = service.erase('owner-1');

    expect(erasedUtteranceIds).toEqual(['a', 'c']);
    expect(() => service.read('a', 'reviewer-1')).toThrow(NotFoundException);
    expect(service.read('b', 'reviewer-1').ownerId).toBe('owner-2');
  });

  it('also removes an erased owner’s utterances from the review queue', () => {
    const service = buildService();
    service.ingest({ ...validIngest, id: 'a', ownerId: 'owner-1' });

    service.erase('owner-1');

    expect(service.queue()).toHaveLength(0);
  });

  it('attributes the deletion to the data subject, distinct from a reviewer decision', () => {
    // Audit entries outlive the utterance they describe — `auditLog(id)`
    // requires the utterance to still exist, same as every other route
    // keyed on an id, so the repository is inspected directly here rather
    // than through that method.
    const repository = new LanguageCorpusRepository();
    const service = new LanguageCorpusService(repository);
    service.ingest({ ...validIngest, id: 'a', ownerId: 'owner-1' });

    service.erase('owner-1');

    expect(repository.listAuditEntries('a')).toMatchObject([
      { action: 'UTTERANCE_ERASED', actorId: 'owner-1', actorRole: 'DATA_SUBJECT' },
    ]);
  });

  it('is a no-op for an owner with nothing in the corpus', () => {
    const service = buildService();
    expect(service.erase('nobody-here').erasedUtteranceIds).toEqual([]);
  });
});

describe('LanguageCorpusService corpus consent', () => {
  it('grants a kind, stamped with the version for that kind', () => {
    const service = buildService();

    const grant = service.grantConsent('owner-1', 'VOICE_CONTRIBUTION');

    expect(grant.userId).toBe('owner-1');
    expect(grant.kind).toBe('VOICE_CONTRIBUTION');
    expect(grant.version).toBe('voice-contribution-consent-v1');
    expect(grant.revokedAt).toBeNull();
    expect(service.consentGrantsFor('owner-1')).toEqual([grant]);
  });

  it('is idempotent — granting an already-live kind returns the existing row rather than a duplicate', () => {
    const service = buildService();

    const first = service.grantConsent('owner-1', 'HEALTH_CONVERSATION_AUDIO');
    const second = service.grantConsent('owner-1', 'HEALTH_CONVERSATION_AUDIO');

    expect(second).toEqual(first);
    expect(service.consentGrantsFor('owner-1')).toHaveLength(1);
  });

  it('revokes the live grant for a kind without touching another kind or another user', () => {
    const service = buildService();
    service.grantConsent('owner-1', 'VOICE_CONTRIBUTION');
    service.grantConsent('owner-1', 'HEALTH_CONVERSATION_AUDIO');
    service.grantConsent('owner-2', 'HEALTH_CONVERSATION_AUDIO');

    service.revokeConsent('owner-1', 'HEALTH_CONVERSATION_AUDIO');

    const grants = service.consentGrantsFor('owner-1');
    expect(grants.find((g) => g.kind === 'HEALTH_CONVERSATION_AUDIO')?.revokedAt).not.toBeNull();
    expect(grants.find((g) => g.kind === 'VOICE_CONTRIBUTION')?.revokedAt).toBeNull();
    expect(service.consentGrantsFor('owner-2')[0]?.revokedAt).toBeNull();
  });

  it('is a no-op to revoke a kind that was never granted', () => {
    const service = buildService();
    expect(service.revokeConsent('owner-1', 'VOICE_CONTRIBUTION')).toEqual([]);
  });

  it('keeps a revoked grant in consentGrantsFor rather than deleting it — the audit trail', () => {
    const service = buildService();
    const granted = service.grantConsent('owner-1', 'HEALTH_CONVERSATION_AUDIO');

    service.revokeConsent('owner-1', 'HEALTH_CONVERSATION_AUDIO');

    const grants = service.consentGrantsFor('owner-1');
    expect(grants).toHaveLength(1);
    expect(grants[0]?.id).toBe(granted.id);
    expect(grants[0]?.revokedAt).not.toBeNull();
  });

  it('re-granting after a revoke creates a fresh row rather than reviving the old one', () => {
    const service = buildService();
    const first = service.grantConsent('owner-1', 'VOICE_CONTRIBUTION');
    service.revokeConsent('owner-1', 'VOICE_CONTRIBUTION');

    const second = service.grantConsent('owner-1', 'VOICE_CONTRIBUTION');

    expect(second.id).not.toBe(first.id);
    expect(service.consentGrantsFor('owner-1')).toHaveLength(2);
  });
});

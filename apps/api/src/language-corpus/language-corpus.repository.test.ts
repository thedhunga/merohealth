import type { ClipValidation, CorpusConsentGrant, CorpusUtterance, VoiceClip } from '@swasthya/language-corpus';
import { describe, expect, it } from 'vitest';
import { LanguageCorpusRepository } from './language-corpus.repository.js';

function makeClipValidation(overrides: Partial<ClipValidation> = {}): ClipValidation {
  return {
    id: 'validation-1',
    clipId: 'clip-1',
    validatorId: 'validator-1',
    verdict: 'RIGHT',
    validatedAt: '2026-08-17T00:00:00.000Z',
    ...overrides,
  };
}

function makeConsentGrant(overrides: Partial<CorpusConsentGrant> = {}): CorpusConsentGrant {
  return {
    id: 'consent-1',
    userId: 'owner-1',
    kind: 'HEALTH_CONVERSATION_AUDIO',
    version: 'consent-copy-v1',
    grantedAt: '2026-08-01T00:00:00.000Z',
    revokedAt: null,
    ...overrides,
  };
}

function makeVoiceClip(overrides: Partial<VoiceClip> = {}): VoiceClip {
  return {
    id: 'clip-1',
    contributorId: 'owner-1',
    consentVersion: 'voice-contribution-consent-v1',
    taskId: 'free-speech-dal',
    taskKind: 'FREE_SPEECH',
    selfReport: { district: 'Kathmandu', motherTongue: 'NEPALI', ageBand: '25_34', gender: null },
    device: 'test-agent',
    durationMs: 4_000,
    capturedAt: '2026-08-17T00:00:00.000Z',
    ref: { backend: 'HOSTED', externalId: 'owner-1/clip-1.webm', byteSize: 1024, contentType: 'audio/webm', checksumSha256: 'abc' },
    ...overrides,
  };
}

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

  it('scopes consentGrantsFor to the requested user, never returning another user’s grants', () => {
    const repository = new LanguageCorpusRepository();
    repository.saveConsentGrant(makeConsentGrant({ id: 'consent-1', userId: 'owner-1' }));
    repository.saveConsentGrant(makeConsentGrant({ id: 'consent-2', userId: 'owner-2' }));

    expect(repository.consentGrantsFor('owner-1').map((grant) => grant.id)).toEqual(['consent-1']);
    expect(repository.consentGrantsFor('someone-else')).toEqual([]);
  });

  it('overwrites rather than duplicates a consent grant on a second save with the same id', () => {
    const repository = new LanguageCorpusRepository();
    repository.saveConsentGrant(makeConsentGrant({ id: 'consent-1', revokedAt: null }));
    repository.saveConsentGrant(makeConsentGrant({ id: 'consent-1', revokedAt: '2026-08-05T00:00:00.000Z' }));

    expect(repository.consentGrantsFor('owner-1')).toHaveLength(1);
    expect(repository.consentGrantsFor('owner-1')[0]?.revokedAt).toBe('2026-08-05T00:00:00.000Z');
  });

  it('scopes voiceClipsByContributor to the requested contributor, never returning someone else’s clips', () => {
    const repository = new LanguageCorpusRepository();
    repository.saveVoiceClip(makeVoiceClip({ id: 'clip-1', contributorId: 'owner-1' }));
    repository.saveVoiceClip(makeVoiceClip({ id: 'clip-2', contributorId: 'owner-2' }));

    expect(repository.voiceClipsByContributor('owner-1').map((clip) => clip.id)).toEqual(['clip-1']);
    expect(repository.voiceClipsByContributor('someone-else')).toEqual([]);
  });

  it('overwrites rather than duplicates a voice clip on a second save with the same id', () => {
    const repository = new LanguageCorpusRepository();
    repository.saveVoiceClip(makeVoiceClip({ id: 'clip-1', durationMs: 4_000 }));
    repository.saveVoiceClip(makeVoiceClip({ id: 'clip-1', durationMs: 5_000 }));

    expect(repository.voiceClipsByContributor('owner-1')).toHaveLength(1);
    expect(repository.voiceClipsByContributor('owner-1')[0]?.durationMs).toBe(5_000);
  });

  it('finds a voice clip by id, regardless of contributor', () => {
    const repository = new LanguageCorpusRepository();
    repository.saveVoiceClip(makeVoiceClip({ id: 'clip-1' }));

    expect(repository.findVoiceClip('clip-1')?.id).toBe('clip-1');
    expect(repository.findVoiceClip('missing')).toBeNull();
  });

  it('lists every voice clip across all contributors', () => {
    const repository = new LanguageCorpusRepository();
    repository.saveVoiceClip(makeVoiceClip({ id: 'clip-1', contributorId: 'owner-1' }));
    repository.saveVoiceClip(makeVoiceClip({ id: 'clip-2', contributorId: 'owner-2' }));

    expect(repository.listVoiceClips().map((clip) => clip.id).toSorted()).toEqual(['clip-1', 'clip-2']);
  });

  it('scopes clipValidationsFor to the requested clip', () => {
    const repository = new LanguageCorpusRepository();
    repository.saveClipValidation(makeClipValidation({ id: 'v1', clipId: 'clip-1' }));
    repository.saveClipValidation(makeClipValidation({ id: 'v2', clipId: 'clip-2' }));

    expect(repository.clipValidationsFor('clip-1').map((validation) => validation.id)).toEqual(['v1']);
    expect(repository.clipValidationsFor('missing')).toEqual([]);
  });

  it('groups every clip validation by clip', () => {
    const repository = new LanguageCorpusRepository();
    repository.saveClipValidation(makeClipValidation({ id: 'v1', clipId: 'clip-1', validatorId: 'a' }));
    repository.saveClipValidation(makeClipValidation({ id: 'v2', clipId: 'clip-1', validatorId: 'b' }));
    repository.saveClipValidation(makeClipValidation({ id: 'v3', clipId: 'clip-2', validatorId: 'a' }));

    const byClip = repository.clipValidationsByClip();

    expect(byClip.get('clip-1')?.map((validation) => validation.id).toSorted()).toEqual(['v1', 'v2']);
    expect(byClip.get('clip-2')?.map((validation) => validation.id)).toEqual(['v3']);
  });
});

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { REWARD_VERIFIED_CLIPS_PER_MONTH } from '@swasthya/language-corpus';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { InMemorySubscriptionGrantStore } from '../entitlements/in-memory-subscription-grant.store.js';
import { LanguageCorpusRepository } from './language-corpus.repository.js';
import { LanguageCorpusService, type IngestUtteranceInput, type SubmitVoiceClipInput } from './language-corpus.service.js';

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

function buildService(subscriptionGrants = new InMemorySubscriptionGrantStore()) {
  return new LanguageCorpusService(new LanguageCorpusRepository(), new InMemoryDocumentStore('HOSTED'), subscriptionGrants);
}

const validClip: SubmitVoiceClipInput = {
  id: 'clip-1',
  contributorId: 'owner-1',
  taskId: 'free-speech-village',
  taskKind: 'FREE_SPEECH',
  selfReport: { district: 'Kathmandu', motherTongue: 'NEPALI', ageBand: '25_34', gender: null },
  device: 'test-agent',
  durationMs: 4_000,
  bytes: Buffer.from('clip bytes'),
  contentType: 'audio/webm',
};

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
    const service = new LanguageCorpusService(repository, new InMemoryDocumentStore('HOSTED'), new InMemorySubscriptionGrantStore());
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

describe('LanguageCorpusService submitVoiceClip', () => {
  it('refuses to store a clip with no live VOICE_CONTRIBUTION consent', async () => {
    const service = buildService();
    await expect(service.submitVoiceClip(validClip)).rejects.toThrow(ForbiddenException);
  });

  it('stores a clip once consent is live, stamped with the Voice Contribution consent version', async () => {
    const service = buildService();
    service.grantConsent('owner-1', 'VOICE_CONTRIBUTION');

    const clip = await service.submitVoiceClip(validClip);

    expect(clip.id).toBe('clip-1');
    expect(clip.consentVersion).toBe('voice-contribution-consent-v1');
    expect(clip.ref.byteSize).toBe(validClip.bytes.byteLength);
  });

  it('rejects a clip below the minimum duration without storing it', async () => {
    const service = buildService();
    service.grantConsent('owner-1', 'VOICE_CONTRIBUTION');

    await expect(service.submitVoiceClip({ ...validClip, durationMs: 100 })).rejects.toThrow(BadRequestException);
  });

  it('rejects a clip above the maximum duration', async () => {
    const service = buildService();
    service.grantConsent('owner-1', 'VOICE_CONTRIBUTION');

    await expect(service.submitVoiceClip({ ...validClip, durationMs: 120_000 })).rejects.toThrow(BadRequestException);
  });

  it('rejects a byte-identical re-submission from the same contributor', async () => {
    const service = buildService();
    service.grantConsent('owner-1', 'VOICE_CONTRIBUTION');
    await service.submitVoiceClip(validClip);

    await expect(service.submitVoiceClip({ ...validClip, id: 'clip-2' })).rejects.toThrow(BadRequestException);
  });

  it('does not treat the same bytes from a different contributor as a duplicate', async () => {
    const service = buildService();
    service.grantConsent('owner-1', 'VOICE_CONTRIBUTION');
    service.grantConsent('owner-2', 'VOICE_CONTRIBUTION');
    await service.submitVoiceClip(validClip);

    const secondContributorClip = await service.submitVoiceClip({ ...validClip, id: 'clip-2', contributorId: 'owner-2' });
    expect(secondContributorClip.id).toBe('clip-2');
  });
});

describe('LanguageCorpusService clip validation', () => {
  async function buildServiceWithOneClip() {
    const service = buildService();
    service.grantConsent('owner-1', 'VOICE_CONTRIBUTION');
    const clip = await service.submitVoiceClip(validClip);
    return { service, clip };
  }

  it('offers the clip to a different validator', async () => {
    const { service, clip } = await buildServiceWithOneClip();
    expect(service.nextClipForValidation('validator-1')?.id).toBe(clip.id);
  });

  it('never offers a contributor their own clip', async () => {
    const { service } = await buildServiceWithOneClip();
    expect(service.nextClipForValidation('owner-1')).toBeNull();
  });

  it('reports null when nothing is eligible', () => {
    const service = buildService();
    expect(service.nextClipForValidation('validator-1')).toBeNull();
  });

  it('returns the clip audio to a different validator', async () => {
    const { service, clip } = await buildServiceWithOneClip();
    const blob = await service.clipAudio(clip.id, 'validator-1');
    expect(Buffer.from(blob.bytes).toString()).toBe('clip bytes');
  });

  it('refuses to hand a contributor their own clip audio', async () => {
    const { service, clip } = await buildServiceWithOneClip();
    await expect(service.clipAudio(clip.id, 'owner-1')).rejects.toThrow(ForbiddenException);
  });

  it('404s clip audio for an unknown clip', async () => {
    const service = buildService();
    await expect(service.clipAudio('missing', 'validator-1')).rejects.toThrow(NotFoundException);
  });

  it('records a validation and reports PENDING before a second vote agrees', async () => {
    const { service, clip } = await buildServiceWithOneClip();

    const { validation, status } = await service.validateClip(clip.id, 'validator-1', 'RIGHT');

    expect(validation).toMatchObject({ clipId: clip.id, validatorId: 'validator-1', verdict: 'RIGHT' });
    expect(status).toBe('PENDING');
  });

  it('reports VERIFIED once two validators agree RIGHT', async () => {
    const { service, clip } = await buildServiceWithOneClip();
    await service.validateClip(clip.id, 'validator-1', 'RIGHT');

    const { status } = await service.validateClip(clip.id, 'validator-2', 'RIGHT');

    expect(status).toBe('VERIFIED');
  });

  it('refuses a contributor validating their own clip, as a 403 with a code', async () => {
    const { service, clip } = await buildServiceWithOneClip();
    try {
      await service.validateClip(clip.id, 'owner-1', 'RIGHT');
      expect.unreachable('expected validateClip to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({ code: 'OWN_CLIP_VALIDATION_FORBIDDEN' });
    }
  });

  it('refuses the same validator voting twice, as a 400 with a code', async () => {
    const { service, clip } = await buildServiceWithOneClip();
    await service.validateClip(clip.id, 'validator-1', 'RIGHT');

    try {
      await service.validateClip(clip.id, 'validator-1', 'WRONG');
      expect.unreachable('expected validateClip to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'CLIP_ALREADY_VALIDATED_BY_YOU' });
    }
  });

  it('refuses a third vote on an already-resolved clip, as a 400 with a code', async () => {
    const { service, clip } = await buildServiceWithOneClip();
    await service.validateClip(clip.id, 'validator-1', 'RIGHT');
    await service.validateClip(clip.id, 'validator-2', 'RIGHT');

    try {
      await service.validateClip(clip.id, 'validator-3', 'RIGHT');
      expect.unreachable('expected validateClip to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'CLIP_ALREADY_RESOLVED' });
    }
  });

  it('404s validateClip for an unknown clip', async () => {
    const service = buildService();
    await expect(service.validateClip('missing', 'validator-1', 'RIGHT')).rejects.toThrow(NotFoundException);
  });
});

describe('LanguageCorpusService clip validation — Reward', () => {
  /** Submits and fully verifies `count` distinct clips for `contributorId`, each judged RIGHT by two distinct validators. */
  async function verifyClips(service: LanguageCorpusService, contributorId: string, count: number) {
    service.grantConsent(contributorId, 'VOICE_CONTRIBUTION');
    for (let i = 0; i < count; i++) {
      const clip = await service.submitVoiceClip({
        ...validClip,
        id: `${contributorId}-clip-${i}`,
        contributorId,
        bytes: Buffer.from(`clip bytes ${contributorId} ${i}`),
      });
      await service.validateClip(clip.id, `${contributorId}-validator-a`, 'RIGHT');
      await service.validateClip(clip.id, `${contributorId}-validator-b`, 'RIGHT');
    }
  }

  it('grants no reward below the threshold', async () => {
    const grants = new InMemorySubscriptionGrantStore();
    const service = buildService(grants);

    await verifyClips(service, 'owner-1', REWARD_VERIFIED_CLIPS_PER_MONTH - 1);

    expect(grants.grants).toEqual([]);
  });

  it('grants a month of Plus the moment the threshold is crossed', async () => {
    const grants = new InMemorySubscriptionGrantStore();
    const service = buildService(grants);

    await verifyClips(service, 'owner-1', REWARD_VERIFIED_CLIPS_PER_MONTH);

    expect(grants.grants).toEqual([{ ownerId: 'owner-1', months: 1 }]);
  });

  it('grants a second month at the second multiple, not a third in between', async () => {
    const grants = new InMemorySubscriptionGrantStore();
    const service = buildService(grants);

    await verifyClips(service, 'owner-1', REWARD_VERIFIED_CLIPS_PER_MONTH * 2);

    expect(grants.grants).toEqual([
      { ownerId: 'owner-1', months: 1 },
      { ownerId: 'owner-1', months: 1 },
    ]);
  });

  it('never rewards a REJECTED clip', async () => {
    const grants = new InMemorySubscriptionGrantStore();
    const service = buildService(grants);
    service.grantConsent('owner-1', 'VOICE_CONTRIBUTION');
    const clip = await service.submitVoiceClip({ ...validClip, contributorId: 'owner-1' });

    await service.validateClip(clip.id, 'validator-1', 'WRONG');
    await service.validateClip(clip.id, 'validator-2', 'WRONG');

    expect(grants.grants).toEqual([]);
  });

  it('does not count a different contributor’s verified clips towards this one’s reward', async () => {
    const grants = new InMemorySubscriptionGrantStore();
    const service = buildService(grants);

    await verifyClips(service, 'owner-1', REWARD_VERIFIED_CLIPS_PER_MONTH - 1);
    await verifyClips(service, 'owner-2', 1);

    expect(grants.grants).toEqual([]);
  });

  it('still reports VERIFIED, and does not throw, when the reward grant itself fails', async () => {
    const grants = new InMemorySubscriptionGrantStore(new Error('subscription store unreachable'));
    const service = buildService(grants);
    await verifyClips(service, 'owner-1', REWARD_VERIFIED_CLIPS_PER_MONTH - 1);
    const clip = await service.submitVoiceClip({
      ...validClip,
      id: 'owner-1-final',
      contributorId: 'owner-1',
      bytes: Buffer.from('final clip bytes'),
    });

    await service.validateClip(clip.id, 'validator-a', 'RIGHT');
    const { status } = await service.validateClip(clip.id, 'validator-b', 'RIGHT');

    expect(status).toBe('VERIFIED');
  });
});

describe('LanguageCorpusService eraseVoiceClips', () => {
  async function submitVerifiedClip(service: LanguageCorpusService, contributorId: string, id: string) {
    service.grantConsent(contributorId, 'VOICE_CONTRIBUTION');
    const clip = await service.submitVoiceClip({ ...validClip, id, contributorId, bytes: Buffer.from(`bytes ${id}`) });
    await service.validateClip(clip.id, 'validator-a', 'RIGHT');
    await service.validateClip(clip.id, 'validator-b', 'RIGHT');
    return clip;
  }

  it('removes every clip belonging to the contributor, leaving another contributor untouched', async () => {
    const service = buildService();
    await submitVerifiedClip(service, 'owner-1', 'clip-1');
    await submitVerifiedClip(service, 'owner-2', 'clip-2');

    const { erasedClipIds } = await service.eraseVoiceClips('owner-1');

    expect(erasedClipIds).toEqual(['clip-1']);
    await expect(service.clipAudio('clip-1', 'validator-1')).rejects.toThrow(NotFoundException);
    expect(await service.clipAudio('clip-2', 'validator-1')).toBeDefined();
  });

  it('deletes the underlying audio bytes, not just the metadata row', async () => {
    const audioStore = new InMemoryDocumentStore('HOSTED');
    const service = new LanguageCorpusService(new LanguageCorpusRepository(), audioStore, new InMemorySubscriptionGrantStore());
    service.grantConsent('owner-1', 'VOICE_CONTRIBUTION');
    const clip = await service.submitVoiceClip(validClip);

    await service.eraseVoiceClips('owner-1');

    await expect(audioStore.get(clip.ref)).rejects.toThrow();
  });

  it('is a no-op for a contributor with nothing in the corpus', async () => {
    const service = buildService();
    expect(await service.eraseVoiceClips('nobody-here')).toEqual({ erasedClipIds: [] });
  });
});

describe('LanguageCorpusService release and datasheet', () => {
  it('ships only VERIFIED clips as of the moment the release is built', async () => {
    const service = buildService();
    service.grantConsent('owner-1', 'VOICE_CONTRIBUTION');
    const verified = await service.submitVoiceClip(validClip);
    await service.validateClip(verified.id, 'validator-a', 'RIGHT');
    await service.validateClip(verified.id, 'validator-b', 'RIGHT');
    await service.submitVoiceClip({ ...validClip, id: 'clip-pending', bytes: Buffer.from('pending bytes') });

    const release = service.buildRelease('nepali-speech-v0.1', '2026-08-17T00:00:00.000Z');

    expect(release.clips.map((c) => c.clipId)).toEqual(['clip-1']);
    expect(release.version).toBe('nepali-speech-v0.1');
    expect(release.excluded.notVerified).toBe(1);
  });

  it('already excludes an erased contributor\'s clips, since eraseVoiceClips removes them from the repository first', async () => {
    const service = buildService();
    service.grantConsent('owner-1', 'VOICE_CONTRIBUTION');
    const verified = await service.submitVoiceClip(validClip);
    await service.validateClip(verified.id, 'validator-a', 'RIGHT');
    await service.validateClip(verified.id, 'validator-b', 'RIGHT');

    await service.eraseVoiceClips('owner-1');
    const release = service.buildRelease('nepali-speech-v0.1', '2026-08-17T00:00:00.000Z');

    expect(release.clips).toEqual([]);
  });

  it('builds a datasheet summarising the release just built', async () => {
    const service = buildService();
    service.grantConsent('owner-1', 'VOICE_CONTRIBUTION');
    const clip = await service.submitVoiceClip(validClip);
    await service.validateClip(clip.id, 'validator-a', 'RIGHT');
    await service.validateClip(clip.id, 'validator-b', 'RIGHT');

    const release = service.buildRelease('nepali-speech-v0.1', '2026-08-17T00:00:00.000Z');
    const datasheet = service.datasheet(release);

    expect(datasheet.clipCount).toBe(1);
    expect(datasheet.byDistrict).toEqual({ Kathmandu: 1 });
    expect(datasheet.knownGaps.length).toBeGreaterThan(0);
  });
});

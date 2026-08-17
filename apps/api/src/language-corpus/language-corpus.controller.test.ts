import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { InMemorySubscriptionGrantStore } from '../entitlements/in-memory-subscription-grant.store.js';
import { LanguageCorpusController } from './language-corpus.controller.js';
import { LanguageCorpusRepository } from './language-corpus.repository.js';
import { LanguageCorpusService } from './language-corpus.service.js';

function buildController() {
  return new LanguageCorpusController(
    new LanguageCorpusService(new LanguageCorpusRepository(), new InMemoryDocumentStore('HOSTED'), new InMemorySubscriptionGrantStore()),
  );
}

const validClipBody = {
  id: 'clip-1',
  taskId: 'free-speech-village',
  taskKind: 'FREE_SPEECH',
  selfReport: { district: 'Kathmandu', motherTongue: 'NEPALI', ageBand: '25_34', gender: null },
  device: 'test-agent',
  durationMs: 4_000,
  contentType: 'audio/webm',
  bytesBase64: Buffer.from('clip bytes').toString('base64'),
};

const reviewer: CurrentUserResult = {
  subjectId: 'reviewer-1',
  user: { id: 'reviewer-1', phone: '9812345678', role: 'CORPUS_REVIEWER', locale: 'ne', assuranceLevel: 'REGISTERED' },
  patientProfileId: null,
  assuranceLevel: 'REGISTERED',
};

const owner1: CurrentUserResult = {
  subjectId: 'owner-1',
  user: { id: 'owner-1', phone: '9811111111', role: 'PATIENT', locale: 'ne', assuranceLevel: 'REGISTERED' },
  patientProfileId: null,
  assuranceLevel: 'REGISTERED',
};

const owner2: CurrentUserResult = {
  subjectId: 'owner-2',
  user: { id: 'owner-2', phone: '9822222222', role: 'PATIENT', locale: 'ne', assuranceLevel: 'REGISTERED' },
  patientProfileId: null,
  assuranceLevel: 'REGISTERED',
};

const validIngest = {
  id: 'utterance-1',
  kind: 'USER_MESSAGE',
  text: 'फोन [फोन] मा सम्पर्क गर्नुहोस्',
  locale: 'ne',
  capturedAt: '2026-08-01T00:00:00.000Z',
  redactionCount: 1,
  awaitingHumanReview: true,
};

describe('LanguageCorpusController ingest', () => {
  it('ingests a valid utterance, owned by the signed-in caller', () => {
    const controller = buildController();
    const utterance = controller.ingest(owner1, validIngest);

    expect(utterance.id).toBe('utterance-1');
    expect(utterance.discardedAt).toBeNull();
  });

  // A client-supplied ownerId must never override the session identity —
  // the same shape RecordsController.capture's captureSchema fix closed.
  it("ignores a client-supplied ownerId and stores the utterance under the caller's own subjectId", () => {
    const controller = buildController();
    const utterance = controller.ingest(owner1, { ...validIngest, ownerId: 'owner-2' });

    expect(controller.erase(owner1, 'owner-1')).toEqual({
      erasedUtteranceIds: [utterance.id],
      erasedCount: 1,
    });
  });

  it('rejects a request missing a required field', () => {
    const controller = buildController();
    expect(() => controller.ingest(owner1, { ...validIngest, id: undefined })).toThrow(BadRequestException);
  });

  it('rejects an unknown utterance kind rather than silently accepting it', () => {
    const controller = buildController();
    expect(() => controller.ingest(owner1, { ...validIngest, kind: 'NOT_A_REAL_KIND' })).toThrow(BadRequestException);
  });

  // Before this test existed, a non-ISO `capturedAt` like this passed the
  // old `.min(1)` check and would have sorted the review queue by
  // `localeCompare` against real ISO strings with no meaningful order.
  it('rejects a capturedAt that is not an ISO 8601 UTC instant', () => {
    const controller = buildController();
    expect(() => controller.ingest(owner1, { ...validIngest, capturedAt: 'yesterday' })).toThrow(BadRequestException);
  });
});

describe('LanguageCorpusController reviewer routes', () => {
  it('walks an utterance from ingest through read to clear, attributed to the reviewer', () => {
    const controller = buildController();
    controller.ingest(owner1, validIngest);

    controller.read(reviewer, 'utterance-1');
    const cleared = controller.clear(reviewer, 'utterance-1');

    expect(cleared.awaitingHumanReview).toBe(false);

    const log = controller.auditLog('utterance-1');
    expect(log.items.map((entry) => entry.action)).toEqual(['UTTERANCE_READ', 'UTTERANCE_CLEARED']);
  });

  it('discards an utterance', () => {
    const controller = buildController();
    controller.ingest(owner1, validIngest);

    const discarded = controller.discard(reviewer, 'utterance-1');
    expect(discarded.discardedAt).not.toBeNull();
  });

  it('404s reviewer routes for an unknown utterance', () => {
    const controller = buildController();
    expect(() => controller.read(reviewer, 'missing')).toThrow(NotFoundException);
    expect(() => controller.auditLog('missing')).toThrow(NotFoundException);
  });

  it('lists the review queue', () => {
    const controller = buildController();
    controller.ingest(owner1, validIngest);
    controller.ingest(owner2, { ...validIngest, id: 'utterance-2' });

    expect(controller.queue().total).toBe(2);
  });
});

describe('LanguageCorpusController erase', () => {
  it("erases every utterance for the signed-in caller's own record and reports how many", () => {
    const controller = buildController();
    controller.ingest(owner1, validIngest);
    controller.ingest(owner2, { ...validIngest, id: 'utterance-2' });

    const result = controller.erase(owner1, 'owner-1');

    expect(result).toEqual({ erasedUtteranceIds: ['utterance-1'], erasedCount: 1 });
    expect(() => controller.read(reviewer, 'utterance-1')).toThrow(NotFoundException);
  });

  it('rejects a blank ownerId rather than silently erasing nothing', () => {
    const controller = buildController();
    expect(() => controller.erase(owner1, '   ')).toThrow(BadRequestException);
  });

  it("404s rather than erasing another owner's record, even for a signed-in caller", () => {
    const controller = buildController();
    controller.ingest(owner1, validIngest);

    expect(() => controller.erase(owner2, 'owner-1')).toThrow(NotFoundException);
    // Confirms the attacker-shaped call above actually erased nothing.
    expect(() => controller.read(reviewer, 'utterance-1')).not.toThrow();
  });
});

describe('LanguageCorpusController corpus consent', () => {
  it('reads the user id from @CurrentUser(), never from a request parameter', () => {
    const controller = buildController();
    controller.grantConsent(owner1, 'VOICE_CONTRIBUTION');
    controller.grantConsent(owner2, 'HEALTH_CONVERSATION_AUDIO');

    expect(controller.consentGrants(owner1).grants.map((g) => g.kind)).toEqual(['VOICE_CONTRIBUTION']);
    expect(controller.consentGrants(owner2).grants.map((g) => g.kind)).toEqual(['HEALTH_CONVERSATION_AUDIO']);
  });

  it('grants a kind and reflects it back through consentGrants', () => {
    const controller = buildController();

    const grant = controller.grantConsent(owner1, 'HEALTH_CONVERSATION_AUDIO');

    expect(grant.userId).toBe('owner-1');
    expect(grant.revokedAt).toBeNull();
    expect(controller.consentGrants(owner1).total).toBe(1);
  });

  it('rejects an unknown kind before it ever reaches the service', () => {
    const controller = buildController();
    expect(() => controller.grantConsent(owner1, 'NOT_A_REAL_KIND')).toThrow(BadRequestException);
    expect(() => controller.revokeConsent(owner1, 'NOT_A_REAL_KIND')).toThrow(BadRequestException);
  });

  it('revokes a granted kind, still visible in the audit trail with revokedAt set', () => {
    const controller = buildController();
    controller.grantConsent(owner1, 'HEALTH_CONVERSATION_AUDIO');

    const { grants } = controller.revokeConsent(owner1, 'HEALTH_CONVERSATION_AUDIO');

    expect(grants[0]?.revokedAt).not.toBeNull();
    expect(controller.consentGrants(owner1).grants[0]?.revokedAt).not.toBeNull();
  });
});

describe('LanguageCorpusController voice contribution clips', () => {
  it('rejects a submission with no live VOICE_CONTRIBUTION consent', async () => {
    const controller = buildController();
    await expect(controller.submitVoiceClip(owner1, validClipBody)).rejects.toThrow(ForbiddenException);
  });

  it('stores a clip under the caller\'s own subjectId once consent is live', async () => {
    const controller = buildController();
    controller.grantConsent(owner1, 'VOICE_CONTRIBUTION');

    const clip = await controller.submitVoiceClip(owner1, validClipBody);

    expect(clip.contributorId).toBe('owner-1');
    expect(clip.id).toBe('clip-1');
    expect(clip.ref.byteSize).toBe(Buffer.from('clip bytes').byteLength);
  });

  it('rejects a request missing a required field', () => {
    // Body validation happens synchronously, before the async store call —
    // same reason `LanguageCorpusController ingest`'s own validation tests
    // above assert with a thrown-synchronously `expect(() => ...)`, not `rejects`.
    const controller = buildController();
    controller.grantConsent(owner1, 'VOICE_CONTRIBUTION');
    const withoutId: Record<string, unknown> = { ...validClipBody };
    delete withoutId['id'];
    expect(() => controller.submitVoiceClip(owner1, withoutId)).toThrow(BadRequestException);
  });

  it('rejects a clip below the minimum duration', async () => {
    const controller = buildController();
    controller.grantConsent(owner1, 'VOICE_CONTRIBUTION');
    await expect(controller.submitVoiceClip(owner1, { ...validClipBody, durationMs: 100 })).rejects.toThrow(BadRequestException);
  });
});

describe('LanguageCorpusController voice contribution validation', () => {
  async function buildControllerWithOneClip() {
    const controller = buildController();
    controller.grantConsent(owner1, 'VOICE_CONTRIBUTION');
    const clip = await controller.submitVoiceClip(owner1, validClipBody);
    return { controller, clip };
  }

  it('offers the next clip to a different signed-in caller', async () => {
    const { controller, clip } = await buildControllerWithOneClip();
    expect(controller.nextForValidation(owner2)).toEqual({ clip });
  });

  it('never offers a contributor their own clip', async () => {
    const { controller } = await buildControllerWithOneClip();
    expect(controller.nextForValidation(owner1)).toEqual({ clip: null });
  });

  it('returns the clip audio, base64-encoded, to a different caller', async () => {
    const { controller, clip } = await buildControllerWithOneClip();
    const audio = await controller.clipAudio(owner2, clip.id);
    expect(audio).toEqual({ contentType: 'audio/webm', bytesBase64: Buffer.from('clip bytes').toString('base64') });
  });

  it('refuses to hand a contributor their own clip audio', async () => {
    const { controller, clip } = await buildControllerWithOneClip();
    await expect(controller.clipAudio(owner1, clip.id)).rejects.toThrow(ForbiddenException);
  });

  it('records a validation from a different caller', async () => {
    const { controller, clip } = await buildControllerWithOneClip();
    const { validation, status } = await controller.validateClip(owner2, clip.id, { verdict: 'RIGHT' });
    expect(validation).toMatchObject({ clipId: clip.id, validatorId: 'owner-2', verdict: 'RIGHT' });
    expect(status).toBe('PENDING');
  });

  it('rejects a request with an invalid verdict', async () => {
    const { controller, clip } = await buildControllerWithOneClip();
    await expect(controller.validateClip(owner2, clip.id, { verdict: 'MAYBE' })).rejects.toThrow(BadRequestException);
  });

  it('refuses a contributor validating their own clip, as a 403', async () => {
    const { controller, clip } = await buildControllerWithOneClip();
    await expect(controller.validateClip(owner1, clip.id, { verdict: 'RIGHT' })).rejects.toThrow(ForbiddenException);
  });
});

describe('LanguageCorpusController voice contribution erasure', () => {
  async function submitAndVerify(controller: LanguageCorpusController, owner: CurrentUserResult, id: string) {
    controller.grantConsent(owner, 'VOICE_CONTRIBUTION');
    const clip = await controller.submitVoiceClip(owner, { ...validClipBody, id, bytesBase64: Buffer.from(`bytes ${id}`).toString('base64') });
    await controller.validateClip(reviewer, clip.id, { verdict: 'RIGHT' });
    await controller.validateClip(owner2, clip.id, { verdict: 'RIGHT' });
    return clip;
  }

  it("erases every clip for the signed-in caller's own record and reports how many", async () => {
    const controller = buildController();
    await submitAndVerify(controller, owner1, 'clip-1');

    const result = await controller.eraseVoiceClips(owner1, 'owner-1');

    expect(result).toEqual({ erasedClipIds: ['clip-1'], erasedCount: 1 });
    await expect(controller.clipAudio(owner2, 'clip-1')).rejects.toThrow(NotFoundException);
  });

  it('rejects a blank contributorId rather than silently erasing nothing', async () => {
    const controller = buildController();
    await expect(controller.eraseVoiceClips(owner1, '   ')).rejects.toThrow(BadRequestException);
  });

  it("404s rather than erasing another contributor's clips, even for a signed-in caller", async () => {
    const controller = buildController();
    await submitAndVerify(controller, owner1, 'clip-1');

    await expect(controller.eraseVoiceClips(owner2, 'owner-1')).rejects.toThrow(NotFoundException);
    // Confirms the attacker-shaped call above actually erased nothing.
    await expect(controller.clipAudio(owner2, 'clip-1')).resolves.toBeDefined();
  });
});

describe('LanguageCorpusController release', () => {
  it('builds a release of VERIFIED clips with a matching datasheet, for a reviewer', async () => {
    const controller = buildController();
    const clip = await submitAndVerify(controller, owner1, 'clip-1');

    const { release, datasheet } = controller.release('nepali-speech-v0.1');

    expect(release.clips.map((c) => c.clipId)).toEqual([clip.id]);
    expect(release.version).toBe('nepali-speech-v0.1');
    expect(datasheet.clipCount).toBe(1);
  });

  it('rejects a request with no version', () => {
    const controller = buildController();
    expect(() => controller.release(undefined)).toThrow(BadRequestException);
  });

  async function submitAndVerify(controller: LanguageCorpusController, owner: CurrentUserResult, id: string) {
    controller.grantConsent(owner, 'VOICE_CONTRIBUTION');
    const clip = await controller.submitVoiceClip(owner, { ...validClipBody, id, bytesBase64: Buffer.from(`bytes ${id}`).toString('base64') });
    await controller.validateClip(reviewer, clip.id, { verdict: 'RIGHT' });
    await controller.validateClip(owner2, clip.id, { verdict: 'RIGHT' });
    return clip;
  }
});

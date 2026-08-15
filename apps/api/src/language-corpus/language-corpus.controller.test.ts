import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { LanguageCorpusController } from './language-corpus.controller.js';
import { LanguageCorpusRepository } from './language-corpus.repository.js';
import { LanguageCorpusService } from './language-corpus.service.js';

function buildController() {
  return new LanguageCorpusController(new LanguageCorpusService(new LanguageCorpusRepository()));
}

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

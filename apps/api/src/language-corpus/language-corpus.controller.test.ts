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
  user: { id: 'reviewer-1', phone: '9812345678', role: 'CORPUS_REVIEWER', locale: 'ne' },
  patientProfileId: null,
  assuranceLevel: 'REGISTERED',
};

const validIngest = {
  id: 'utterance-1',
  ownerId: 'owner-1',
  kind: 'USER_MESSAGE',
  text: 'फोन [फोन] मा सम्पर्क गर्नुहोस्',
  locale: 'ne',
  capturedAt: '2026-08-01T00:00:00.000Z',
  redactionCount: 1,
  awaitingHumanReview: true,
};

describe('LanguageCorpusController ingest', () => {
  it('ingests a valid utterance', () => {
    const controller = buildController();
    const utterance = controller.ingest(validIngest);

    expect(utterance.id).toBe('utterance-1');
    expect(utterance.discardedAt).toBeNull();
  });

  it('rejects a request missing a required field', () => {
    const controller = buildController();
    expect(() => controller.ingest({ ...validIngest, ownerId: undefined })).toThrow(BadRequestException);
  });

  it('rejects an unknown utterance kind rather than silently accepting it', () => {
    const controller = buildController();
    expect(() => controller.ingest({ ...validIngest, kind: 'NOT_A_REAL_KIND' })).toThrow(BadRequestException);
  });

  // Before this test existed, a non-ISO `capturedAt` like this passed the
  // old `.min(1)` check and would have sorted the review queue by
  // `localeCompare` against real ISO strings with no meaningful order.
  it('rejects a capturedAt that is not an ISO 8601 UTC instant', () => {
    const controller = buildController();
    expect(() => controller.ingest({ ...validIngest, capturedAt: 'yesterday' })).toThrow(BadRequestException);
  });
});

describe('LanguageCorpusController reviewer routes', () => {
  it('walks an utterance from ingest through read to clear, attributed to the reviewer', () => {
    const controller = buildController();
    controller.ingest(validIngest);

    controller.read(reviewer, 'utterance-1');
    const cleared = controller.clear(reviewer, 'utterance-1');

    expect(cleared.awaitingHumanReview).toBe(false);

    const log = controller.auditLog('utterance-1');
    expect(log.items.map((entry) => entry.action)).toEqual(['UTTERANCE_READ', 'UTTERANCE_CLEARED']);
  });

  it('discards an utterance', () => {
    const controller = buildController();
    controller.ingest(validIngest);

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
    controller.ingest(validIngest);
    controller.ingest({ ...validIngest, id: 'utterance-2' });

    expect(controller.queue().total).toBe(2);
  });
});

describe('LanguageCorpusController erase', () => {
  it('erases every utterance for the owner and reports how many', () => {
    const controller = buildController();
    controller.ingest(validIngest);
    controller.ingest({ ...validIngest, id: 'utterance-2', ownerId: 'owner-2' });

    const result = controller.erase('owner-1');

    expect(result).toEqual({ erasedUtteranceIds: ['utterance-1'], erasedCount: 1 });
    expect(() => controller.read(reviewer, 'utterance-1')).toThrow(NotFoundException);
  });

  it('rejects a blank ownerId rather than silently erasing nothing', () => {
    const controller = buildController();
    expect(() => controller.erase('   ')).toThrow(BadRequestException);
  });
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { LanguageCorpusController } from './language-corpus.controller.js';
import { LanguageCorpusRepository } from './language-corpus.repository.js';
import { LanguageCorpusService } from './language-corpus.service.js';

function buildController() {
  return new LanguageCorpusController(new LanguageCorpusService(new LanguageCorpusRepository()));
}

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
});

describe('LanguageCorpusController reviewer routes', () => {
  it('requires x-reviewer-id even though CorpusReviewerGuard normally screens it out first', () => {
    const controller = buildController();
    controller.ingest(validIngest);

    expect(() => controller.read('utterance-1', undefined)).toThrow(BadRequestException);
    expect(() => controller.clear('utterance-1', undefined)).toThrow(BadRequestException);
    expect(() => controller.discard('utterance-1', undefined)).toThrow(BadRequestException);
  });

  it('walks an utterance from ingest through read to clear, attributed to the reviewer', () => {
    const controller = buildController();
    controller.ingest(validIngest);

    controller.read('utterance-1', 'reviewer-1');
    const cleared = controller.clear('utterance-1', 'reviewer-1');

    expect(cleared.awaitingHumanReview).toBe(false);

    const log = controller.auditLog('utterance-1');
    expect(log.items.map((entry) => entry.action)).toEqual(['UTTERANCE_READ', 'UTTERANCE_CLEARED']);
  });

  it('discards an utterance', () => {
    const controller = buildController();
    controller.ingest(validIngest);

    const discarded = controller.discard('utterance-1', 'reviewer-1');
    expect(discarded.discardedAt).not.toBeNull();
  });

  it('404s reviewer routes for an unknown utterance', () => {
    const controller = buildController();
    expect(() => controller.read('missing', 'reviewer-1')).toThrow(NotFoundException);
    expect(() => controller.auditLog('missing')).toThrow(NotFoundException);
  });

  it('lists the review queue', () => {
    const controller = buildController();
    controller.ingest(validIngest);
    controller.ingest({ ...validIngest, id: 'utterance-2' });

    expect(controller.queue().total).toBe(2);
  });
});

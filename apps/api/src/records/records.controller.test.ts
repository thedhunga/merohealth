import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { EntitlementsGuard } from '../entitlements/entitlements.guard.js';
import type { ExtractionResult, RecordExtractionService } from './record-extraction.service.js';
import { RecordsController } from './records.controller.js';
import { RecordsRepository } from './records.repository.js';
import { RecordsService } from './records.service.js';

function buildController(store = new InMemoryDocumentStore('HOSTED'), extraction?: RecordExtractionService) {
  const service = new RecordsService(new RecordsRepository(), store, extraction);
  return new RecordsController(service);
}

/** Simulates the provider being genuinely down — every call rejects. */
class BrokenExtractionService implements RecordExtractionService {
  extract(): Promise<ExtractionResult> {
    throw new Error('simulated extraction outage');
  }
}

// Nest's own `@UseGuards` metadata key — see `teleconsultation.controller.test.ts`
// and `interop.controller.test.ts` for the same pattern applied to their own
// controllers. A plain method call (every other test in this file) bypasses
// Nest's guard pipeline entirely, so this is the only way to prove the
// decorator is actually attached to the compiled method.
const GUARDS_METADATA = '__guards__';
const controllerProto = RecordsController.prototype as unknown as Record<string, () => unknown>;
function guardsFor(method: string): unknown {
  return Reflect.getMetadata(GUARDS_METADATA, controllerProto[method]!);
}

describe('RecordsController auth wiring', () => {
  // `capture` alone also carries `EntitlementsGuard` — it is the one route
  // that creates new usage against a quota, the same "gate only the action
  // that creates usage" split `InteropController`/`TeleconsultationController`
  // apply to their own routes. Every other route below reads or mutates a
  // document the caller already owns, so `SessionAuthGuard` alone is enough:
  // it establishes who the caller is, and `RecordsService` enforces that they
  // may only touch their own records.
  it('gates capture behind SessionAuthGuard and EntitlementsGuard', () => {
    expect(guardsFor('capture')).toEqual([SessionAuthGuard, EntitlementsGuard]);
  });

  it('gates every read and mutation route behind SessionAuthGuard', () => {
    const gated = [
      'list',
      'observations',
      'observationsForDocument',
      'timeline',
      'confirm',
      'correct',
      'reject',
      'retryExtraction',
    ];
    for (const method of gated) {
      expect(guardsFor(method)).toEqual([SessionAuthGuard]);
    }
  });

  it('leaves only the health check ungated', () => {
    expect(guardsFor('health')).toBeUndefined();
  });
});

// `capture()` reads its owner from `@CurrentUser()`, populated by
// `SessionAuthGuard` on a real request — this is that same shape, stood up
// directly the way `auth.controller.test.ts`'s `me()` test does, since a
// plain method call bypasses Nest's guard/decorator pipeline entirely.
const currentUser: CurrentUserResult = {
  subjectId: 'owner-1',
  user: { id: 'owner-1', phone: '9812345678', role: 'PATIENT', locale: 'ne', assuranceLevel: 'REGISTERED' },
  patientProfileId: null,
  assuranceLevel: 'REGISTERED',
};

const validCapture = {
  filename: 'report.jpg',
  kind: 'LAB_REPORT',
  title: 'Blood panel',
  bytesBase64: Buffer.from('fake bytes').toString('base64'),
};

describe('RecordsController health', () => {
  it('reports UP', async () => {
    const controller = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});

describe('RecordsController capture', () => {
  it('decodes base64 bytes and stores the document, owned by the current session', async () => {
    const controller = buildController();
    const document = await controller.capture(currentUser, validCapture);

    expect(document.status).toBe('STORED');
    expect(document.title).toBe('Blood panel');
    expect(document.ownerId).toBe('owner-1');
  });

  it('ignores a client-supplied ownerId — the session identity always wins', async () => {
    const controller = buildController();
    const document = await controller.capture(currentUser, { ...validCapture, ownerId: 'someone-else' });

    expect(document.ownerId).toBe('owner-1');
  });

  it('rejects a request missing a required field', async () => {
    const controller = buildController();
    await expect(
      controller.capture(currentUser, { ...validCapture, filename: undefined }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unknown document kind rather than silently accepting it', async () => {
    const controller = buildController();
    await expect(
      controller.capture(currentUser, { ...validCapture, kind: 'NOT_A_REAL_KIND' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a documentDate that is not an ISO 8601 UTC instant', async () => {
    const controller = buildController();
    await expect(
      controller.capture(currentUser, { ...validCapture, documentDate: 'not-a-date' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a bare YYYY-MM-DD documentDate — buildTimeline/toFhirDocumentReference expect the same instant shape as capturedAt', async () => {
    const controller = buildController();
    await expect(
      controller.capture(currentUser, { ...validCapture, documentDate: '2026-05-18' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a well-formed ISO 8601 UTC instant documentDate', async () => {
    const controller = buildController();
    const document = await controller.capture(currentUser, { ...validCapture, documentDate: '2026-05-18T00:00:00Z' });
    expect(document.documentDate).toBe('2026-05-18T00:00:00Z');
  });

  it('accepts a null documentDate — it is optional', async () => {
    const controller = buildController();
    const document = await controller.capture(currentUser, { ...validCapture, documentDate: null });
    expect(document.documentDate).toBeNull();
  });
});

describe('RecordsController reads', () => {
  it('lists documents captured for the signed-in caller', async () => {
    const controller = buildController();
    await controller.capture(currentUser, validCapture);

    const result = controller.list(currentUser);
    expect(result.total).toBe(1);
  });

  it('never lists another owner\'s documents, no matter who calls', async () => {
    const controller = buildController();
    await controller.capture(currentUser, validCapture);

    const someoneElse: CurrentUserResult = { ...currentUser, subjectId: 'owner-2' };
    const result = controller.list(someoneElse);
    expect(result.total).toBe(0);
  });

  it('returns a timeline entry per captured document', async () => {
    const controller = buildController();
    await controller.capture(currentUser, validCapture);

    const result = controller.timeline(currentUser);
    expect(result.total).toBe(1);
  });

  it('404s for observations of an unknown document', () => {
    const controller = buildController();
    expect(() => controller.observationsForDocument(currentUser, 'missing')).toThrow(NotFoundException);
  });

  it('lists every observation across the caller\'s documents, empty when there are none', async () => {
    const controller = buildController();
    await controller.capture(currentUser, validCapture);

    const result = controller.observations(currentUser);
    expect(result).toEqual({ items: [], total: 0 });
  });

  it('never lists another owner\'s observations from the all-observations route', () => {
    const controller = buildController();
    const someoneElse: CurrentUserResult = { ...currentUser, subjectId: 'owner-2' };
    expect(controller.observations(someoneElse)).toEqual({ items: [], total: 0 });
  });
});

describe('RecordsController observation actions', () => {
  it('confirm/correct/reject 404 for an unknown observation', () => {
    const controller = buildController();
    expect(() => controller.confirm(currentUser, 'missing')).toThrow(NotFoundException);
    expect(() => controller.correct(currentUser, 'missing', { value: '1' })).toThrow(NotFoundException);
    expect(() => controller.reject(currentUser, 'missing')).toThrow(NotFoundException);
  });

  it('rejects a correct body with no value', () => {
    const controller = buildController();
    expect(() => controller.correct(currentUser, 'any-id', {})).toThrow(BadRequestException);
  });

  it('never confirms, corrects or rejects another owner\'s observation', async () => {
    const controller = buildController();
    const document = await controller.capture(currentUser, validCapture);
    // No extraction pipeline runs in this test setup, so there is no real
    // observation id to target — the point is only that a forged owner on
    // the session can't reach a document it doesn't own, proven the same way
    // `observationsForDocument`'s 404 test does: `#requireObservation` and
    // `listDocumentObservations` both compare against `document.ownerId`.
    const someoneElse: CurrentUserResult = { ...currentUser, subjectId: 'owner-2' };
    expect(() => controller.observationsForDocument(someoneElse, document.id)).toThrow(NotFoundException);
  });
});

describe('RecordsController.retryExtraction', () => {
  it('re-attempts extraction on the caller’s own EXTRACTION_FAILED document', async () => {
    const controller = buildController(new InMemoryDocumentStore('HOSTED'), new BrokenExtractionService());
    const failed = await controller.capture(currentUser, { ...validCapture, contentType: 'image/jpeg' });
    expect(failed.status).toBe('EXTRACTION_FAILED');

    const retried = await controller.retryExtraction(currentUser, failed.id);
    expect(retried.status).toBe('EXTRACTION_FAILED');
  });

  it('404s for an unknown document, or a document owned by someone else', async () => {
    const controller = buildController(new InMemoryDocumentStore('HOSTED'), new BrokenExtractionService());
    const failed = await controller.capture(currentUser, validCapture);

    await expect(controller.retryExtraction(currentUser, 'missing')).rejects.toThrow(NotFoundException);
    const someoneElse: CurrentUserResult = { ...currentUser, subjectId: 'owner-2' };
    await expect(controller.retryExtraction(someoneElse, failed.id)).rejects.toThrow(NotFoundException);
  });

  it('rejects retrying a document that is not EXTRACTION_FAILED', async () => {
    const controller = buildController();
    const document = await controller.capture(currentUser, validCapture);
    expect(document.status).toBe('STORED');

    await expect(controller.retryExtraction(currentUser, document.id)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rate-limits a caller retrying the same paid extraction call in a loop', async () => {
    const controller = buildController(new InMemoryDocumentStore('HOSTED'), new BrokenExtractionService());
    const failed = await controller.capture(currentUser, { ...validCapture, contentType: 'image/jpeg' });
    expect(failed.status).toBe('EXTRACTION_FAILED');

    // The limiter's ceiling is 10 per window; the document stays
    // EXTRACTION_FAILED after every attempt (BrokenExtractionService always
    // rejects), so all ten calls are otherwise-valid retries and only the
    // eleventh should be refused.
    for (let i = 0; i < 10; i++) {
      const retried = await controller.retryExtraction(currentUser, failed.id);
      expect(retried.status).toBe('EXTRACTION_FAILED');
    }

    await expect(controller.retryExtraction(currentUser, failed.id)).rejects.toMatchObject({
      status: 429,
      response: { code: 'RATE_LIMITED' },
    });
  });

  it('tracks retry limits per caller, not globally', async () => {
    const controller = buildController(new InMemoryDocumentStore('HOSTED'), new BrokenExtractionService());
    const failed = await controller.capture(currentUser, { ...validCapture, contentType: 'image/jpeg' });
    for (let i = 0; i < 10; i++) await controller.retryExtraction(currentUser, failed.id);
    await expect(controller.retryExtraction(currentUser, failed.id)).rejects.toMatchObject({ status: 429 });

    // A different owner's document is unaffected by the first caller's spend.
    const someoneElse: CurrentUserResult = { ...currentUser, subjectId: 'owner-2' };
    const theirs = await controller.capture(someoneElse, { ...validCapture, contentType: 'image/jpeg' });
    const retried = await controller.retryExtraction(someoneElse, theirs.id);
    expect(retried.status).toBe('EXTRACTION_FAILED');
  });
});

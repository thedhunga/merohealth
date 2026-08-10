import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { RecordsController } from './records.controller.js';
import { RecordsRepository } from './records.repository.js';
import { RecordsService } from './records.service.js';

function buildController(store = new InMemoryDocumentStore('HOSTED')) {
  const service = new RecordsService(new RecordsRepository(), store);
  return new RecordsController(service);
}

// `capture()` reads its owner from `@CurrentUser()`, populated by
// `SessionAuthGuard` on a real request — this is that same shape, stood up
// directly the way `auth.controller.test.ts`'s `me()` test does, since a
// plain method call bypasses Nest's guard/decorator pipeline entirely.
const currentUser: CurrentUserResult = {
  subjectId: 'owner-1',
  user: { id: 'owner-1', phone: '9812345678', role: 'PATIENT', locale: 'ne' },
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
});

describe('RecordsController reads', () => {
  it('requires ownerId on the list endpoint', () => {
    const controller = buildController();
    expect(() => controller.list(undefined)).toThrow(BadRequestException);
  });

  it('lists documents captured for the given owner', async () => {
    const controller = buildController();
    await controller.capture(currentUser, validCapture);

    const result = controller.list('owner-1');
    expect(result.total).toBe(1);
  });

  it('requires ownerId on the timeline endpoint', () => {
    const controller = buildController();
    expect(() => controller.timeline(undefined)).toThrow(BadRequestException);
  });

  it('returns a timeline entry per captured document', async () => {
    const controller = buildController();
    await controller.capture(currentUser, validCapture);

    const result = controller.timeline('owner-1');
    expect(result.total).toBe(1);
  });

  it('404s for observations of an unknown document', () => {
    const controller = buildController();
    expect(() => controller.observationsForDocument('missing', 'owner-1')).toThrow(NotFoundException);
  });

  it('requires ownerId on the document-observations endpoint', () => {
    const controller = buildController();
    expect(() => controller.observationsForDocument('missing', undefined)).toThrow(BadRequestException);
  });
});

describe('RecordsController observation actions', () => {
  it('confirm/correct/reject 404 for an unknown observation', () => {
    const controller = buildController();
    expect(() => controller.confirm('missing', { ownerId: 'owner-1' })).toThrow(NotFoundException);
    expect(() => controller.correct('missing', { ownerId: 'owner-1', value: '1' })).toThrow(
      NotFoundException,
    );
    expect(() => controller.reject('missing', { ownerId: 'owner-1' })).toThrow(NotFoundException);
  });

  it('rejects a correct body with no value', () => {
    const controller = buildController();
    expect(() => controller.correct('any-id', { ownerId: 'owner-1' })).toThrow(BadRequestException);
  });

  it('rejects confirm/correct/reject bodies with no ownerId', () => {
    const controller = buildController();
    expect(() => controller.confirm('any-id', {})).toThrow(BadRequestException);
    expect(() => controller.correct('any-id', { value: '1' })).toThrow(BadRequestException);
    expect(() => controller.reject('any-id', {})).toThrow(BadRequestException);
  });
});

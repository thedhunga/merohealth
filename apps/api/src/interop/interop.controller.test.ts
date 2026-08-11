import { BadRequestException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import type { CaptureDocumentInput } from '../records/records.service.js';
import { RecordsService } from '../records/records.service.js';
import { InteropController } from './interop.controller.js';
import { InteropRepository } from './interop.repository.js';
import { InteropService } from './interop.service.js';

function makeCapture(overrides: Partial<CaptureDocumentInput> = {}): CaptureDocumentInput {
  return {
    ownerId: 'owner-1',
    filename: 'report.jpg',
    kind: 'LAB_REPORT',
    title: 'Blood panel',
    documentDate: '2026-08-01',
    sensitivity: 'STANDARD',
    clientEncrypted: false,
    contentType: 'image/jpeg',
    bytes: new Uint8Array([1, 2, 3]),
    pageCount: 1,
    ...overrides,
  };
}

function buildController() {
  const records = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const controller = new InteropController(new InteropService(new InteropRepository(), records));
  return { records, controller };
}

// Populated by `SessionAuthGuard` on a real request — a plain method call
// bypasses Nest's guard/decorator pipeline, the same shape
// `records.controller.test.ts`'s own `currentUser` const documents.
const currentUser: CurrentUserResult = {
  subjectId: 'owner-1',
  user: { id: 'owner-1', phone: '9812345678', role: 'PATIENT', locale: 'ne' },
  patientProfileId: null,
  assuranceLevel: 'REGISTERED',
};

describe('InteropController health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});

describe('InteropController share links', () => {
  it('issues a link, scoped to the current session’s owner', async () => {
    const { records, controller } = buildController();
    const document = await records.captureDocument(makeCapture());

    const link = await controller.issueShareLink(currentUser, { documentIds: [document.id], ttlSeconds: 3600 });
    expect(link.ownerId).toBe('owner-1');
  });

  it('rejects a request missing ttlSeconds', async () => {
    const { controller } = buildController();
    await expect(controller.issueShareLink(currentUser, { documentIds: ['doc-1'] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a non-positive ttlSeconds', async () => {
    const { controller } = buildController();
    await expect(
      controller.issueShareLink(currentUser, { documentIds: ['doc-1'], ttlSeconds: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists and revokes the caller’s own links', async () => {
    const { records, controller } = buildController();
    const document = await records.captureDocument(makeCapture());
    const link = await controller.issueShareLink(currentUser, { documentIds: [document.id], ttlSeconds: 3600 });

    expect(controller.listShareLinks(currentUser).total).toBe(1);

    const revoked = controller.revokeShareLink(currentUser, link.id);
    expect(revoked.revokedAt).not.toBeNull();
  });

  it('resolves a share token to its FHIR bundle with no session at all', async () => {
    const { records, controller } = buildController();
    const document = await records.captureDocument(makeCapture());
    const link = await controller.issueShareLink(currentUser, { documentIds: [document.id], ttlSeconds: 3600 });

    const bundle = await controller.resolveSharedBundle(link.token);
    expect(bundle.resourceType).toBe('Bundle');
  });
});

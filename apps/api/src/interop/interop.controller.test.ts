import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { EntitlementsGuard } from '../entitlements/entitlements.guard.js';
import { REQUIRED_MODULE_KEY, REQUIRED_QUOTA_KEY } from '../entitlements/require-entitlement.decorator.js';
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
  user: { id: 'owner-1', phone: '9812345678', role: 'PATIENT', locale: 'ne', assuranceLevel: 'REGISTERED' },
  patientProfileId: null,
  assuranceLevel: 'REGISTERED',
};

describe('InteropController health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});

// Nest's own `@UseGuards` metadata key. Not part of `@nestjs/common`'s
// public exports (only `constants.ts` internally, which NodeNext module
// resolution can't reach as a subpath import here), the same reasoning
// `teleconsultation.controller.test.ts` documents for its own copy.
const GUARDS_METADATA = '__guards__';

// Cast away the class-method typing so `@typescript-eslint/unbound-method`
// doesn't flag these as unsafe `this`-losing references — every use below
// only reads Reflect-metadata off the function object, never calls it.
const controllerProto = InteropController.prototype as unknown as Record<string, () => unknown>;

function guardsFor(method: string): unknown {
  return Reflect.getMetadata(GUARDS_METADATA, controllerProto[method]!);
}

describe('InteropController entitlement wiring', () => {
  const reflector = new Reflector();

  it('gates issueShareLink behind SessionAuthGuard, EntitlementsGuard, RECORD_SHARING and ACTIVE_SHARE_LINKS', () => {
    expect(guardsFor('issueShareLink')).toEqual([SessionAuthGuard, EntitlementsGuard]);
    expect(reflector.get<string | undefined>(REQUIRED_MODULE_KEY, controllerProto['issueShareLink']!)).toBe(
      'RECORD_SHARING',
    );
    expect(reflector.get<string | undefined>(REQUIRED_QUOTA_KEY, controllerProto['issueShareLink']!)).toBe(
      'ACTIVE_SHARE_LINKS',
    );
  });

  // Reading/revoking a link the caller already holds keeps its pre-existing
  // `SessionAuthGuard` only — no `EntitlementsGuard` — since only the action
  // that creates new usage is metered, matching `RecordsController`'s own
  // precedent. `health` and `resolveSharedBundle` (the no-session bearer-token
  // route) carry no guard at all.
  it('leaves every other route un-metered', () => {
    expect(guardsFor('health')).toBeUndefined();
    expect(guardsFor('resolveSharedBundle')).toBeUndefined();
    expect(guardsFor('listShareLinks')).toEqual([SessionAuthGuard]);
    expect(guardsFor('revokeShareLink')).toEqual([SessionAuthGuard]);
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

  it('rejects a ttlSeconds past the 30-day ceiling before it ever reaches the domain layer', async () => {
    const { controller } = buildController();
    await expect(
      controller.issueShareLink(currentUser, { documentIds: ['doc-1'], ttlSeconds: 60 * 60 * 24 * 31 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // Without this bound, `InteropService.issueShareLink`'s per-id ownership
  // lookup loop would run once per entry in whatever array a caller sent.
  it('rejects a documentIds array past the 40-id ceiling before it ever reaches the ownership loop', async () => {
    const { controller } = buildController();
    await expect(
      controller.issueShareLink(currentUser, {
        documentIds: Array.from({ length: 41 }, (_, index) => `doc-${index}`),
        ttlSeconds: 3600,
      }),
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

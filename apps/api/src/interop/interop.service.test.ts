import { BadRequestException, GoneException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { RecordsRepository } from '../records/records.repository.js';
import type { CaptureDocumentInput } from '../records/records.service.js';
import { RecordsService } from '../records/records.service.js';
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

function buildStack() {
  const records = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const interop = new InteropService(new InteropRepository(), records);
  return { records, interop };
}

describe('InteropService.issueShareLink', () => {
  it('issues a link scoped to the caller’s own documents', async () => {
    const { records, interop } = buildStack();
    const document = await records.captureDocument(makeCapture());

    const link = await interop.issueShareLink('owner-1', { documentIds: [document.id], ttlSeconds: 3600 });

    expect(link.ownerId).toBe('owner-1');
    expect(link.documentIds).toEqual([document.id]);
    expect(link.revokedAt).toBeNull();
  });

  it('404s for a document belonging to a different owner, same as records itself', async () => {
    const { records, interop } = buildStack();
    const document = await records.captureDocument(makeCapture({ ownerId: 'owner-2' }));

    await expect(
      interop.issueShareLink('owner-1', { documentIds: [document.id], ttlSeconds: 3600 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s for an unknown document id', async () => {
    const { interop } = buildStack();
    await expect(
      interop.issueShareLink('owner-1', { documentIds: ['missing'], ttlSeconds: 3600 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps a domain ShareLinkError (e.g. no documents) to BadRequestException', async () => {
    const { interop } = buildStack();
    await expect(interop.issueShareLink('owner-1', { documentIds: [], ttlSeconds: 3600 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses while health-records is down', async () => {
    const { records, interop } = buildStack();
    records.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(
      interop.issueShareLink('owner-1', { documentIds: ['doc-1'], ttlSeconds: 3600 }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('InteropService.listShareLinks / revokeShareLink', () => {
  it('lists only the requested owner’s links', async () => {
    const { records, interop } = buildStack();
    const mine = await records.captureDocument(makeCapture({ ownerId: 'owner-1' }));
    const theirs = await records.captureDocument(makeCapture({ ownerId: 'owner-2' }));
    await interop.issueShareLink('owner-1', { documentIds: [mine.id], ttlSeconds: 3600 });
    await interop.issueShareLink('owner-2', { documentIds: [theirs.id], ttlSeconds: 3600 });

    expect(interop.listShareLinks('owner-1')).toHaveLength(1);
  });

  it('revokes a link the caller issued', async () => {
    const { records, interop } = buildStack();
    const document = await records.captureDocument(makeCapture());
    const link = await interop.issueShareLink('owner-1', { documentIds: [document.id], ttlSeconds: 3600 });

    const revoked = interop.revokeShareLink(link.id, 'owner-1');
    expect(revoked.revokedAt).not.toBeNull();
  });

  it('404s revoking an unknown link or one owned by someone else', async () => {
    const { records, interop } = buildStack();
    const document = await records.captureDocument(makeCapture());
    const link = await interop.issueShareLink('owner-1', { documentIds: [document.id], ttlSeconds: 3600 });

    expect(() => interop.revokeShareLink('missing', 'owner-1')).toThrow(NotFoundException);
    expect(() => interop.revokeShareLink(link.id, 'owner-2')).toThrow(NotFoundException);
  });
});

describe('InteropService.resolveSharedBundle', () => {
  it('resolves an active token to a FHIR bundle over the owner’s documents', async () => {
    const { records, interop } = buildStack();
    const document = await records.captureDocument(makeCapture());
    const link = await interop.issueShareLink('owner-1', { documentIds: [document.id], ttlSeconds: 3600 });

    const bundle = await interop.resolveSharedBundle(link.token);
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.entry).toHaveLength(1);
  });

  it('404s for an unknown token', async () => {
    const { interop } = buildStack();
    await expect(interop.resolveSharedBundle('no-such-token')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('410s for a revoked token', async () => {
    const { records, interop } = buildStack();
    const document = await records.captureDocument(makeCapture());
    const link = await interop.issueShareLink('owner-1', { documentIds: [document.id], ttlSeconds: 3600 });
    interop.revokeShareLink(link.id, 'owner-1');

    await expect(interop.resolveSharedBundle(link.token)).rejects.toBeInstanceOf(GoneException);
  });

  it('refuses while health-records is down', async () => {
    const { records, interop } = buildStack();
    const document = await records.captureDocument(makeCapture());
    const link = await interop.issueShareLink('owner-1', { documentIds: [document.id], ttlSeconds: 3600 });

    records.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(interop.resolveSharedBundle(link.token)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('InteropService.health', () => {
  it('reports UP', async () => {
    const { interop } = buildStack();
    await expect(interop.health()).resolves.toEqual({ status: 'UP' });
  });
});

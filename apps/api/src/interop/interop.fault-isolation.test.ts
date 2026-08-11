import { buildModuleRegistry, collectHealthStates, resolveAvailability } from '@swasthya/module-registry';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { RecordsRepository } from '../records/records.repository.js';
import { createHealthRecordsModuleDescriptor } from '../records/records.module-descriptor.js';
import type { CaptureDocumentInput } from '../records/records.service.js';
import { RecordsService } from '../records/records.service.js';
import { createInteropModuleDescriptor } from './interop.module-descriptor.js';
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
  return { records };
}

/**
 * §2 rule 5, "the shell renders around holes," demonstrated against a real
 * thrown error, the same shape `EngagementRepository`'s own
 * `BrokenEngagementRepository` already uses.
 */
class BrokenInteropRepository extends InteropRepository {
  override save(): never {
    throw new Error('simulated store outage');
  }
}

describe('interop fault isolation', () => {
  it('a broken interop repository does not take health-records down with it', async () => {
    const { records } = buildStack();
    const document = await records.captureDocument(makeCapture());

    const broken = new InteropService(new BrokenInteropRepository(), records);
    await expect(
      broken.issueShareLink('owner-1', { documentIds: [document.id], ttlSeconds: 3600 }),
    ).rejects.toThrow('simulated store outage');

    // health-records keeps working — the outage is confined to interop's
    // own storage.
    expect(records.getDocument(document.id).id).toBe(document.id);
  });

  it('resolveAvailability marks INTEROP available but HIDE-degraded when HEALTH_RECORDS is DOWN', async () => {
    const { records } = buildStack();
    const interop = new InteropService(new InteropRepository(), records);

    const forcedDownRecordsDescriptor = {
      ...createHealthRecordsModuleDescriptor(records),
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const interopDescriptor = createInteropModuleDescriptor(interop);

    const registry = buildModuleRegistry([forcedDownRecordsDescriptor, interopDescriptor]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('HEALTH_RECORDS')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('INTEROP')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'HEALTH_RECORDS', mode: 'HIDE' }],
    });
  });

  it('behaviourally: refuses to issue or resolve a share link while health-records is down, and resumes once it recovers', async () => {
    const { records } = buildStack();
    const interop = new InteropService(new InteropRepository(), records);
    const document = await records.captureDocument(makeCapture());

    records.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(
      interop.issueShareLink('owner-1', { documentIds: [document.id], ttlSeconds: 3600 }),
    ).rejects.toThrow('health-records is down');

    records.health = () => Promise.resolve({ status: 'UP' });
    const link = await interop.issueShareLink('owner-1', { documentIds: [document.id], ttlSeconds: 3600 });
    expect(link.documentIds).toEqual([document.id]);
  });

  it('behaviourally: listing and revoking an already-issued link stay available while health-records is down', async () => {
    const { records } = buildStack();
    const interop = new InteropService(new InteropRepository(), records);
    const document = await records.captureDocument(makeCapture());
    const link = await interop.issueShareLink('owner-1', { documentIds: [document.id], ttlSeconds: 3600 });

    records.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    expect(interop.listShareLinks('owner-1')).toHaveLength(1);
    const revoked = interop.revokeShareLink(link.id, 'owner-1');
    expect(revoked.revokedAt).not.toBeNull();
  });
});

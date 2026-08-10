import { describe, expect, it } from 'vitest';
import { RecordsUsageReader } from './records-usage.reader.js';
import { RecordsRepository } from './records.repository.js';
import type { HealthDocument } from '@swasthya/shared-types';

function storedDocument(overrides: Partial<HealthDocument> = {}): HealthDocument {
  return {
    id: 'doc-1',
    ownerId: 'owner-1',
    kind: 'LAB_REPORT',
    status: 'STORED',
    ref: { backend: 'HOSTED', externalId: 'k', byteSize: 3, contentType: 'image/jpeg', checksumSha256: 'x' },
    title: 'Blood panel',
    documentDate: null,
    capturedAt: '2026-08-01T00:00:00.000Z',
    sensitivity: 'STANDARD',
    clientEncrypted: false,
    pageCount: 1,
    ...overrides,
  };
}

describe('RecordsUsageReader', () => {
  it('counts only the requested owner’s documents for DOCUMENTS_STORED', () => {
    const repository = new RecordsRepository();
    repository.saveDocument(storedDocument({ id: 'doc-1', ownerId: 'owner-1' }));
    repository.saveDocument(storedDocument({ id: 'doc-2', ownerId: 'owner-1' }));
    repository.saveDocument(storedDocument({ id: 'doc-3', ownerId: 'owner-2' }));

    const reader = new RecordsUsageReader(repository);
    expect(reader.read('owner-1', 'DOCUMENTS_STORED')).toBe(2);
    expect(reader.read('owner-2', 'DOCUMENTS_STORED')).toBe(1);
    expect(reader.read('owner-3', 'DOCUMENTS_STORED')).toBe(0);
  });

  it('fails loudly for a dimension it has no meter for, instead of reporting zero', () => {
    const reader = new RecordsUsageReader(new RecordsRepository());
    expect(() => reader.read('owner-1', 'ASSISTANT_MESSAGES_PER_MONTH')).toThrow(
      'RecordsUsageReader has no meter',
    );
  });
});

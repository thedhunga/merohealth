import { describe, expect, it } from 'vitest';
import type { HealthDocument, HealthObservation } from '@swasthya/shared-types';
import { RecordsRepository } from './records.repository.js';

function makeDocument(overrides: Partial<HealthDocument> = {}): HealthDocument {
  return {
    id: 'doc-1',
    ownerId: 'owner-1',
    kind: 'LAB_REPORT',
    status: 'STORED',
    ref: {
      backend: 'HOSTED',
      externalId: 'hosted-1',
      byteSize: 10,
      contentType: 'image/jpeg',
      checksumSha256: 'abc',
    },
    title: 'Blood panel',
    documentDate: null,
    capturedAt: '2026-08-01T00:00:00.000Z',
    sensitivity: 'STANDARD',
    clientEncrypted: false,
    pageCount: 1,
    ...overrides,
  };
}

function makeObservation(overrides: Partial<HealthObservation> = {}): HealthObservation {
  return {
    id: 'obs-1',
    documentId: 'doc-1',
    ownerId: 'owner-1',
    code: '2160-0',
    codeSystem: 'LOINC',
    labelNe: 'क्रिएटिनिन',
    labelEn: 'Creatinine',
    value: '1.1',
    unit: 'mg/dL',
    referenceRange: null,
    abnormalFlag: null,
    effectiveAt: null,
    status: 'DRAFT',
    provenance: 'DOCUMENT_EXTRACTED',
    confidence: 0.9,
    extractionRunId: 'run-1',
    ...overrides,
  };
}

describe('RecordsRepository', () => {
  it('round-trips a saved document by id', () => {
    const repository = new RecordsRepository();
    repository.saveDocument(makeDocument());

    expect(repository.findDocument('doc-1')?.title).toBe('Blood panel');
    expect(repository.findDocument('missing')).toBeNull();
  });

  it('scopes listDocuments to the requested owner only', () => {
    const repository = new RecordsRepository();
    repository.saveDocument(makeDocument({ id: 'a', ownerId: 'owner-1' }));
    repository.saveDocument(makeDocument({ id: 'b', ownerId: 'owner-2' }));

    expect(repository.listDocuments('owner-1').map((document) => document.id)).toEqual(['a']);
  });

  it('scopes observation listings to owner and to document independently', () => {
    const repository = new RecordsRepository();
    repository.saveObservation(makeObservation({ id: 'o1', ownerId: 'owner-1', documentId: 'doc-1' }));
    repository.saveObservation(makeObservation({ id: 'o2', ownerId: 'owner-1', documentId: 'doc-2' }));
    repository.saveObservation(makeObservation({ id: 'o3', ownerId: 'owner-2', documentId: 'doc-1' }));

    expect(repository.listObservationsForOwner('owner-1').map((o) => o.id).sort()).toEqual(['o1', 'o2']);
    expect(repository.listObservationsForDocument('doc-1').map((o) => o.id).sort()).toEqual(['o1', 'o3']);
  });

  it('overwrites rather than duplicates on a second save with the same id', () => {
    const repository = new RecordsRepository();
    repository.saveObservation(makeObservation({ id: 'o1', status: 'DRAFT' }));
    repository.saveObservation(makeObservation({ id: 'o1', status: 'CONFIRMED' }));

    expect(repository.listObservationsForOwner('owner-1')).toHaveLength(1);
    expect(repository.findObservation('o1')?.status).toBe('CONFIRMED');
  });
});

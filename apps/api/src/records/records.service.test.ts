import { NotFoundException } from '@nestjs/common';
import { InMemoryDocumentStore, StoragePolicyError } from '@swasthya/storage-adapters';
import type { HealthObservation } from '@swasthya/shared-types';
import { describe, expect, it } from 'vitest';
import { RecordsRepository } from './records.repository.js';
import { RecordsService, type CaptureDocumentInput } from './records.service.js';

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

function buildService(store = new InMemoryDocumentStore('HOSTED')) {
  const repository = new RecordsRepository();
  return { service: new RecordsService(repository, store), store, repository };
}

function draftObservation(overrides: Partial<HealthObservation> = {}): HealthObservation {
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
    effectiveAt: '2026-08-01',
    status: 'DRAFT',
    provenance: 'DOCUMENT_EXTRACTED',
    confidence: 0.6,
    extractionRunId: 'run-1',
    ...overrides,
  };
}

describe('RecordsService.captureDocument', () => {
  it('uploads through the injected store and records a STORED document', async () => {
    const { service, store } = buildService();
    const document = await service.captureDocument(makeCapture());

    expect(document.status).toBe('STORED');
    expect(document.ref.backend).toBe('HOSTED');
    await expect(store.get(document.ref)).resolves.toMatchObject({ clientEncrypted: false });
  });

  it('refuses readable bytes onto a bring-your-own backend', async () => {
    const { service } = buildService(new InMemoryDocumentStore('GOOGLE_DRIVE'));
    await expect(service.captureDocument(makeCapture({ clientEncrypted: false }))).rejects.toBeInstanceOf(
      StoragePolicyError,
    );
  });

  it('accepts a client-encrypted document onto a bring-your-own backend', async () => {
    const { service } = buildService(new InMemoryDocumentStore('GOOGLE_DRIVE'));
    const document = await service.captureDocument(makeCapture({ clientEncrypted: true }));
    expect(document.ref.backend).toBe('GOOGLE_DRIVE');
  });
});

describe('RecordsService document and timeline reads', () => {
  it('lists only the requested owner’s documents', async () => {
    const { service } = buildService();
    await service.captureDocument(makeCapture({ ownerId: 'owner-1' }));
    await service.captureDocument(makeCapture({ ownerId: 'owner-2' }));

    expect(service.listDocuments('owner-1')).toHaveLength(1);
  });

  it('throws for observations of an unknown document', () => {
    const { service } = buildService();
    expect(() => service.listDocumentObservations('missing')).toThrow(NotFoundException);
  });

  it('resolves a document by id, and throws for an unknown one', async () => {
    const { service } = buildService();
    const document = await service.captureDocument(makeCapture());

    expect(service.getDocument(document.id)).toBe(document);
    expect(() => service.getDocument('missing')).toThrow(NotFoundException);
  });

  it('builds a timeline from the owner’s own documents and observations', async () => {
    const { service } = buildService();
    const document = await service.captureDocument(makeCapture());

    expect(service.timeline('owner-1')).toEqual([
      expect.objectContaining({ documentId: document.id, observationCount: 0 }),
    ]);
  });
});

describe('RecordsService confirm/correct/reject', () => {
  it('confirms a draft observation', () => {
    const { service, repository } = buildService();
    repository.saveObservation(draftObservation());

    expect(service.confirm('obs-1').status).toBe('CONFIRMED');
  });

  it('corrects a draft observation, re-attributing it to the patient', () => {
    const { service, repository } = buildService();
    repository.saveObservation(draftObservation());

    const corrected = service.correct('obs-1', '2.4', undefined);
    expect(corrected.value).toBe('2.4');
    expect(corrected.unit).toBe('mg/dL');
    expect(corrected.provenance).toBe('PATIENT_REPORTED');
  });

  it('lets a correction explicitly clear the unit', () => {
    const { service, repository } = buildService();
    repository.saveObservation(draftObservation());

    expect(service.correct('obs-1', '2.4', null).unit).toBeNull();
  });

  it('rejects a draft observation', () => {
    const { service, repository } = buildService();
    repository.saveObservation(draftObservation());

    expect(service.reject('obs-1').status).toBe('REJECTED');
  });

  it('throws NotFoundException for an unknown observation on every action', () => {
    const { service } = buildService();
    expect(() => service.confirm('missing')).toThrow(NotFoundException);
    expect(() => service.correct('missing', '1', null)).toThrow(NotFoundException);
    expect(() => service.reject('missing')).toThrow(NotFoundException);
  });
});

describe('RecordsService.health', () => {
  it('reports UP', async () => {
    const { service } = buildService();
    await expect(service.health()).resolves.toEqual({ status: 'UP' });
  });
});

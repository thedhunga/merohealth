import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InMemoryDocumentStore, StoragePolicyError } from '@swasthya/storage-adapters';
import type { HealthObservation } from '@swasthya/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { ExtractionResult, RecordExtractionService } from './record-extraction.service.js';
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

function buildService(store = new InMemoryDocumentStore('HOSTED'), extraction?: RecordExtractionService) {
  const repository = new RecordsRepository();
  return { service: new RecordsService(repository, store, extraction), store, repository };
}

/** A stand-in extraction port whose result (or failure) the test controls. */
class StubExtractionService implements RecordExtractionService {
  constructor(private readonly result: ExtractionResult | (() => Promise<ExtractionResult>)) {}
  extract(): Promise<ExtractionResult> {
    return typeof this.result === 'function' ? this.result() : Promise.resolve(this.result);
  }
}

/** Simulates the provider being genuinely down — every call rejects. */
class BrokenExtractionService implements RecordExtractionService {
  extract(): Promise<ExtractionResult> {
    throw new Error('simulated extraction outage');
  }
}

/** Fails the first call, then succeeds — models a transient outage a manual retry recovers from. */
class FlakyExtractionService implements RecordExtractionService {
  #calls = 0;
  constructor(private readonly recoveredResult: ExtractionResult) {}
  extract(): Promise<ExtractionResult> {
    this.#calls += 1;
    if (this.#calls === 1) throw new Error('simulated outage, first call only');
    return Promise.resolve(this.recoveredResult);
  }
}

const BP_READING: ExtractionResult = {
  status: 'complete',
  observations: [
    { code: '8480-6', codeSystem: 'LOINC', labelNe: 'सिस्टोलिक रक्तचाप', labelEn: 'Systolic blood pressure', value: '132', unit: 'mmHg', confidence: 0.9 },
    { code: '8462-4', codeSystem: 'LOINC', labelNe: 'डायस्टोलिक रक्तचाप', labelEn: 'Diastolic blood pressure', value: '84', unit: 'mmHg', confidence: 0.9 },
  ],
};

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

describe('RecordsService.captureDocument extraction', () => {
  it('never attempts extraction when no extraction service is wired', async () => {
    const { service } = buildService();
    const document = await service.captureDocument(makeCapture());
    expect(document.status).toBe('STORED');
  });

  it('never attempts extraction on a client-encrypted document — extraction for those runs on-device', async () => {
    const { service, repository } = buildService(new InMemoryDocumentStore('HOSTED'), new StubExtractionService(BP_READING));
    const document = await service.captureDocument(makeCapture({ clientEncrypted: true }));
    expect(document.status).toBe('STORED');
    expect(repository.listObservationsForOwner('owner-1')).toHaveLength(0);
  });

  it('never attempts extraction on a document with no image content type', async () => {
    const { service, repository } = buildService(new InMemoryDocumentStore('HOSTED'), new StubExtractionService(BP_READING));
    const document = await service.captureDocument(makeCapture({ contentType: 'application/pdf' }));
    expect(document.status).toBe('STORED');
    expect(repository.listObservationsForOwner('owner-1')).toHaveLength(0);
  });

  it('creates DRAFT observations and moves the document to AWAITING_CONFIRMATION on a legible reading', async () => {
    const { service, repository } = buildService(new InMemoryDocumentStore('HOSTED'), new StubExtractionService(BP_READING));
    const document = await service.captureDocument(makeCapture());

    expect(document.status).toBe('AWAITING_CONFIRMATION');
    const observations = repository.listObservationsForDocument(document.id);
    expect(observations).toHaveLength(2);
    expect(observations.every((observation) => observation.status === 'DRAFT')).toBe(true);
    expect(observations.every((observation) => observation.provenance === 'DOCUMENT_EXTRACTED')).toBe(true);
    // effectiveAt comes from the person's own documentDate, never invented by the extractor.
    expect(observations.every((observation) => observation.effectiveAt === '2026-08-01')).toBe(true);
  });

  it('falls back to capturedAt for effectiveAt when the person gave no documentDate', async () => {
    const { service, repository } = buildService(new InMemoryDocumentStore('HOSTED'), new StubExtractionService(BP_READING));
    const document = await service.captureDocument(makeCapture({ documentDate: null }));
    const [observation] = repository.listObservationsForDocument(document.id);
    expect(observation!.effectiveAt).toBe(document.capturedAt);
  });

  it('moves straight to CONFIRMED when extraction runs but finds nothing legible — nothing to review', async () => {
    const { service } = buildService(
      new InMemoryDocumentStore('HOSTED'),
      new StubExtractionService({ status: 'complete', observations: [] }),
    );
    const document = await service.captureDocument(makeCapture());
    expect(document.status).toBe('CONFIRMED');
  });

  it('lands on EXTRACTION_FAILED, not lost, when the provider is not configured', async () => {
    const { service, repository } = buildService(
      new InMemoryDocumentStore('HOSTED'),
      new StubExtractionService({ status: 'setup-required', observations: [] }),
    );
    const document = await service.captureDocument(makeCapture());

    expect(document.status).toBe('EXTRACTION_FAILED');
    expect(repository.findDocument(document.id)).not.toBeNull();
  });

  it('outage test: the extraction service DOWN still stores the photo and leaves the rest of the module working', async () => {
    const { service, repository } = buildService(new InMemoryDocumentStore('HOSTED'), new BrokenExtractionService());

    // The capture that hits the broken dependency does not throw...
    const failed = await service.captureDocument(makeCapture({ title: 'Failed extraction' }));
    expect(failed.status).toBe('EXTRACTION_FAILED');
    // ...nothing is lost: the document is still there, retrievable...
    expect(service.getDocument(failed.id)).toMatchObject({ id: failed.id, title: 'Failed extraction' });
    expect(service.listDocuments('owner-1').map((d) => d.id)).toContain(failed.id);
    // ...and the rest of the module — a sibling capture, reads, confirm/correct/reject — is unaffected.
    repository.saveObservation({
      id: 'sibling-obs',
      documentId: 'sibling-doc',
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
      confidence: 0.9,
      extractionRunId: 'run-sibling',
    });
    expect(service.confirm('sibling-obs', 'owner-1').status).toBe('CONFIRMED');

    const otherStore = new InMemoryDocumentStore('HOSTED');
    const otherService = new RecordsService(new RecordsRepository(), otherStore);
    const unaffected = await otherService.captureDocument(makeCapture({ ownerId: 'owner-2' }));
    expect(unaffected.status).toBe('STORED');
  });
});

describe('RecordsService.retryExtraction', () => {
  it('re-attempts extraction on a document stuck at EXTRACTION_FAILED and lands on AWAITING_CONFIRMATION once the provider recovers', async () => {
    const { service } = buildService(new InMemoryDocumentStore('HOSTED'), new FlakyExtractionService(BP_READING));
    const failed = await service.captureDocument(makeCapture());
    expect(failed.status).toBe('EXTRACTION_FAILED');

    const retried = await service.retryExtraction(failed.id, 'owner-1');
    expect(retried.status).toBe('AWAITING_CONFIRMATION');
  });

  it('lands on EXTRACTION_FAILED again, not lost, when the provider is still down on retry', async () => {
    const { service } = buildService(new InMemoryDocumentStore('HOSTED'), new BrokenExtractionService());
    const failed = await service.captureDocument(makeCapture());

    const retried = await service.retryExtraction(failed.id, 'owner-1');
    expect(retried.status).toBe('EXTRACTION_FAILED');
    expect(service.getDocument(failed.id).status).toBe('EXTRACTION_FAILED');
  });

  it('does not re-upload bytes — refetches them from the store by the document’s existing ref', async () => {
    const store = new InMemoryDocumentStore('HOSTED');
    const { service } = buildService(store, new FlakyExtractionService(BP_READING));
    const failed = await service.captureDocument(makeCapture());

    const putSpy = vi.spyOn(store, 'put');
    await service.retryExtraction(failed.id, 'owner-1');
    expect(putSpy).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for an unknown document, or a caller who is not its owner', async () => {
    const { service } = buildService(new InMemoryDocumentStore('HOSTED'), new BrokenExtractionService());
    const failed = await service.captureDocument(makeCapture());

    await expect(service.retryExtraction('missing', 'owner-1')).rejects.toThrow(NotFoundException);
    await expect(service.retryExtraction(failed.id, 'owner-2')).rejects.toThrow(NotFoundException);
  });

  it('refuses to retry a document that never reached EXTRACTION_FAILED', async () => {
    const { service } = buildService(new InMemoryDocumentStore('HOSTED'), new StubExtractionService(BP_READING));
    const document = await service.captureDocument(makeCapture());
    expect(document.status).toBe('AWAITING_CONFIRMATION');

    await expect(service.retryExtraction(document.id, 'owner-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to retry when no extraction provider is configured, without losing the document', async () => {
    const store = new InMemoryDocumentStore('HOSTED');
    const repository = new RecordsRepository();
    const withExtraction = new RecordsService(repository, store, new BrokenExtractionService());
    const failed = await withExtraction.captureDocument(makeCapture());

    // Same repository/store, a service instance with no extraction wired —
    // models the provider becoming unconfigured between the original attempt
    // and the retry.
    const unconfigured = new RecordsService(repository, store);
    await expect(unconfigured.retryExtraction(failed.id, 'owner-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(unconfigured.getDocument(failed.id).status).toBe('EXTRACTION_FAILED');
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
    expect(() => service.listDocumentObservations('missing', 'owner-1')).toThrow(NotFoundException);
  });

  it('404s observations of a document that belongs to a different owner', async () => {
    const { service } = buildService();
    const document = await service.captureDocument(makeCapture({ ownerId: 'owner-1' }));

    expect(() => service.listDocumentObservations(document.id, 'owner-2')).toThrow(NotFoundException);
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

  it('lists an owner’s observations regardless of status, for interop to filter', () => {
    const { service, repository } = buildService();
    repository.saveObservation(draftObservation({ id: 'obs-owner-1' }));
    repository.saveObservation(draftObservation({ id: 'obs-owner-2', ownerId: 'owner-2' }));

    const observations = service.listObservationsForOwner('owner-1');
    expect(observations.map((observation) => observation.id)).toEqual(['obs-owner-1']);
  });
});

describe('RecordsService confirm/correct/reject', () => {
  it('confirms a draft observation', () => {
    const { service, repository } = buildService();
    repository.saveObservation(draftObservation());

    expect(service.confirm('obs-1', 'owner-1').status).toBe('CONFIRMED');
  });

  it('corrects a draft observation, re-attributing it to the patient', () => {
    const { service, repository } = buildService();
    repository.saveObservation(draftObservation());

    const corrected = service.correct('obs-1', 'owner-1', '2.4', undefined);
    expect(corrected.value).toBe('2.4');
    expect(corrected.unit).toBe('mg/dL');
    expect(corrected.provenance).toBe('PATIENT_REPORTED');
  });

  it('lets a correction explicitly clear the unit', () => {
    const { service, repository } = buildService();
    repository.saveObservation(draftObservation());

    expect(service.correct('obs-1', 'owner-1', '2.4', null).unit).toBeNull();
  });

  it('rejects a draft observation', () => {
    const { service, repository } = buildService();
    repository.saveObservation(draftObservation());

    expect(service.reject('obs-1', 'owner-1').status).toBe('REJECTED');
  });

  it('throws NotFoundException for an unknown observation on every action', () => {
    const { service } = buildService();
    expect(() => service.confirm('missing', 'owner-1')).toThrow(NotFoundException);
    expect(() => service.correct('missing', 'owner-1', '1', null)).toThrow(NotFoundException);
    expect(() => service.reject('missing', 'owner-1')).toThrow(NotFoundException);
  });

  it('404s every action for a caller who is not the observation’s owner', () => {
    const { service, repository } = buildService();
    repository.saveObservation(draftObservation());

    expect(() => service.confirm('obs-1', 'owner-2')).toThrow(NotFoundException);
    expect(() => service.correct('obs-1', 'owner-2', '1', null)).toThrow(NotFoundException);
    expect(() => service.reject('obs-1', 'owner-2')).toThrow(NotFoundException);
  });
});

describe('RecordsService.health', () => {
  it('reports UP', async () => {
    const { service } = buildService();
    await expect(service.health()).resolves.toEqual({ status: 'UP' });
  });
});

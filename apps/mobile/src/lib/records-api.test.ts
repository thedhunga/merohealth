import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HealthDocument, HealthObservation } from '@swasthya/shared-types';
import {
  RecordsApiError,
  captureDocument,
  confirmObservation,
  listDocuments,
  listPendingConfirmations,
  retryDocumentExtraction,
} from './records-api';

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
      checksumSha256: 'abc123',
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
    referenceRange: '0.7-1.3',
    abnormalFlag: 'NORMAL',
    effectiveAt: '2026-01-01',
    status: 'DRAFT',
    provenance: 'DOCUMENT_EXTRACTED',
    confidence: 0.6,
    extractionRunId: 'run-1',
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('captureDocument', () => {
  it('posts to /documents and returns the stored document', async () => {
    const document = makeDocument();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, document));
    vi.stubGlobal('fetch', fetchMock);

    const result = await captureDocument({
      filename: 'scan.jpg',
      kind: 'LAB_REPORT',
      title: 'Blood panel',
      contentType: 'image/jpeg',
      bytesBase64: 'ZmFrZQ==',
    });

    expect(result).toEqual(document);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/records/documents',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses EXPO_PUBLIC_API_URL when it is configured', async () => {
    vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://api.example.invalid/');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, []));
    vi.stubGlobal('fetch', fetchMock);

    await listDocuments();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.invalid/v1/records/documents',
      expect.anything(),
    );
  });

  it('surfaces the entitlements guard verdict on a 403 as a typed error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(403, {
        code: 'QUOTA_EXCEEDED',
        message: 'Document limit reached',
        upgradeTo: 'PLUS',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      captureDocument({
        filename: 'scan.jpg',
        kind: 'LAB_REPORT',
        title: 'Blood panel',
        contentType: 'image/jpeg',
        bytesBase64: 'ZmFrZQ==',
      }),
    ).rejects.toMatchObject(
      new RecordsApiError('Document limit reached', 'QUOTA_EXCEEDED', 'PLUS'),
    );
  });
});

describe('listPendingConfirmations', () => {
  it('aggregates DRAFT observations across every document, worst-confidence first', async () => {
    const documents = [makeDocument({ id: 'doc-1' }), makeDocument({ id: 'doc-2' })];
    const lowConfidence = makeObservation({ id: 'obs-low', documentId: 'doc-1', confidence: 0.3 });
    const highConfidence = makeObservation({ id: 'obs-high', documentId: 'doc-2', confidence: 0.7 });
    const confirmed = makeObservation({ id: 'obs-confirmed', documentId: 'doc-2', status: 'CONFIRMED' });

    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/documents')) return Promise.resolve(jsonResponse(200, { items: documents }));
      if (url.includes('doc-1/observations'))
        return Promise.resolve(jsonResponse(200, { items: [lowConfidence] }));
      if (url.includes('doc-2/observations'))
        return Promise.resolve(jsonResponse(200, { items: [highConfidence, confirmed] }));
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await listPendingConfirmations();

    expect(result.map((observation) => observation.id)).toEqual(['obs-low', 'obs-high']);
  });
});

describe('confirmObservation', () => {
  it('posts to the confirm endpoint for the given observation id, with no body', async () => {
    const confirmed = makeObservation({ status: 'CONFIRMED' });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, confirmed));
    vi.stubGlobal('fetch', fetchMock);

    const result = await confirmObservation('obs-1');

    expect(result.status).toBe('CONFIRMED');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/records/observations/obs-1/confirm',
      expect.objectContaining({ method: 'POST', body: undefined }),
    );
  });
});

describe('retryDocumentExtraction', () => {
  it('posts to the retry-extraction endpoint for the given document id, with no body', async () => {
    const retried = makeDocument({ status: 'EXTRACTING' });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, retried));
    vi.stubGlobal('fetch', fetchMock);

    const result = await retryDocumentExtraction('doc-1');

    expect(result.status).toBe('EXTRACTING');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/records/documents/doc-1/retry-extraction',
      expect.objectContaining({ method: 'POST', body: undefined }),
    );
  });

  it('throws RecordsApiError, matching every other call in this file, on a non-OK response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(400, { code: 'DOCUMENT_NOT_EXTRACTION_FAILED', message: 'Not stuck' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(retryDocumentExtraction('doc-1')).rejects.toMatchObject(
      new RecordsApiError('Not stuck', 'DOCUMENT_NOT_EXTRACTION_FAILED', null),
    );
  });
});

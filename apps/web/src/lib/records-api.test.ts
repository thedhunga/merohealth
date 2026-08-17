import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  captureBloodPressurePhoto,
  confirmObservation,
  fetchAllObservations,
  fetchDocumentObservations,
  rejectObservation,
  retryDocumentExtraction,
} from '@/lib/records-api';

function mockFetchOnce(status: number, body: unknown = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubGlobal('window', {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('captureBloodPressurePhoto', () => {
  it('base64-encodes the file and posts an OTHER-kind document with no documentDate', async () => {
    const document = { id: 'doc-1', status: 'AWAITING_CONFIRMATION' };
    const fetchMock = mockFetchOnce(200, document);
    const file = new File([new Uint8Array([1, 2, 3])], 'cuff.jpg', { type: 'image/jpeg' });

    const result = await captureBloodPressurePhoto({ file, title: 'Blood pressure reading' });

    expect(result).toEqual(document);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/records/documents');
    expect(init.credentials).toBe('include');
    const body = JSON.parse(init.body as string) as {
      kind: string;
      title: string;
      contentType: string;
      bytesBase64: string;
      documentDate?: string;
    };
    expect(body.kind).toBe('OTHER');
    expect(body.title).toBe('Blood pressure reading');
    expect(body.contentType).toBe('image/jpeg');
    expect(body.documentDate).toBeUndefined();
    expect(Buffer.from(body.bytesBase64, 'base64')).toEqual(Buffer.from([1, 2, 3]));
  });

  it('resolves null, never throws, on a server error', async () => {
    mockFetchOnce(500);
    const file = new File([new Uint8Array([1])], 'cuff.jpg', { type: 'image/jpeg' });

    expect(await captureBloodPressurePhoto({ file, title: 'x' })).toBeNull();
  });

  it('resolves null, never throws, when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const file = new File([new Uint8Array([1])], 'cuff.jpg', { type: 'image/jpeg' });

    expect(await captureBloodPressurePhoto({ file, title: 'x' })).toBeNull();
  });
});

describe('fetchDocumentObservations / fetchAllObservations', () => {
  it('returns the items array on success', async () => {
    mockFetchOnce(200, { items: [{ id: 'obs-1' }], total: 1 });
    expect(await fetchDocumentObservations('doc-1')).toEqual([{ id: 'obs-1' }]);
  });

  it('fetches the all-observations route with credentials included', async () => {
    const fetchMock = mockFetchOnce(200, { items: [], total: 0 });
    await fetchAllObservations();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/records/observations');
    expect(init.credentials).toBe('include');
  });

  it('resolves null, never throws, on a server error', async () => {
    mockFetchOnce(500);
    expect(await fetchAllObservations()).toBeNull();
  });

  it('resolves null, never throws, when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fetchDocumentObservations('doc-1')).toBeNull();
  });
});

describe('confirmObservation / rejectObservation', () => {
  it('posts to the confirm route and resolves true on success', async () => {
    const fetchMock = mockFetchOnce(200);
    const result = await confirmObservation('obs-1');
    expect(result).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/records/observations/obs-1/confirm');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
  });

  it('posts to the reject route and resolves true on success', async () => {
    const fetchMock = mockFetchOnce(200);
    await rejectObservation('obs-1');
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/records/observations/obs-1/reject');
  });

  it('resolves false, never throws, on a server error', async () => {
    mockFetchOnce(500);
    expect(await confirmObservation('obs-1')).toBe(false);
  });

  it('resolves false, never throws, when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await rejectObservation('obs-1')).toBe(false);
  });
});

describe('retryDocumentExtraction', () => {
  it('posts to the retry-extraction route and resolves the updated document', async () => {
    const document = { id: 'doc-1', status: 'AWAITING_CONFIRMATION' };
    const fetchMock = mockFetchOnce(200, document);

    const result = await retryDocumentExtraction('doc-1');

    expect(result).toEqual(document);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/records/documents/doc-1/retry-extraction');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
  });

  it('resolves null, never throws, on a server error', async () => {
    mockFetchOnce(400);
    expect(await retryDocumentExtraction('doc-1')).toBeNull();
  });

  it('resolves null, never throws, when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await retryDocumentExtraction('doc-1')).toBeNull();
  });
});

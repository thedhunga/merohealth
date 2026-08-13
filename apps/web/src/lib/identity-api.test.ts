import { afterEach, describe, expect, it, vi } from 'vitest';

import { getMyVerification, IdentityApiError, submitIdentityEvidence } from '@/lib/identity-api';

function mockFetchOnce(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const verification = {
  id: 'verification-1',
  ownerId: 'subject-1',
  status: 'NOT_STARTED',
  documentType: null,
  evidenceImageRef: null,
  rejectionReason: null,
  submittedAt: null,
  decidedAt: null,
};

describe('getMyVerification', () => {
  it('gets /v1/identity/verification/me with credentials included', async () => {
    const fetchMock = mockFetchOnce(200, verification);

    const result = await getMyVerification();

    expect(result).toEqual(verification);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/identity/verification/me');
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('include');
  });

  it('surfaces the server-provided machine-readable code on failure', async () => {
    mockFetchOnce(401, { code: 'UNAUTHENTICATED', message: 'No session' });

    await expect(getMyVerification()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(getMyVerification()).rejects.toBeInstanceOf(IdentityApiError);
  });
});

describe('submitIdentityEvidence', () => {
  const input = { documentType: 'NATIONAL_ID' as const, evidenceImageRef: 'local-file:national-id.jpg' };

  it('posts to /v1/identity/verification/evidence with credentials included and the input as a JSON body', async () => {
    const fetchMock = mockFetchOnce(201, { ...verification, status: 'EVIDENCE_SUBMITTED' });

    const result = await submitIdentityEvidence(input);

    expect(result.status).toBe('EVIDENCE_SUBMITTED');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/identity/verification/evidence');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body as string)).toEqual(input);
  });

  it('never carries an ownerId — the server derives it from the session', async () => {
    const fetchMock = mockFetchOnce(201, verification);

    await submitIdentityEvidence(input);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).not.toHaveProperty('ownerId');
  });

  it('falls back to a status-based message when the body has no message, e.g. an uncaught 500', async () => {
    mockFetchOnce(500, {});

    await expect(submitIdentityEvidence(input)).rejects.toMatchObject({ code: null, message: 'Request failed (500)' });
  });
});

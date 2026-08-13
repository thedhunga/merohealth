import { afterEach, describe, expect, it, vi } from 'vitest';

import { CredentialingApiError, getMyCredentialingApplication, submitCredentialingApplication } from '@/lib/credentialing-api';

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

describe('submitCredentialingApplication', () => {
  const input = {
    council: 'NMC' as const,
    registrationNumber: '12345',
    certificateImageRef: 'local-file:certificate.jpg',
    identityImageRef: 'local-file:citizenship.jpg',
  };

  it('posts to /v1/credentialing/applications with credentials included and the input as a JSON body', async () => {
    const application = {
      id: 'app-1',
      applicantId: 'subject-1',
      council: 'NMC',
      registrationNumber: '12345',
      status: 'EVIDENCE_SUBMITTED',
      certificateImageRef: 'local-file:certificate.jpg',
      identityImageRef: 'local-file:citizenship.jpg',
      submittedAt: '2026-08-13T00:00:00.000Z',
      rejectionReason: null,
      reviewerId: null,
      decidedAt: null,
    };
    const fetchMock = mockFetchOnce(201, application);

    const result = await submitCredentialingApplication(input);

    expect(result).toEqual(application);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/credentialing/applications');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body as string)).toEqual(input);
  });

  it('never carries an applicantId — the server derives it from the session', async () => {
    const fetchMock = mockFetchOnce(201, { id: 'app-1' });

    await submitCredentialingApplication(input);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).not.toHaveProperty('applicantId');
  });

  it('surfaces the server-provided machine-readable code on failure, e.g. VALIDATION_ERROR', async () => {
    mockFetchOnce(400, { code: 'VALIDATION_ERROR', message: 'Invalid request' });

    await expect(submitCredentialingApplication(input)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(submitCredentialingApplication(input)).rejects.toBeInstanceOf(CredentialingApiError);
  });

  it('falls back to a status-based message when the body has no message, e.g. an uncaught 500', async () => {
    mockFetchOnce(500, {});

    await expect(submitCredentialingApplication(input)).rejects.toMatchObject({ code: null, message: 'Request failed (500)' });
  });
});

describe('getMyCredentialingApplication', () => {
  it('gets /v1/credentialing/applications/me with credentials included', async () => {
    const fetchMock = mockFetchOnce(200, null);

    await getMyCredentialingApplication();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/credentialing/applications/me');
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('include');
  });

  it('returns null for an applicant who has never submitted', async () => {
    mockFetchOnce(200, null);

    await expect(getMyCredentialingApplication()).resolves.toBeNull();
  });

  it('returns the real application when one exists', async () => {
    const application = {
      id: 'app-1',
      applicantId: 'subject-1',
      council: 'NMC',
      registrationNumber: '12345',
      status: 'UNDER_REVIEW',
      certificateImageRef: null,
      identityImageRef: null,
      submittedAt: '2026-08-13T00:00:00.000Z',
      rejectionReason: null,
      reviewerId: null,
      decidedAt: null,
    };
    mockFetchOnce(200, application);

    await expect(getMyCredentialingApplication()).resolves.toEqual(application);
  });

  it('surfaces the server-provided machine-readable code on failure', async () => {
    mockFetchOnce(500, { code: null, message: null });

    await expect(getMyCredentialingApplication()).rejects.toBeInstanceOf(CredentialingApiError);
  });
});

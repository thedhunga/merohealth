import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthApiError, getCurrentUser, logout, requestOtp, verifyGoogleCredential, verifyOtp } from '@/lib/auth-api';

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

describe('requestOtp', () => {
  it('posts to /v1/auth/otp/request with credentials included', async () => {
    const fetchMock = mockFetchOnce(200, { challengeId: 'c1', expiresAt: '2026-08-10T00:00:00.000Z' });

    const result = await requestOtp('9812345678');

    expect(result.challengeId).toBe('c1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/auth/otp/request');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body as string)).toEqual({ phone: '9812345678' });
  });

  it('surfaces the server-provided machine-readable code on failure', async () => {
    mockFetchOnce(400, { code: 'INVALID_PHONE', message: 'nope' });

    await expect(requestOtp('123')).rejects.toMatchObject({ code: 'INVALID_PHONE' });
    await expect(requestOtp('123')).rejects.toBeInstanceOf(AuthApiError);
  });

  it('falls back to a status-based message when the body has no message', async () => {
    mockFetchOnce(500, {});

    await expect(requestOtp('9812345678')).rejects.toMatchObject({ code: null, message: 'Request failed (500)' });
  });
});

describe('verifyOtp', () => {
  it('posts the full verify payload', async () => {
    const fetchMock = mockFetchOnce(200, {
      token: 't1',
      userId: 'u1',
      phone: '9812345678',
      role: 'PATIENT',
      locale: 'ne',
      patientProfileId: 'p1',
      assuranceLevel: 'REGISTERED',
    });

    const result = await verifyOtp({
      challengeId: 'c1',
      code: '123456',
      phone: '9812345678',
      intent: 'REGISTER',
      displayName: 'Sita Rai',
    });

    expect(result.token).toBe('t1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/auth/otp/verify');
    expect(JSON.parse(init.body as string)).toEqual({
      challengeId: 'c1',
      code: '123456',
      phone: '9812345678',
      intent: 'REGISTER',
      displayName: 'Sita Rai',
    });
  });
});

describe('verifyGoogleCredential', () => {
  it('posts the idToken, intent and locale to /v1/auth/google/verify', async () => {
    const fetchMock = mockFetchOnce(200, {
      status: 'complete',
      token: 't1',
      userId: 'u1',
      email: 'sita@example.com',
      phone: null,
      role: 'PATIENT',
      locale: 'ne',
      patientProfileId: 'p1',
      assuranceLevel: 'REGISTERED',
    });

    const result = await verifyGoogleCredential({ idToken: 'id-token', intent: 'REGISTER', locale: 'ne' });

    expect(result).toMatchObject({ status: 'complete', token: 't1', email: 'sita@example.com' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/auth/google/verify');
    expect(JSON.parse(init.body as string)).toEqual({ idToken: 'id-token', intent: 'REGISTER', locale: 'ne' });
  });

  it('reports setup-required as a normal response, not a thrown error', async () => {
    mockFetchOnce(200, { status: 'setup-required' });

    const result = await verifyGoogleCredential({ idToken: 'id-token', intent: 'SIGN_IN' });

    expect(result).toEqual({ status: 'setup-required' });
  });

  it('surfaces GOOGLE_TOKEN_INVALID as a typed AuthApiError', async () => {
    mockFetchOnce(401, { code: 'GOOGLE_TOKEN_INVALID', message: 'bad token' });

    await expect(verifyGoogleCredential({ idToken: 'bad', intent: 'SIGN_IN' })).rejects.toMatchObject({
      code: 'GOOGLE_TOKEN_INVALID',
    });
  });
});

describe('getCurrentUser', () => {
  it('gets /v1/auth/me with credentials included and no body', async () => {
    const fetchMock = mockFetchOnce(200, {
      userId: 'u1',
      phone: '9812345678',
      role: 'PATIENT',
      locale: 'ne',
      patientProfileId: 'p1',
      assuranceLevel: 'REGISTERED',
    });

    const result = await getCurrentUser();

    expect(result.assuranceLevel).toBe('REGISTERED');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/auth/me');
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('include');
    expect(init.body).toBeUndefined();
  });

  it('surfaces UNAUTHENTICATED as a typed AuthApiError so useSession can branch on it, not a generic failure', async () => {
    mockFetchOnce(401, { code: 'UNAUTHENTICATED', message: 'Sign in required' });

    await expect(getCurrentUser()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});

describe('logout', () => {
  it('posts to /v1/auth/logout with credentials included', async () => {
    const fetchMock = mockFetchOnce(200, { ok: true });

    await logout();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/auth/logout');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
  });
});

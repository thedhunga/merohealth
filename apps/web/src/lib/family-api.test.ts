import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDelegation, FamilyApiError, getFamilyGrants, revokeDelegation } from '@/lib/family-api';

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

describe('getFamilyGrants', () => {
  it('gets /v1/family/grants with credentials included and no body', async () => {
    const fetchMock = mockFetchOnce(200, { guardianships: [], delegations: [] });

    const result = await getFamilyGrants();

    expect(result).toEqual({ guardianships: [], delegations: [] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/family/grants');
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('include');
    expect(init.body).toBeUndefined();
  });

  it('passes real guardianship/delegation rows through untouched', async () => {
    const guardianship = {
      id: 'g-1',
      wardId: 'roshani',
      guardianId: 'sunita',
      grounds: 'MINOR',
      grantedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2032-03-10T00:00:00.000Z',
      revokedAt: null,
    };
    mockFetchOnce(200, { guardianships: [guardianship], delegations: [] });

    const result = await getFamilyGrants();

    expect(result.guardianships).toEqual([guardianship]);
  });

  it('surfaces the server-provided machine-readable code on failure', async () => {
    mockFetchOnce(401, { code: 'UNAUTHENTICATED', message: 'Sign in required' });

    await expect(getFamilyGrants()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(getFamilyGrants()).rejects.toBeInstanceOf(FamilyApiError);
  });

  it('falls back to a status-based message when the body has no message', async () => {
    mockFetchOnce(500, {});

    await expect(getFamilyGrants()).rejects.toMatchObject({ code: null, message: 'Request failed (500)' });
  });
});

describe('createDelegation', () => {
  it('posts to /v1/family/grants/delegations with the input as a JSON body', async () => {
    const grant = {
      id: 'd-1',
      granterId: 'janaki',
      delegateId: 'sunita',
      scopes: ['VIEW_RECORD'],
      grantedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
      revokedAt: null,
      enrolment: null,
    };
    const fetchMock = mockFetchOnce(201, grant);

    const input = { delegatePhone: '9812345678', scopes: ['VIEW_RECORD'] as const, expiresAt: '2027-01-01T00:00:00.000Z' };
    const result = await createDelegation(input);

    expect(result).toEqual(grant);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/family/grants/delegations');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body as string)).toEqual(input);
  });

  it('surfaces the server-provided machine-readable code on failure, e.g. DELEGATE_NOT_FOUND', async () => {
    mockFetchOnce(404, { code: 'DELEGATE_NOT_FOUND', message: 'No registered person with phone 9800000000' });

    await expect(createDelegation({ delegatePhone: '9800000000', scopes: ['VIEW_RECORD'], expiresAt: '2027-01-01T00:00:00.000Z' })).rejects.toMatchObject(
      { code: 'DELEGATE_NOT_FOUND' },
    );
  });
});

describe('revokeDelegation', () => {
  it('deletes /v1/family/grants/delegations/:id with credentials included and no body', async () => {
    const grant = {
      id: 'd-1',
      granterId: 'janaki',
      delegateId: 'sunita',
      scopes: ['VIEW_RECORD'],
      grantedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
      revokedAt: '2026-06-01T00:00:00.000Z',
      enrolment: null,
    };
    const fetchMock = mockFetchOnce(200, grant);

    const result = await revokeDelegation('d-1');

    expect(result).toEqual(grant);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/family/grants/delegations/d-1');
    expect(init.method).toBe('DELETE');
    expect(init.credentials).toBe('include');
    expect(init.body).toBeUndefined();
  });

  it('surfaces the server-provided machine-readable code on failure, e.g. DELEGATION_NOT_FOUND', async () => {
    mockFetchOnce(404, { code: 'DELEGATION_NOT_FOUND', message: 'No delegation d-1' });

    await expect(revokeDelegation('d-1')).rejects.toMatchObject({ code: 'DELEGATION_NOT_FOUND' });
  });
});

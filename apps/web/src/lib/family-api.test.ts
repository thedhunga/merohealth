import { afterEach, describe, expect, it, vi } from 'vitest';

import { FamilyApiError, getFamilyGrants } from '@/lib/family-api';

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

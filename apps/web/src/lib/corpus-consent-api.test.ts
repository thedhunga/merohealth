import { afterEach, describe, expect, it, vi } from 'vitest';

import { CorpusConsentApiError, getCorpusConsentGrants, grantCorpusConsent, revokeCorpusConsent } from '@/lib/corpus-consent-api';

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

describe('getCorpusConsentGrants', () => {
  it('gets /v1/language-corpus/consent with credentials included and no body', async () => {
    const fetchMock = mockFetchOnce(200, { grants: [], total: 0 });

    const grants = await getCorpusConsentGrants();

    expect(grants).toEqual([]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/language-corpus/consent');
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('include');
    expect(init.body).toBeUndefined();
  });

  it('passes real grant rows through untouched, including revoked ones', async () => {
    const grant = {
      id: 'c-1',
      userId: 'owner-1',
      kind: 'HEALTH_CONVERSATION_AUDIO',
      version: 'consent-copy-v1',
      grantedAt: '2026-01-01T00:00:00.000Z',
      revokedAt: '2026-02-01T00:00:00.000Z',
    };
    mockFetchOnce(200, { grants: [grant], total: 1 });

    const grants = await getCorpusConsentGrants();

    expect(grants).toEqual([grant]);
  });

  it('surfaces the server-provided machine-readable code on failure', async () => {
    mockFetchOnce(401, { code: 'UNAUTHENTICATED', message: 'Sign in required' });

    await expect(getCorpusConsentGrants()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(getCorpusConsentGrants()).rejects.toBeInstanceOf(CorpusConsentApiError);
  });
});

describe('grantCorpusConsent', () => {
  it('posts to /v1/language-corpus/consent/:kind/grant with no body', async () => {
    const grant = {
      id: 'c-1',
      userId: 'owner-1',
      kind: 'HEALTH_CONVERSATION_AUDIO',
      version: 'consent-copy-v1',
      grantedAt: '2026-01-01T00:00:00.000Z',
      revokedAt: null,
    };
    const fetchMock = mockFetchOnce(201, grant);

    const result = await grantCorpusConsent('HEALTH_CONVERSATION_AUDIO');

    expect(result).toEqual(grant);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/language-corpus/consent/HEALTH_CONVERSATION_AUDIO/grant');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.body).toBeUndefined();
  });
});

describe('revokeCorpusConsent', () => {
  it('posts to /v1/language-corpus/consent/:kind/revoke and returns the updated grants', async () => {
    const grant = {
      id: 'c-1',
      userId: 'owner-1',
      kind: 'HEALTH_CONVERSATION_AUDIO',
      version: 'consent-copy-v1',
      grantedAt: '2026-01-01T00:00:00.000Z',
      revokedAt: '2026-02-01T00:00:00.000Z',
    };
    const fetchMock = mockFetchOnce(200, { grants: [grant] });

    const result = await revokeCorpusConsent('HEALTH_CONVERSATION_AUDIO');

    expect(result).toEqual([grant]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/language-corpus/consent/HEALTH_CONVERSATION_AUDIO/revoke');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
  });

  it('surfaces the server-provided machine-readable code on failure', async () => {
    mockFetchOnce(401, { code: 'UNAUTHENTICATED', message: 'Sign in required' });

    await expect(revokeCorpusConsent('HEALTH_CONVERSATION_AUDIO')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});

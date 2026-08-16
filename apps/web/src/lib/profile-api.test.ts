import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { confirmTwinProfile } from '@/lib/profile-api';

function mockFetchOnce(status: number) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve({ ok: true, created: 1 }),
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

describe('confirmTwinProfile', () => {
  it('posts the confirmed fields and resolves true on success', async () => {
    const fetchMock = mockFetchOnce(200);

    const result = await confirmTwinProfile({ ageBand: '40to60', askingFor: 'parent', conditions: ['diabetes'] });

    expect(result).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/twin/confirm-profile');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    const body = JSON.parse(init.body as string) as { ageBand?: string; askingFor?: string; conditions?: string[] };
    expect(body).toEqual({ ageBand: '40to60', askingFor: 'parent', conditions: ['diabetes'] });
  });

  it('resolves false, never throws, on a server error — the pending stash must be safe to keep and retry', async () => {
    mockFetchOnce(500);

    const result = await confirmTwinProfile({ ageBand: '40to60' });

    expect(result).toBe(false);
  });

  it('resolves false, never throws, when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const result = await confirmTwinProfile({ ageBand: '40to60' });

    expect(result).toBe(false);
  });
});

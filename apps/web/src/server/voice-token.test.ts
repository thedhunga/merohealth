import { describe, expect, it } from 'vitest';

import { mintVoiceToken } from './voice-token';

const fixedNow = () => new Date('2026-08-17T12:00:00.000Z');

const fetchReturning = (status: number, body: unknown): typeof fetch =>
  (() => Promise.resolve(new Response(JSON.stringify(body), { status }))) as unknown as typeof fetch;

describe('mintVoiceToken', () => {
  it('reports setup-required without a key and never calls the network', async () => {
    let called = false;
    const spy: typeof fetch = (() => {
      called = true;
      return Promise.resolve(new Response('{}'));
    }) as unknown as typeof fetch;

    const result = await mintVoiceToken({ apiKey: undefined, fetchImpl: spy });
    expect(result.status).toBe('setup-required');
    expect(called).toBe(false);
  });

  it('sends the key in the x-goog-api-key header, never in the body or the URL', async () => {
    let seenHeaders: Headers | undefined;
    let seenUrl: unknown;
    let seenBody: Record<string, unknown> | undefined;
    const spy: typeof fetch = ((url: unknown, init?: RequestInit) => {
      seenUrl = url;
      seenHeaders = new Headers(init?.headers);
      seenBody = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<string, unknown>;
      return Promise.resolve(new Response(JSON.stringify({ name: 'authTokens/abc123' }), { status: 200 }));
    }) as unknown as typeof fetch;

    await mintVoiceToken({ apiKey: 'secret-key', fetchImpl: spy, now: fixedNow });

    expect(seenHeaders?.get('x-goog-api-key')).toBe('secret-key');
    expect(String(seenUrl)).not.toContain('secret-key');
    expect(JSON.stringify(seenBody)).not.toContain('secret-key');
  });

  it('asks for a single use and a short new-session window', async () => {
    let seenBody: { authToken?: { uses?: number; newSessionExpireTime?: string; expireTime?: string } } | undefined;
    const spy: typeof fetch = ((_url: unknown, init?: RequestInit) => {
      seenBody = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as typeof seenBody;
      return Promise.resolve(new Response(JSON.stringify({ name: 'authTokens/abc123' }), { status: 200 }));
    }) as unknown as typeof fetch;

    await mintVoiceToken({ apiKey: 'k', fetchImpl: spy, now: fixedNow });

    expect(seenBody?.authToken?.uses).toBe(1);
    expect(seenBody?.authToken?.newSessionExpireTime).toBe('2026-08-17T12:01:00.000Z');
    expect(seenBody?.authToken?.expireTime).toBe('2026-08-17T12:30:00.000Z');
  });

  it('returns only the token and its expiry on success — nothing else from the mint response', async () => {
    const result = await mintVoiceToken({
      apiKey: 'k',
      now: fixedNow,
      fetchImpl: fetchReturning(200, { name: 'authTokens/abc123', extraField: 'do-not-leak' }),
    });

    expect(result).toEqual({ status: 'ok', token: 'authTokens/abc123', expiresAt: '2026-08-17T12:30:00.000Z' });
  });

  it('falls back to a `token` field if the response has no `name`', async () => {
    const result = await mintVoiceToken({
      apiKey: 'k',
      now: fixedNow,
      fetchImpl: fetchReturning(200, { token: 'xyz789' }),
    });

    expect(result).toEqual({ status: 'ok', token: 'xyz789', expiresAt: '2026-08-17T12:30:00.000Z' });
  });

  it('is unavailable, not a crash, on a non-2xx response', async () => {
    const result = await mintVoiceToken({ apiKey: 'k', fetchImpl: fetchReturning(403, { error: 'refused' }) });
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') expect(result.detail).toContain('403');
  });

  it('is unavailable when the response has no recognisable token field', async () => {
    const result = await mintVoiceToken({ apiKey: 'k', fetchImpl: fetchReturning(200, { unexpected: true }) });
    expect(result.status).toBe('unavailable');
  });

  it('fails closed, not a crash, when the network is unreachable', async () => {
    const spy: typeof fetch = (() => Promise.reject(new Error('network down'))) as unknown as typeof fetch;
    const result = await mintVoiceToken({ apiKey: 'k', fetchImpl: spy });
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') expect(result.detail).toBe('network down');
  });
});

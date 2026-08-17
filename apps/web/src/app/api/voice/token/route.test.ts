import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/voice/token', () => {
  it('is not found when GEMINI_LIVE_ENABLED is unset — the owner has not turned on billing', async () => {
    vi.stubEnv('GEMINI_LIVE_ENABLED', '');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const response = await POST();

    expect(response.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('is not found on any value other than the literal string "true"', async () => {
    vi.stubEnv('GEMINI_LIVE_ENABLED', 'yes');

    const response = await POST();

    expect(response.status).toBe(404);
  });

  it('reports setup-required when the flag is on but there is no Gemini key', async () => {
    vi.stubEnv('GEMINI_LIVE_ENABLED', 'true');
    vi.stubEnv('GEMINI_API_KEY', '');

    const response = await POST();
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(503);
    expect(body.code).toBe('SETUP_REQUIRED');
  });

  it('mints a token and returns only the token and its expiry — never the API key', async () => {
    vi.stubEnv('GEMINI_LIVE_ENABLED', 'true');
    vi.stubEnv('GEMINI_API_KEY', 'super-secret-key');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ name: 'authTokens/abc123' }), { status: 200 }),
    );

    const response = await POST();
    const text = await response.text();
    const body = JSON.parse(text) as { token: string; expiresAt: string };

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body.token).toBe('authTokens/abc123');
    expect(typeof body.expiresAt).toBe('string');
    expect(text).not.toContain('super-secret-key');
  });

  it('returns a generic 502 and does not leak the upstream failure to the client', async () => {
    vi.stubEnv('GEMINI_LIVE_ENABLED', 'true');
    vi.stubEnv('GEMINI_API_KEY', 'super-secret-key');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"error":"refused"}', { status: 403 }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST();
    const text = await response.text();
    const body = JSON.parse(text) as { code: string };

    expect(response.status).toBe(502);
    expect(body.code).toBe('UNAVAILABLE');
    expect(text).not.toContain('refused');
    expect(text).not.toContain('super-secret-key');
    expect(errorSpy).toHaveBeenCalled();
  });
});

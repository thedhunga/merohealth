import { generateKeyPairSync, sign as signRsa } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  generateOtpCode,
  generateSessionToken,
  GoogleIdTokenError,
  hashOtpCode,
  hashSessionToken,
  InvalidPhoneError,
  isGoogleJwksUnreachable,
  isOtpChallengeUsable,
  isOtpResendAllowed,
  isSessionActive,
  normalizeNepaliPhone,
  OTP_CODE_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  parseCookieHeader,
  verifyGoogleIdToken,
  verifyOtpCode,
} from './index.js';

const SECRET = 'test-secret-at-least-32-bytes-long!!';

describe('generateOtpCode', () => {
  it('always produces a zero-padded numeric string of the configured length', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d+$/);
      expect(code).toHaveLength(OTP_CODE_LENGTH);
    }
  });

  it('is not constant across calls', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateOtpCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('hashOtpCode / verifyOtpCode', () => {
  it('verifies a code against its own hash', () => {
    const code = '123456';
    const hash = hashOtpCode(code, SECRET);
    expect(verifyOtpCode(code, SECRET, hash)).toBe(true);
  });

  it('rejects a wrong code', () => {
    const hash = hashOtpCode('123456', SECRET);
    expect(verifyOtpCode('654321', SECRET, hash)).toBe(false);
  });

  it('rejects the right code under a different secret', () => {
    const hash = hashOtpCode('123456', SECRET);
    expect(verifyOtpCode('123456', 'a-different-secret-value-here!!!', hash)).toBe(false);
  });

  it('never throws on a malformed stored hash (e.g. corrupted data)', () => {
    expect(() => verifyOtpCode('123456', SECRET, 'not-hex-and-wrong-length')).not.toThrow();
    expect(verifyOtpCode('123456', SECRET, 'not-hex-and-wrong-length')).toBe(false);
  });
});

describe('isOtpChallengeUsable', () => {
  const now = new Date('2026-08-10T12:00:00Z');

  it('is usable when unconsumed, unexpired, under the attempt cap', () => {
    expect(
      isOtpChallengeUsable(
        { expiresAt: new Date('2026-08-10T12:05:00Z'), consumedAt: null, attempts: 0 },
        now,
      ),
    ).toBe(true);
  });

  it('is not usable once consumed', () => {
    expect(
      isOtpChallengeUsable(
        { expiresAt: new Date('2026-08-10T12:05:00Z'), consumedAt: now, attempts: 0 },
        now,
      ),
    ).toBe(false);
  });

  it('is not usable once expired', () => {
    expect(
      isOtpChallengeUsable(
        { expiresAt: new Date('2026-08-10T11:59:59Z'), consumedAt: null, attempts: 0 },
        now,
      ),
    ).toBe(false);
  });

  it('is not usable once attempts reach the cap', () => {
    expect(
      isOtpChallengeUsable(
        { expiresAt: new Date('2026-08-10T12:05:00Z'), consumedAt: null, attempts: OTP_MAX_ATTEMPTS },
        now,
      ),
    ).toBe(false);
  });
});

describe('isOtpResendAllowed', () => {
  const now = new Date('2026-08-10T12:00:00Z');

  it('allows a first request when there is no prior challenge', () => {
    expect(isOtpResendAllowed(null, now)).toBe(true);
  });

  it('allows a resend once the prior challenge was already consumed', () => {
    expect(isOtpResendAllowed({ createdAt: now, consumedAt: now }, now)).toBe(true);
  });

  it('blocks a resend inside the cooldown window', () => {
    const justRequested = new Date(now.getTime() - 1000);
    expect(isOtpResendAllowed({ createdAt: justRequested, consumedAt: null }, now)).toBe(false);
  });

  it('allows a resend once the cooldown has elapsed', () => {
    const longAgo = new Date(now.getTime() - OTP_RESEND_COOLDOWN_MS);
    expect(isOtpResendAllowed({ createdAt: longAgo, consumedAt: null }, now)).toBe(true);
  });
});

describe('normalizeNepaliPhone', () => {
  it('accepts a bare 10-digit number', () => {
    expect(normalizeNepaliPhone('9812345678')).toBe('9812345678');
  });

  it('strips a +977 country code', () => {
    expect(normalizeNepaliPhone('+9779812345678')).toBe('9812345678');
  });

  it('strips a bare 977 country code', () => {
    expect(normalizeNepaliPhone('9779812345678')).toBe('9812345678');
  });

  it('accepts a bare 10-digit number that itself starts with 977, without corrupting it', () => {
    expect(normalizeNepaliPhone('9771234567')).toBe('9771234567');
  });

  it('strips spaces and hyphens', () => {
    expect(normalizeNepaliPhone('+977 981-234-5678')).toBe('9812345678');
  });

  it('rejects a number not starting with 9', () => {
    expect(() => normalizeNepaliPhone('8812345678')).toThrow(InvalidPhoneError);
  });

  it('rejects a too-short number', () => {
    expect(() => normalizeNepaliPhone('98123')).toThrow(InvalidPhoneError);
  });

  it('rejects non-numeric input', () => {
    expect(() => normalizeNepaliPhone('98abcdefgh')).toThrow(InvalidPhoneError);
  });
});

describe('generateSessionToken / hashSessionToken', () => {
  it('generates distinct tokens', () => {
    expect(generateSessionToken()).not.toBe(generateSessionToken());
  });

  it('hashes deterministically for the same token and secret', () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token, SECRET)).toBe(hashSessionToken(token, SECRET));
  });

  it('hashes differently for a different secret', () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token, SECRET)).not.toBe(hashSessionToken(token, 'other-secret-value-32-bytes!!!!'));
  });
});

describe('isSessionActive', () => {
  const now = new Date('2026-08-10T12:00:00Z');

  it('is active when unrevoked and unexpired', () => {
    expect(isSessionActive({ expiresAt: new Date('2026-09-10T12:00:00Z'), revokedAt: null }, now)).toBe(true);
  });

  it('is inactive once revoked', () => {
    expect(isSessionActive({ expiresAt: new Date('2026-09-10T12:00:00Z'), revokedAt: now }, now)).toBe(false);
  });

  it('is inactive once expired', () => {
    expect(isSessionActive({ expiresAt: new Date('2026-08-01T00:00:00Z'), revokedAt: null }, now)).toBe(false);
  });
});

describe('parseCookieHeader', () => {
  it('returns an empty object for a missing header', () => {
    expect(parseCookieHeader(undefined)).toEqual({});
    expect(parseCookieHeader(null)).toEqual({});
    expect(parseCookieHeader('')).toEqual({});
  });

  it('parses a single cookie', () => {
    expect(parseCookieHeader('mero_session=abc123')).toEqual({ mero_session: 'abc123' });
  });

  it('parses multiple cookies separated by "; "', () => {
    expect(parseCookieHeader('a=1; b=2; mero_session=xyz')).toEqual({ a: '1', b: '2', mero_session: 'xyz' });
  });

  it('url-decodes values', () => {
    expect(parseCookieHeader('token=a%2Fb%3Dc')).toEqual({ token: 'a/b=c' });
  });

  it('ignores malformed pairs without an "="', () => {
    expect(parseCookieHeader('a=1; garbage; b=2')).toEqual({ a: '1', b: '2' });
  });

  it('ignores a pair whose value is not valid percent-encoding instead of throwing', () => {
    expect(parseCookieHeader('a=1; mero_session=%; b=2')).toEqual({ a: '1', b: '2' });
  });
});

describe('verifyGoogleIdToken', () => {
  const CLIENT_ID = 'test-client.apps.googleusercontent.com';
  const KID = 'test-kid-1';
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: 'jwk' }) as { kty: string; n: string; e: string };

  function base64url(input: string | Buffer): string {
    return Buffer.from(input).toString('base64url');
  }

  /** Builds and signs a real RS256 JWT against the fixture key pair above — never a real Google token. */
  function signToken(
    payloadOverrides: Record<string, unknown> = {},
    headerOverrides: Record<string, unknown> = {},
  ): string {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', kid: KID, typ: 'JWT', ...headerOverrides };
    const payload = {
      iss: 'https://accounts.google.com',
      aud: CLIENT_ID,
      sub: 'google-user-123',
      email: 'person@example.com',
      email_verified: true,
      name: 'Test Person',
      picture: 'https://example.com/photo.jpg',
      iat: nowSeconds,
      exp: nowSeconds + 3600,
      ...payloadOverrides,
    };
    const headerB64 = base64url(JSON.stringify(header));
    const payloadB64 = base64url(JSON.stringify(payload));
    const signature = signRsa('RSA-SHA256', Buffer.from(`${headerB64}.${payloadB64}`), privateKey);
    return `${headerB64}.${payloadB64}.${base64url(signature)}`;
  }

  /** A `fetch` stand-in returning the fixture JWKS (or a caller-supplied override) — no network call ever happens in this suite. */
  function fixtureFetch(
    body: unknown = { keys: [{ ...publicJwk, kid: KID, use: 'sig', alg: 'RS256' }] },
    status = 200,
  ): typeof fetch {
    return (() =>
      Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })) as unknown as typeof fetch;
  }

  it('verifies a valid token and returns the identity', async () => {
    await expect(verifyGoogleIdToken(signToken(), CLIENT_ID, fixtureFetch())).resolves.toEqual({
      sub: 'google-user-123',
      email: 'person@example.com',
      emailVerified: true,
      name: 'Test Person',
      picture: 'https://example.com/photo.jpg',
    });
  });

  it('omits name/picture when the token does not carry them', async () => {
    const token = signToken({ name: undefined, picture: undefined });
    await expect(verifyGoogleIdToken(token, CLIENT_ID, fixtureFetch())).resolves.toMatchObject({
      name: undefined,
      picture: undefined,
    });
  });

  it('never calls the network — fetchImpl is the only source of key material', async () => {
    let calls = 0;
    const spy: typeof fetch = ((...args: Parameters<typeof fetch>) => {
      calls += 1;
      return fixtureFetch()(...args);
    }) as typeof fetch;
    await verifyGoogleIdToken(signToken(), CLIENT_ID, spy);
    expect(calls).toBe(1);
  });

  it('rejects a malformed token', async () => {
    await expect(verifyGoogleIdToken('not-a-jwt', CLIENT_ID, fixtureFetch())).rejects.toThrow(GoogleIdTokenError);
  });

  it('rejects an unsupported algorithm (defence against alg-confusion)', async () => {
    const token = signToken({}, { alg: 'none' });
    await expect(verifyGoogleIdToken(token, CLIENT_ID, fixtureFetch())).rejects.toThrow(/algorithm/);
  });

  it('rejects a token signed by a key the JWKS does not vouch for', async () => {
    const forged = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', kid: KID, typ: 'JWT' };
    const payload = {
      iss: 'https://accounts.google.com',
      aud: CLIENT_ID,
      sub: 'google-user-123',
      email: 'person@example.com',
      email_verified: true,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    };
    const headerB64 = base64url(JSON.stringify(header));
    const payloadB64 = base64url(JSON.stringify(payload));
    const signature = signRsa('RSA-SHA256', Buffer.from(`${headerB64}.${payloadB64}`), forged.privateKey);
    const token = `${headerB64}.${payloadB64}.${base64url(signature)}`;
    await expect(verifyGoogleIdToken(token, CLIENT_ID, fixtureFetch())).rejects.toThrow(/signature/);
  });

  it('rejects a token with no matching key id in the JWKS', async () => {
    const token = signToken({}, { kid: 'some-other-kid' });
    await expect(verifyGoogleIdToken(token, CLIENT_ID, fixtureFetch())).rejects.toThrow(/matching/);
  });

  it('rejects a wrong issuer', async () => {
    const token = signToken({ iss: 'https://evil.example.com' });
    await expect(verifyGoogleIdToken(token, CLIENT_ID, fixtureFetch())).rejects.toThrow(/issuer/);
  });

  it('rejects a token issued for a different client (audience mismatch)', async () => {
    const token = signToken({ aud: 'someone-elses-client-id' });
    await expect(verifyGoogleIdToken(token, CLIENT_ID, fixtureFetch())).rejects.toThrow(/client/);
  });

  it('rejects an expired token', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const token = signToken({ iat: nowSeconds - 7200, exp: nowSeconds - 3600 });
    await expect(verifyGoogleIdToken(token, CLIENT_ID, fixtureFetch())).rejects.toThrow(/expired/);
  });

  it('rejects an unverified email', async () => {
    const token = signToken({ email_verified: false });
    await expect(verifyGoogleIdToken(token, CLIENT_ID, fixtureFetch())).rejects.toThrow(/not verified/);
  });

  it('surfaces a JWKS fetch failure as a GoogleIdTokenError rather than an unhandled rejection', async () => {
    await expect(verifyGoogleIdToken(signToken(), CLIENT_ID, fixtureFetch({}, 503))).rejects.toThrow(GoogleIdTokenError);
  });

  it('surfaces a network-level JWKS fetch failure (fetch itself throwing) as a GoogleIdTokenError, not a raw rejection', async () => {
    const unreachable: typeof fetch = (() => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch;
    await expect(verifyGoogleIdToken(signToken(), CLIENT_ID, unreachable)).rejects.toThrow(GoogleIdTokenError);
  });

  describe('isGoogleJwksUnreachable', () => {
    it('is true for a non-2xx JWKS response', async () => {
      const error = await verifyGoogleIdToken(signToken(), CLIENT_ID, fixtureFetch({}, 503)).catch((e: unknown) => e);
      expect(isGoogleJwksUnreachable(error)).toBe(true);
    });

    it('is true for the fetch call itself throwing', async () => {
      const unreachable: typeof fetch = (() => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch;
      const error = await verifyGoogleIdToken(signToken(), CLIENT_ID, unreachable).catch((e: unknown) => e);
      expect(isGoogleJwksUnreachable(error)).toBe(true);
    });

    it('is false for an invalid-token failure, e.g. an expired token', async () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const token = signToken({ iat: nowSeconds - 7200, exp: nowSeconds - 3600 });
      const error = await verifyGoogleIdToken(token, CLIENT_ID, fixtureFetch()).catch((e: unknown) => e);
      expect(isGoogleJwksUnreachable(error)).toBe(false);
    });

    it('is false for a non-GoogleIdTokenError value', () => {
      expect(isGoogleJwksUnreachable(new Error('unrelated'))).toBe(false);
    });
  });
});

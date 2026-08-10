import { describe, expect, it } from 'vitest';
import {
  generateOtpCode,
  generateSessionToken,
  hashOtpCode,
  hashSessionToken,
  InvalidPhoneError,
  isOtpChallengeUsable,
  isOtpResendAllowed,
  isSessionActive,
  normalizeNepaliPhone,
  OTP_CODE_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  parseCookieHeader,
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
});

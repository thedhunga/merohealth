import { generateKeyPairSync, sign as signRsa } from 'node:crypto';
import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { InMemoryAuthStore } from './in-memory-auth.store.js';
import type { SmsProvider } from './sms-provider.js';

const PHONE = '9812345678';

/* ------------------------------------------------------------------ *
 * Google ID token fixtures — the same shape `packages/auth`'s own
 * `verifyGoogleIdToken` suite builds, duplicated rather than imported
 * because it is test-only scaffolding and `verifyGoogleIdToken` takes no
 * injectable `fetchImpl` from this call site (`AuthService.verifyGoogleSignIn`
 * passes only two args, so it always hits the real global `fetch`) — these
 * tests stub `global.fetch` instead, matching `gemini-extraction.service.test.ts`.
 * ------------------------------------------------------------------ */
const GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
const GOOGLE_KID = 'test-kid-1';
const { publicKey: googlePublicKey, privateKey: googlePrivateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const googlePublicJwk = googlePublicKey.export({ format: 'jwk' }) as { kty: string; n: string; e: string };

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function signGoogleToken(payloadOverrides: Record<string, unknown> = {}): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', kid: GOOGLE_KID, typ: 'JWT' };
  const payload = {
    iss: 'https://accounts.google.com',
    aud: GOOGLE_CLIENT_ID,
    sub: 'google-user-123',
    email: 'person@example.com',
    email_verified: true,
    name: 'Test Person',
    iat: nowSeconds,
    exp: nowSeconds + 3600,
    ...payloadOverrides,
  };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signature = signRsa('RSA-SHA256', Buffer.from(`${headerB64}.${payloadB64}`), googlePrivateKey);
  return `${headerB64}.${payloadB64}.${base64url(signature)}`;
}

function stubGoogleJwks(status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve({ keys: [{ ...googlePublicJwk, kid: GOOGLE_KID, use: 'sig', alg: 'RS256' }] }),
    }),
  );
}

describe('AuthService', () => {
  let store: InMemoryAuthStore;
  // Untyped as `SmsProvider` — asserting on `sms.send` against that
  // interface type trips `@typescript-eslint/unbound-method` (it reads as a
  // detached interface method, not a vitest mock). The cast to
  // `SmsProvider` happens only where `AuthService` needs the shape.
  let sms: { send: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    process.env['AUTH_SECRET'] = 'test-secret-at-least-32-bytes-long!!';
    store = new InMemoryAuthStore();
    sms = { send: vi.fn().mockResolvedValue(undefined) };
    service = new AuthService(store, sms as unknown as SmsProvider);
  });

  afterEach(() => {
    delete process.env['GOOGLE_CLIENT_ID'];
    vi.unstubAllGlobals();
  });

  async function requestAndReadCode(phone = PHONE) {
    const result = await service.requestOtp(phone);
    if (!result.debugCode) throw new Error('expected a debugCode outside production');
    return { challengeId: result.challengeId, code: result.debugCode };
  }

  describe('requestOtp', () => {
    it('normalises the phone, creates a challenge and "sends" the code', async () => {
      const result = await service.requestOtp('+977 981-234-5678');
      expect(result.challengeId).toBeTruthy();
      expect(sms.send).toHaveBeenCalledWith(PHONE, expect.stringContaining(result.debugCode!));
    });

    it('rejects a malformed phone before touching the store', async () => {
      await expect(service.requestOtp('123')).rejects.toThrow(BadRequestException);
      expect(sms.send).not.toHaveBeenCalled();
    });

    it('refuses a resend inside the cooldown window', async () => {
      await requestAndReadCode();
      await expect(service.requestOtp(PHONE)).rejects.toMatchObject({ status: 429 });
    });
  });

  describe('verifyOtp — REGISTER', () => {
    it('creates a new user and profile, and issues a session', async () => {
      const { challengeId, code } = await requestAndReadCode();
      const result = await service.verifyOtp({
        challengeId,
        code,
        phone: PHONE,
        intent: 'REGISTER',
        displayName: 'Sita Rai',
      });

      expect(result.user.phone).toBe(PHONE);
      expect(result.user.role).toBe('PATIENT');
      expect(result.patientProfileId).toBeTruthy();
      expect(result.assuranceLevel).toBe('REGISTERED');
      expect(result.token).toBeTruthy();
    });

    it('requires a display name for a brand-new user', async () => {
      const { challengeId, code } = await requestAndReadCode();
      await expect(
        service.verifyOtp({ challengeId, code, phone: PHONE, intent: 'REGISTER' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses to register a phone that already has an account', async () => {
      const first = await requestAndReadCode();
      await service.verifyOtp({ ...first, phone: PHONE, intent: 'REGISTER', displayName: 'Sita Rai' });

      const second = await requestAndReadCode();
      await expect(
        service.verifyOtp({ ...second, phone: PHONE, intent: 'REGISTER', displayName: 'Sita Rai' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('verifyOtp — SIGN_IN', () => {
    it('refuses to sign in a phone with no account', async () => {
      const { challengeId, code } = await requestAndReadCode();
      await expect(
        service.verifyOtp({ challengeId, code, phone: PHONE, intent: 'SIGN_IN' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('signs in an existing user without a displayName', async () => {
      const registerChallenge = await requestAndReadCode();
      await service.verifyOtp({ ...registerChallenge, phone: PHONE, intent: 'REGISTER', displayName: 'Sita Rai' });

      const signInChallenge = await requestAndReadCode();
      const result = await service.verifyOtp({ ...signInChallenge, phone: PHONE, intent: 'SIGN_IN' });
      expect(result.user.phone).toBe(PHONE);
      expect(result.patientProfileId).toBeTruthy();
    });
  });

  describe('verifyOtp — code correctness and expiry', () => {
    it('rejects an incorrect code and records the attempt', async () => {
      const { challengeId } = await requestAndReadCode();
      await expect(
        service.verifyOtp({ challengeId, code: '000000', phone: PHONE, intent: 'SIGN_IN' }),
      ).rejects.toThrow(BadRequestException);

      const challenge = await store.findOtpChallenge(challengeId);
      expect(challenge?.attempts).toBe(1);
    });

    it('locks out after the maximum number of incorrect attempts, even with the correct code', async () => {
      const { challengeId, code } = await requestAndReadCode();
      for (let i = 0; i < 5; i++) {
        await expect(
          service.verifyOtp({ challengeId, code: '000000', phone: PHONE, intent: 'SIGN_IN' }),
        ).rejects.toThrow(BadRequestException);
      }
      await expect(
        service.verifyOtp({ challengeId, code, phone: PHONE, intent: 'SIGN_IN' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a challengeId for a different phone than the one supplied', async () => {
      const { challengeId, code } = await requestAndReadCode(PHONE);
      await expect(
        service.verifyOtp({ challengeId, code, phone: '9800000000', intent: 'SIGN_IN' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('cannot be replayed once consumed', async () => {
      const registerChallenge = await requestAndReadCode();
      await service.verifyOtp({ ...registerChallenge, phone: PHONE, intent: 'REGISTER', displayName: 'Sita Rai' });

      await expect(
        service.verifyOtp({ ...registerChallenge, phone: PHONE, intent: 'SIGN_IN' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('currentUser / requireCurrentUser / logout', () => {
    it('resolves the subjectId behind a live session token', async () => {
      const registerChallenge = await requestAndReadCode();
      const { token, user } = await service.verifyOtp({
        ...registerChallenge,
        phone: PHONE,
        intent: 'REGISTER',
        displayName: 'Sita Rai',
      });

      const current = await service.currentUser(token);
      expect(current?.subjectId).toBe(user.id);
    });

    it('returns null for a token that was never issued', async () => {
      expect(await service.currentUser('not-a-real-token')).toBeNull();
    });

    it('requireCurrentUser throws for a missing or invalid token', async () => {
      await expect(service.requireCurrentUser(null)).rejects.toThrow(UnauthorizedException);
      await expect(service.requireCurrentUser('bogus')).rejects.toThrow(UnauthorizedException);
    });

    it('logout revokes the session so it no longer resolves', async () => {
      const registerChallenge = await requestAndReadCode();
      const { token } = await service.verifyOtp({
        ...registerChallenge,
        phone: PHONE,
        intent: 'REGISTER',
        displayName: 'Sita Rai',
      });

      await service.logout(token);
      expect(await service.currentUser(token)).toBeNull();
    });

    // Previously `currentUser` hardcoded `assuranceLevel: 'REGISTERED'`
    // regardless of what the store actually held — permanently locking every
    // `IDENTITY_VERIFIED`-gated route (`RECORD_SHARING`, `TELECONSULTATION`)
    // for every real session, since nothing could ever prove otherwise.
    it('reflects a real IDENTITY_VERIFIED elevation instead of always reporting REGISTERED', async () => {
      const registerChallenge = await requestAndReadCode();
      const { token, user } = await service.verifyOtp({
        ...registerChallenge,
        phone: PHONE,
        intent: 'REGISTER',
        displayName: 'Sita Rai',
      });
      expect((await service.currentUser(token))?.assuranceLevel).toBe('REGISTERED');

      await store.markIdentityVerified(user.id);

      expect((await service.currentUser(token))?.assuranceLevel).toBe('IDENTITY_VERIFIED');
    });

    // Same fix, the sign-in path: a returning already-verified user must not
    // be silently reported back at REGISTERED.
    it('reports IDENTITY_VERIFIED on sign-in for a user already verified from a prior session', async () => {
      const registerChallenge = await requestAndReadCode();
      const { user } = await service.verifyOtp({
        ...registerChallenge,
        phone: PHONE,
        intent: 'REGISTER',
        displayName: 'Sita Rai',
      });
      await store.markIdentityVerified(user.id);

      const signInChallenge = await requestAndReadCode();
      const result = await service.verifyOtp({ ...signInChallenge, phone: PHONE, intent: 'SIGN_IN' });

      expect(result.assuranceLevel).toBe('IDENTITY_VERIFIED');
    });
  });

  describe('verifyGoogleSignIn', () => {
    it('reports setup-required when GOOGLE_CLIENT_ID is not configured, without ever touching the store', async () => {
      delete process.env['GOOGLE_CLIENT_ID'];
      const findSpy = vi.spyOn(store, 'findUserByGoogleSub');

      const result = await service.verifyGoogleSignIn({ idToken: 'irrelevant', intent: 'SIGN_IN' });

      expect(result).toEqual({ status: 'setup-required' });
      expect(findSpy).not.toHaveBeenCalled();
    });

    it('REGISTER creates a new user from a valid token and issues a session', async () => {
      process.env['GOOGLE_CLIENT_ID'] = GOOGLE_CLIENT_ID;
      stubGoogleJwks();

      const result = await service.verifyGoogleSignIn({ idToken: signGoogleToken(), intent: 'REGISTER' });

      if (result.status !== 'complete') throw new Error('expected a complete session');
      expect(result.user.googleSub).toBe('google-user-123');
      expect(result.user.email).toBe('person@example.com');
      expect(result.user.phone).toBeNull();
      expect(result.assuranceLevel).toBe('REGISTERED');
      expect(result.patientProfileId).toBeTruthy();
    });

    it('REGISTER falls back to the token name when no displayName is supplied', async () => {
      process.env['GOOGLE_CLIENT_ID'] = GOOGLE_CLIENT_ID;
      stubGoogleJwks();

      const result = await service.verifyGoogleSignIn({ idToken: signGoogleToken(), intent: 'REGISTER' });
      if (result.status !== 'complete') throw new Error('expected a complete session');
      const profile = await store.findPatientProfileByUserId(result.user.id);
      expect(profile).toBeTruthy();
    });

    it('REGISTER rejects a Google account that already has an account', async () => {
      process.env['GOOGLE_CLIENT_ID'] = GOOGLE_CLIENT_ID;
      stubGoogleJwks();
      await service.verifyGoogleSignIn({ idToken: signGoogleToken(), intent: 'REGISTER' });

      await expect(service.verifyGoogleSignIn({ idToken: signGoogleToken(), intent: 'REGISTER' })).rejects.toThrow(ConflictException);
    });

    it('SIGN_IN rejects a Google account with no existing user', async () => {
      process.env['GOOGLE_CLIENT_ID'] = GOOGLE_CLIENT_ID;
      stubGoogleJwks();

      await expect(service.verifyGoogleSignIn({ idToken: signGoogleToken(), intent: 'SIGN_IN' })).rejects.toThrow(NotFoundException);
    });

    it('SIGN_IN succeeds for a user that already registered via Google', async () => {
      process.env['GOOGLE_CLIENT_ID'] = GOOGLE_CLIENT_ID;
      stubGoogleJwks();
      const registered = await service.verifyGoogleSignIn({ idToken: signGoogleToken(), intent: 'REGISTER' });
      if (registered.status !== 'complete') throw new Error('expected a complete session');

      const result = await service.verifyGoogleSignIn({ idToken: signGoogleToken(), intent: 'SIGN_IN' });

      if (result.status !== 'complete') throw new Error('expected a complete session');
      expect(result.user.id).toBe(registered.user.id);
      expect(result.token).not.toBe(registered.token);
    });

    it('rejects an invalid token (e.g. expired) with UnauthorizedException, not 503', async () => {
      process.env['GOOGLE_CLIENT_ID'] = GOOGLE_CLIENT_ID;
      stubGoogleJwks();
      const nowSeconds = Math.floor(Date.now() / 1000);
      const expired = signGoogleToken({ iat: nowSeconds - 7200, exp: nowSeconds - 3600 });

      await expect(service.verifyGoogleSignIn({ idToken: expired, intent: 'SIGN_IN' })).rejects.toThrow(UnauthorizedException);
    });

    // The fault-isolation case Round three §D's task text asks for by name:
    // Google's JWKS endpoint down must degrade to a clear 503, not crash the
    // request or get confused with "this token is invalid."
    it('surfaces a JWKS outage as ServiceUnavailableException with a stable code, leaving phone sign-in unaffected', async () => {
      process.env['GOOGLE_CLIENT_ID'] = GOOGLE_CLIENT_ID;
      stubGoogleJwks(503);

      const error = await service.verifyGoogleSignIn({ idToken: signGoogleToken(), intent: 'SIGN_IN' }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getResponse()).toMatchObject({ code: 'GOOGLE_SIGNIN_UNAVAILABLE' });

      // Phone sign-in never touches Google at all, so the same outage cannot
      // reach it — proven, not assumed, by exercising it in the same test.
      const { challengeId, code } = await requestAndReadCode();
      const otpResult = await service.verifyOtp({ challengeId, code, phone: PHONE, intent: 'REGISTER', displayName: 'Sita Rai' });
      expect(otpResult.user.phone).toBe(PHONE);
    });
  });
});

import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { InMemoryAuthStore } from './in-memory-auth.store.js';
import type { SmsProvider } from './sms-provider.js';

const PHONE = '9812345678';

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
});

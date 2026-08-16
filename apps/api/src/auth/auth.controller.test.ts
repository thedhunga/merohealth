import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SESSION_COOKIE_NAME } from './auth.constants.js';
import { InMemoryAuthStore } from './in-memory-auth.store.js';
import type { AuthenticatedRequest } from './session-auth.guard.js';
import type { SmsProvider } from './sms-provider.js';

/**
 * Returns the mock functions untyped as `Response` — asserting on
 * `res.cookie` after a cast to `Response` trips
 * `@typescript-eslint/unbound-method` (it reads as a detached interface
 * method reference, not a vitest mock). The cast to `Response` happens only
 * at the call site below, where the controller needs the shape but nothing
 * asserts against it there.
 */
function fakeResponse() {
  return { cookie: vi.fn(), clearCookie: vi.fn() };
}

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(() => {
    process.env['AUTH_SECRET'] = 'test-secret-at-least-32-bytes-long!!';
    const sms: SmsProvider = { send: vi.fn().mockResolvedValue(undefined) };
    controller = new AuthController(new AuthService(new InMemoryAuthStore(), sms));
  });

  it('otp/request rejects a missing phone', async () => {
    await expect(controller.requestOtp({})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('otp/request returns a challengeId for a valid phone', async () => {
    const result = await controller.requestOtp({ phone: '9812345678' });
    expect(result.challengeId).toBeTruthy();
  });

  it('otp/verify sets the session cookie and returns the new account', async () => {
    const { challengeId, debugCode } = await controller.requestOtp({ phone: '9812345678' });
    const res = fakeResponse();

    const result = await controller.verifyOtp(
      { challengeId, code: debugCode, phone: '9812345678', intent: 'REGISTER', displayName: 'Sita Rai' },
      res as unknown as Response,
    );

    expect(result.phone).toBe('9812345678');
    expect(result.patientProfileId).toBeTruthy();
    expect(res.cookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, result.token, expect.objectContaining({ httpOnly: true }));
  });

  it('otp/verify rejects a request missing the required intent field', async () => {
    const { challengeId } = await controller.requestOtp({ phone: '9812345678' });
    await expect(
      controller.verifyOtp({ challengeId, code: '123456', phone: '9812345678' }, fakeResponse() as unknown as Response),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('google/verify rejects a request missing the required idToken field', async () => {
    await expect(controller.verifyGoogle({ intent: 'SIGN_IN' }, fakeResponse() as unknown as Response)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('google/verify reports setup-required and never sets a cookie when GOOGLE_CLIENT_ID is unset', async () => {
    delete process.env['GOOGLE_CLIENT_ID'];
    const res = fakeResponse();

    const result = await controller.verifyGoogle({ idToken: 'irrelevant', intent: 'SIGN_IN' }, res as unknown as Response);

    expect(result).toEqual({ status: 'setup-required' });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('me returns the profile derived from @CurrentUser()', () => {
    const current = {
      subjectId: 'user-1',
      user: {
        id: 'user-1',
        phone: '9812345678',
        email: null,
        googleSub: null,
        role: 'PATIENT' as const,
        locale: 'ne',
        assuranceLevel: 'REGISTERED' as const,
      },
      patientProfileId: 'profile-1',
      assuranceLevel: 'REGISTERED' as const,
    };
    expect(controller.me(current)).toEqual({
      userId: 'user-1',
      phone: '9812345678',
      role: 'PATIENT',
      locale: 'ne',
      patientProfileId: 'profile-1',
      assuranceLevel: 'REGISTERED',
    });
  });

  it('logout revokes the session behind the request and clears the cookie', async () => {
    const { challengeId, debugCode } = await controller.requestOtp({ phone: '9812345678' });
    const verified = await controller.verifyOtp(
      { challengeId, code: debugCode, phone: '9812345678', intent: 'REGISTER', displayName: 'Sita Rai' },
      fakeResponse() as unknown as Response,
    );

    const res = fakeResponse();
    const request = { headers: {}, sessionToken: verified.token } as unknown as AuthenticatedRequest;
    const result = await controller.logout(request, res as unknown as Response);

    expect(result).toEqual({ ok: true });
    expect(res.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, { path: '/' });
  });
});

import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { InMemoryAuthStore } from './in-memory-auth.store.js';
import { SESSION_COOKIE_NAME } from './auth.constants.js';
import { SessionAuthGuard, type AuthenticatedRequest } from './session-auth.guard.js';
import type { SmsProvider } from './sms-provider.js';

function makeContext(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}), getNext: () => undefined }),
  } as unknown as ExecutionContext;
}

describe('SessionAuthGuard', () => {
  let auth: AuthService;
  let token: string;
  let userId: string;

  beforeEach(async () => {
    process.env['AUTH_SECRET'] = 'test-secret-at-least-32-bytes-long!!';
    const sms: SmsProvider = { send: vi.fn().mockResolvedValue(undefined) };
    auth = new AuthService(new InMemoryAuthStore(), sms);

    const { challengeId, debugCode } = await auth.requestOtp('9812345678');
    const verified = await auth.verifyOtp({
      challengeId,
      code: debugCode!,
      phone: '9812345678',
      intent: 'REGISTER',
      displayName: 'Sita Rai',
    });
    token = verified.token;
    userId = verified.user.id;
  });

  it('accepts a valid bearer token and attaches subjectId/authUser/sessionToken', async () => {
    const guard = new SessionAuthGuard(auth);
    const request: AuthenticatedRequest = { headers: { authorization: `Bearer ${token}` } };
    const context = makeContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.subjectId).toBe(userId);
    expect(request.authUser?.subjectId).toBe(userId);
    expect(request.sessionToken).toBe(token);
  });

  it('accepts a valid session cookie when there is no bearer header', async () => {
    const guard = new SessionAuthGuard(auth);
    const request: AuthenticatedRequest = { headers: { cookie: `other=1; ${SESSION_COOKIE_NAME}=${token}` } };
    const context = makeContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.subjectId).toBe(userId);
  });

  it('prefers the bearer header over a cookie when both are present', async () => {
    const guard = new SessionAuthGuard(auth);
    const request: AuthenticatedRequest = {
      headers: { authorization: `Bearer ${token}`, cookie: `${SESSION_COOKIE_NAME}=some-other-stale-token` },
    };
    const context = makeContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.subjectId).toBe(userId);
  });

  it('rejects a request with neither a bearer header nor a session cookie', async () => {
    const guard = new SessionAuthGuard(auth);
    const context = makeContext({ headers: {} });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a forged or expired token', async () => {
    const guard = new SessionAuthGuard(auth);
    const context = makeContext({ headers: { authorization: 'Bearer not-a-real-token' } });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token after logout revokes it', async () => {
    await auth.logout(token);
    const guard = new SessionAuthGuard(auth);
    const context = makeContext({ headers: { authorization: `Bearer ${token}` } });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a cookie with invalid percent-encoding as a clean 401, not an unhandled URIError', async () => {
    const guard = new SessionAuthGuard(auth);
    const context = makeContext({ headers: { cookie: `${SESSION_COOKIE_NAME}=%` } });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});

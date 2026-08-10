import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { parseCookieHeader } from '@swasthya/auth';
import { SESSION_COOKIE_NAME } from './auth.constants.js';
import { AuthService, type CurrentUserResult } from './auth.service.js';

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  subjectId?: string;
  authUser?: CurrentUserResult;
  /** The raw token this request authenticated with — `AuthController.logout` needs it back to revoke the right `Session` row. */
  sessionToken?: string;
}

/**
 * The real guard `EntitlementsGuard`'s own doc comment and
 * `ReviewerGuard`'s doc comment both name as missing: something that
 * resolves a request to a *verified* identity rather than trusting a
 * client-supplied field. Wiring this onto those guards' routes is A4's job,
 * not this one — this guard exists and is attached to `AuthController`'s own
 * `/auth/me` and `/auth/logout` today, which is where "a real subjectId on
 * every request" first becomes true in this codebase, ahead of every other
 * route adopting it.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractSessionToken(request);
    const result = await this.auth.requireCurrentUser(token);
    request.subjectId = result.subjectId;
    request.authUser = result;
    // `requireCurrentUser` already threw above if `token` were null, so this
    // is always a real string here — an `if` rather than `token ?? undefined`
    // because `exactOptionalPropertyTypes` distinguishes "key absent" from
    // "key present with value `undefined`", and only the former matches
    // `sessionToken?: string`'s own type.
    if (token) request.sessionToken = token;
    return true;
  }
}

/** Bearer header first (mobile's natural carrier), falling back to the session cookie (the web flow — see `AuthController.verifyOtp`). */
function extractSessionToken(request: AuthenticatedRequest): string | null {
  const authHeader = request.headers['authorization'];
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (headerValue?.startsWith('Bearer ')) {
    return headerValue.slice('Bearer '.length).trim();
  }
  const cookieHeader = request.headers['cookie'];
  const cookies = parseCookieHeader(Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader);
  return cookies[SESSION_COOKIE_NAME] ?? null;
}

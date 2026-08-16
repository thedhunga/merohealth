/**
 * Round two A3's web client for `apps/api`'s `/auth/*` routes — the first
 * time `apps/web` calls `apps/api` at all rather than staying pure marketing
 * content. `credentials: 'include'` so the browser sends/stores the
 * `mero_session` cookie `AuthController.verifyOtp` sets; the API's own CORS
 * config already turns on `credentials: true` for exactly this. Shaped after
 * `apps/mobile/src/lib/records-api.ts` — same env-var fallback, same typed
 * error class carrying the machine-readable `code` back to the caller.
 */

import type { AssuranceLevel } from '@swasthya/shared-types';

export type AuthIntent = 'SIGN_IN' | 'REGISTER';

export interface AuthErrorBody {
  code?: string;
  message?: string;
}

/** `code` is what a caller should branch on for a localized message — `message` is server-authored English and must never reach the UI directly (Nepali-first: every user-visible string lives in messages/*.json). */
export class AuthApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'AuthApiError';
    this.code = code;
  }
}

function authUrl(path: string): string {
  const configured = process.env['NEXT_PUBLIC_API_URL']?.replace(/\/$/, '');
  return `${configured ?? 'http://localhost:4000'}/v1/auth${path}`;
}

async function handleJsonResponse<T>(response: Response): Promise<T> {
  const parsed = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const error = (parsed as AuthErrorBody | null) ?? {};
    throw new AuthApiError(error.message ?? `Request failed (${response.status})`, error.code ?? null);
  }
  return parsed as T;
}

async function requestJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(authUrl(path), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleJsonResponse<T>(response);
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(authUrl(path), { method: 'GET', credentials: 'include' });
  return handleJsonResponse<T>(response);
}

export interface RequestOtpResponse {
  challengeId: string;
  expiresAt: string;
  /** Only ever present outside production, from the mock SMS adapter — see `AuthService.requestOtp`'s own doc comment in `apps/api`. */
  debugCode?: string;
}

export function requestOtp(phone: string): Promise<RequestOtpResponse> {
  return requestJson<RequestOtpResponse>('/otp/request', { phone });
}

export interface VerifyOtpResponse {
  token: string;
  userId: string;
  phone: string;
  role: string;
  locale: string;
  patientProfileId: string | null;
  assuranceLevel: string;
}

export interface VerifyOtpInput {
  challengeId: string;
  code: string;
  phone: string;
  intent: AuthIntent;
  // `| undefined`, not just `?:` — a caller building this from a ternary
  // (register vs. sign-in) naturally produces `string | undefined`, and
  // `exactOptionalPropertyTypes` treats that as distinct from the key being
  // absent.
  displayName?: string | undefined;
  locale?: ('ne' | 'en') | undefined;
}

export function verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResponse> {
  return requestJson<VerifyOtpResponse>('/otp/verify', input);
}

export interface VerifyGoogleInput {
  idToken: string;
  intent: AuthIntent;
  displayName?: string | undefined;
  locale?: ('ne' | 'en') | undefined;
}

/** Mirrors `apps/api`'s `VerifyGoogleResult` — `setup-required` is a normal response to check for, not a thrown error, so a missing `GOOGLE_CLIENT_ID` on the server degrades the same way an absent `NEXT_PUBLIC_GOOGLE_CLIENT_ID` already hides the button on this side. */
export type VerifyGoogleResponse =
  | { status: 'setup-required' }
  | {
      status: 'complete';
      token: string;
      userId: string;
      email: string | null;
      phone: string | null;
      role: string;
      locale: string;
      patientProfileId: string | null;
      assuranceLevel: string;
    };

export function verifyGoogleCredential(input: VerifyGoogleInput): Promise<VerifyGoogleResponse> {
  return requestJson<VerifyGoogleResponse>('/google/verify', input);
}

export interface CurrentUserResponse {
  userId: string;
  phone: string;
  role: string;
  locale: string;
  patientProfileId: string | null;
  assuranceLevel: AssuranceLevel;
}

/**
 * `apps/api`'s `AuthController.me` — the first call anywhere in `apps/web`
 * that reads the session back rather than only establishing it. A 401 here
 * (`AuthApiError` with `code: 'UNAUTHENTICATED'`) is the ordinary, expected
 * response for a visitor with no session, not a failure to log — see
 * `useSession`, which treats any rejection here as "not signed in."
 */
export function getCurrentUser(): Promise<CurrentUserResponse> {
  return getJson<CurrentUserResponse>('/me');
}

/** `apps/api`'s `AuthController.logout` — revokes the session and clears the cookie server-side. */
export async function logout(): Promise<void> {
  const response = await fetch(authUrl('/logout'), { method: 'POST', credentials: 'include' });
  await handleJsonResponse<{ ok: boolean }>(response);
}

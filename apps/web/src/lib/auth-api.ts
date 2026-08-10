/**
 * Round two A3's web client for `apps/api`'s `/auth/*` routes — the first
 * time `apps/web` calls `apps/api` at all rather than staying pure marketing
 * content. `credentials: 'include'` so the browser sends/stores the
 * `mero_session` cookie `AuthController.verifyOtp` sets; the API's own CORS
 * config already turns on `credentials: true` for exactly this. Shaped after
 * `apps/mobile/src/lib/records-api.ts` — same env-var fallback, same typed
 * error class carrying the machine-readable `code` back to the caller.
 */

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

async function requestJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(authUrl(path), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const parsed = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const error = (parsed as AuthErrorBody | null) ?? {};
    throw new AuthApiError(error.message ?? `Request failed (${response.status})`, error.code ?? null);
  }
  return parsed as T;
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

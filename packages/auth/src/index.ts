import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Server-only, unlike `packages/identity`: an OTP secret and a session
 * token's hashing key must never be reachable from a device, so — deliberately,
 * unlike every sibling domain package — this one has no `"react-native"`
 * export in `package.json` and is meant to be imported by `apps/api` alone.
 */

/* ------------------------------------------------------------------ *
 * Constants
 *
 * All timing/sizing decisions for the phone + OTP flow live here so
 * apps/api's AuthService and any future caller read the same numbers —
 * identity-and-credentialing.md names the phone + OTP mechanism but
 * leaves these figures undecided.
 * ------------------------------------------------------------------ */

export const OTP_CODE_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
/** How long a caller must wait before a fresh code can be requested for the same phone, to make SMS-bombing costly rather than free. */
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ *
 * OTP code: generation, hashing, verification
 * ------------------------------------------------------------------ */

/**
 * `randomInt` is rejection-sampled and uniform over its range, unlike
 * `Math.random() % 10` per digit, which would bias low digits whenever the
 * underlying float's mantissa doesn't divide evenly by 10.
 */
export function generateOtpCode(): string {
  return String(randomInt(0, 10 ** OTP_CODE_LENGTH)).padStart(OTP_CODE_LENGTH, '0');
}

/**
 * HMAC, not a bare hash: a six-digit code has only 10^6 possibilities, so a
 * stolen `codeHash` column alone would be exhaustively reversible in
 * milliseconds without a server-held secret mixed into the digest. `secret`
 * is `AUTH_SECRET` from the caller's environment — this package stays
 * environment-free, matching `packages/identity`'s "pure functions, no I/O"
 * shape, so the secret travels as a parameter rather than an env read here.
 */
export function hashOtpCode(code: string, secret: string): string {
  return createHmac('sha256', secret).update(code).digest('hex');
}

/** Constant-time comparison — a timing difference on digit-by-digit hash comparison would leak how much of a guess was correct. */
export function verifyOtpCode(code: string, secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOtpCode(code, secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export interface OtpChallengeState {
  expiresAt: Date;
  consumedAt: Date | null;
  attempts: number;
}

/** True when a challenge can still be checked against a submitted code — not consumed, not expired, attempts still under the cap. */
export function isOtpChallengeUsable(challenge: OtpChallengeState, now: Date): boolean {
  return (
    challenge.consumedAt === null &&
    now.getTime() < challenge.expiresAt.getTime() &&
    challenge.attempts < OTP_MAX_ATTEMPTS
  );
}

/** True when enough time has passed since the last challenge for this phone (or there was none) that a fresh code may be sent. */
export function isOtpResendAllowed(
  latestChallenge: { createdAt: Date; consumedAt: Date | null } | null,
  now: Date,
): boolean {
  if (!latestChallenge || latestChallenge.consumedAt !== null) return true;
  return now.getTime() - latestChallenge.createdAt.getTime() >= OTP_RESEND_COOLDOWN_MS;
}

/* ------------------------------------------------------------------ *
 * Phone normalisation
 * ------------------------------------------------------------------ */

export class InvalidPhoneError extends Error {
  constructor(input: string) {
    super(`Not a valid Nepali mobile number: ${input}`);
    this.name = 'InvalidPhoneError';
  }
}

// Nepali mobile numbers are 10 digits starting with 9 (NTC and Ncell both
// allocate from the 9-prefixed block); this deliberately does not encode
// specific carrier prefix ranges (98x/97x/...), since this repo has no
// verified source for exactly which sub-ranges are currently allocated and
// getting that wrong would reject real numbers.
const NEPAL_MOBILE_PATTERN = /^9\d{9}$/;

/**
 * Normalises to the bare 10-digit form regardless of a leading `+977`/`977`
 * or spaces/hyphens in the input, so the same phone typed two ways never
 * creates two `User` rows. Throws rather than silently accepting a
 * malformed number — a wrong `User.phone` is an account a person can never
 * sign back into.
 */
export function normalizeNepaliPhone(input: string): string {
  const digitsOnly = input.replace(/[\s-]/g, '');
  const withoutCountryCode = digitsOnly.replace(/^\+?977/, '');
  if (!NEPAL_MOBILE_PATTERN.test(withoutCountryCode)) {
    throw new InvalidPhoneError(input);
  }
  return withoutCountryCode;
}

/* ------------------------------------------------------------------ *
 * Session tokens
 * ------------------------------------------------------------------ */

/** 256 bits of entropy, base64url so it is transport-safe in both a bearer header and a cookie value without further encoding. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Only the hash is ever persisted — same rationale as `hashOtpCode`, though
 * here the input already has 256 bits of entropy, so the HMAC secret buys
 * defence in depth (a leaked token-hash column still can't be replayed
 * without also matching a live `Session` row) rather than closing a
 * brute-forceable range the way it does for the six-digit OTP.
 */
export function hashSessionToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

export interface SessionState {
  expiresAt: Date;
  revokedAt: Date | null;
}

export function isSessionActive(session: SessionState, now: Date): boolean {
  return session.revokedAt === null && now.getTime() < session.expiresAt.getTime();
}

/* ------------------------------------------------------------------ *
 * Cookie header parsing
 *
 * `apps/api` reads the session cookie without adding the `cookie-parser`
 * dependency — this is the entire parsing logic it needs, small enough to
 * own and unit-test directly rather than pull in a package for.
 * ------------------------------------------------------------------ */

export function parseCookieHeader(header: string | undefined | null): Record<string, string> {
  if (!header) return {};
  const entries: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) continue;
    const name = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (!name) continue;
    // The cookie header is attacker-controlled and reaches this guard on
    // every request; an invalid percent-encoding (e.g. a bare "%") must
    // drop that one pair rather than throw `URIError` out of `SessionAuthGuard`,
    // which would turn a clean 401 into an unhandled 500 for the whole request.
    try {
      entries[name] = decodeURIComponent(value);
    } catch {
      continue;
    }
  }
  return entries;
}

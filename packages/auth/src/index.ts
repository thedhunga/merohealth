import {
  createHmac,
  createPublicKey,
  randomBytes,
  randomInt,
  timingSafeEqual,
  verify as verifyRsaSignature,
} from 'node:crypto';

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
  // A bare (no leading "+") 10-digit number that itself starts with the
  // digits "977" is indistinguishable from a country-code prefix by prefix
  // alone — "9771234567" already matches NEPAL_MOBILE_PATTERN on its own.
  // Only strip "977" when a literal "+" makes the intent unambiguous, or
  // when the string is too long to be a bare 10-digit number.
  const hasCountryCode = digitsOnly.startsWith('+') || digitsOnly.length > 10;
  const withoutCountryCode = hasCountryCode ? digitsOnly.replace(/^\+?977/, '') : digitsOnly;
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

/* ------------------------------------------------------------------ *
 * Google Sign-In: verifying a Google-issued ID token
 *
 * This re-implements the small slice of RS256 JWT verification a Google ID
 * token needs with `node:crypto` directly, rather than taking a JWT library
 * dependency — the checks Google's own docs require (signature, issuer,
 * audience, expiry) fit in well under a hundred lines, and this package has
 * carried zero runtime dependencies since it was written. `alg` is
 * hard-pinned to `RS256` rather than trusted from the token header, which is
 * the standard defence against "alg: none" / algorithm-confusion attacks
 * that a naive "read alg from the header and dispatch on it" implementation
 * would be open to.
 * ------------------------------------------------------------------ */

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
// Google's own token-verification guidance lists both forms as valid `iss`
// values; which one appears is not something callers control.
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

export class GoogleIdTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleIdTokenError';
  }
}

/**
 * Narrows a `GoogleIdTokenError` to "the JWKS endpoint itself was
 * unreachable" (non-2xx response or the fetch throwing outright) as opposed
 * to "the token presented was invalid" (bad signature, wrong audience,
 * expired, unverified email, ...). A caller needs this distinction because
 * the two failure classes deserve different HTTP treatment: the first is an
 * outage (503, retry later, other sign-in paths unaffected), the second is a
 * rejected credential (401, retrying the same token never helps). Matches on
 * the message prefix both JWKS-fetch failure branches in
 * `verifyGoogleIdToken` share, and nothing else in this function throws with
 * that prefix.
 */
export function isGoogleJwksUnreachable(error: unknown): boolean {
  return error instanceof GoogleIdTokenError && error.message.startsWith('Failed to ');
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: true;
  name: string | undefined;
  picture: string | undefined;
}

interface GoogleJwk {
  kty?: string;
  kid?: string;
  n?: string;
  e?: string;
}

function base64UrlDecode(segment: string): Buffer {
  return Buffer.from(segment, 'base64url');
}

function decodeJsonSegment(segment: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecode(segment).toString('utf8'));
  } catch {
    throw new GoogleIdTokenError(`Malformed Google ID token (${label})`);
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new GoogleIdTokenError(`Malformed Google ID token (${label})`);
  }
  return parsed as Record<string, unknown>;
}

/**
 * Validates a Google-issued OpenID Connect ID token against Google's
 * published JWKS — signature, issuer, audience, expiry — then rejects an
 * unverified email address, since Google will issue a token for an account
 * whose email it has not confirmed control of and this product must never
 * turn one of those into a session. `fetchImpl` exists purely so tests can
 * hand this a fixture JWKS instead of a real network call; real callers pass
 * nothing and get the global `fetch`.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleIdentity> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new GoogleIdTokenError('Malformed Google ID token');
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  if (headerB64 === undefined || payloadB64 === undefined || signatureB64 === undefined) {
    throw new GoogleIdTokenError('Malformed Google ID token');
  }

  const header = decodeJsonSegment(headerB64, 'header');
  if (header['alg'] !== 'RS256') {
    throw new GoogleIdTokenError(`Unsupported Google ID token algorithm: ${String(header['alg'])}`);
  }
  const kid = header['kid'];
  if (typeof kid !== 'string' || kid.length === 0) {
    throw new GoogleIdTokenError('Google ID token is missing a key id');
  }

  // `fetchImpl` throws (not just a non-2xx response) when the network path to
  // Google is actually down — DNS failure, connection refused, timeout — the
  // exact condition a caller's fault-isolation test means by "JWKS
  // unreachable". Left unwrapped, that throw would escape as a bare
  // `TypeError`/`DOMException` instead of the `GoogleIdTokenError` every other
  // failure in this function produces, so a caller catching one error class
  // would still be surprised by this one path.
  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetchImpl(GOOGLE_JWKS_URL);
  } catch (error) {
    throw new GoogleIdTokenError(`Failed to reach Google's signing keys endpoint: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) {
    throw new GoogleIdTokenError(`Failed to fetch Google's signing keys: ${response.status}`);
  }
  const jwks = (await response.json()) as { keys?: GoogleJwk[] };
  const jwk = (jwks.keys ?? []).find((key) => key.kid === kid && key.kty === 'RSA');
  if (!jwk?.n || !jwk.e) {
    throw new GoogleIdTokenError('No matching Google signing key for this token');
  }

  const publicKey = createPublicKey({ key: { kty: 'RSA', n: jwk.n, e: jwk.e }, format: 'jwk' });
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
  const signature = base64UrlDecode(signatureB64);
  if (!verifyRsaSignature('RSA-SHA256', signingInput, publicKey, signature)) {
    throw new GoogleIdTokenError('Google ID token signature is invalid');
  }

  const payload = decodeJsonSegment(payloadB64, 'payload');

  const iss = payload['iss'];
  if (typeof iss !== 'string' || !GOOGLE_ISSUERS.has(iss)) {
    throw new GoogleIdTokenError(`Unexpected Google ID token issuer: ${String(iss)}`);
  }
  if (payload['aud'] !== clientId) {
    throw new GoogleIdTokenError('Google ID token was issued for a different client');
  }
  const exp = payload['exp'];
  if (typeof exp !== 'number' || Date.now() >= exp * 1000) {
    throw new GoogleIdTokenError('Google ID token has expired');
  }
  const sub = payload['sub'];
  if (typeof sub !== 'string' || sub.length === 0) {
    throw new GoogleIdTokenError('Google ID token is missing a subject');
  }
  const email = payload['email'];
  if (typeof email !== 'string' || payload['email_verified'] !== true) {
    throw new GoogleIdTokenError('Google account email is not verified');
  }

  return {
    sub,
    email,
    emailVerified: true,
    name: typeof payload['name'] === 'string' ? payload['name'] : undefined,
    picture: typeof payload['picture'] === 'string' ? payload['picture'] : undefined,
  };
}

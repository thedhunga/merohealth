import type { UserRole } from '@swasthya/database';
import type { AssuranceLevel } from '@swasthya/shared-types';

/**
 * Everything `AuthService` needs to persist, behind one port — same
 * "port here, adapter in the module" shape as `HealthDocumentStore`
 * (`records.service.ts`) and `SubscriptionResolver`. `PrismaAuthStore` is
 * the real adapter `AuthModule` wires in; tests inject a hand-rolled
 * in-memory fake instead of standing up a live Postgres, the same trade this
 * whole app made before Round two A1 — only now the real adapter exists
 * alongside the fake rather than being the only option.
 */

export const AUTH_STORE = 'AUTH_STORE';

export interface OtpChallengeRecord {
  id: string;
  phone: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface AuthUserRecord {
  id: string;
  // `User.phone` is nullable in the schema (e.g. the seeded demonstration
  // patients predate this module and have none) — honest about that here
  // rather than fabricating a value for a user this store didn't create.
  phone: string | null;
  // Round three D — a Google-authenticated user has an email (Google refuses
  // an unverified one, see `verifyGoogleIdToken`); a phone-only user has
  // none. Never fabricated for a phone user, never derived from `phone`.
  // Optional rather than required-nullable like `phone` (a deliberate
  // exception to this file's own pattern): a dozen unrelated controller
  // tests across the codebase hand-construct this shape for `CurrentUserResult`
  // fixtures that predate Google sign-in and have no reason to know about
  // it — making this field merely absent-by-default keeps those callers
  // valid instead of forcing an unrelated mechanical edit onto every one of
  // them.
  email?: string | null;
  // Set only by the Google identity provider. Nullable and independent of
  // `phone` — see the schema comment on `User.googleSub` for why the two
  // providers are alternative doors, not linked accounts by default. Optional
  // for the same reason as `email` above.
  googleSub?: string | null;
  role: UserRole;
  locale: string;
  // Never `ANONYMOUS` here — a `User` row only exists once phone + OTP has
  // already reached `REGISTERED` (see `packages/identity`'s own comment on
  // why that rung has no persisted representation). Typed against the wider
  // `AssuranceLevel` from `@swasthya/shared-types` rather than a narrower
  // local union so `AuthService.currentUser` can hand it straight through.
  assuranceLevel: AssuranceLevel;
}

export interface AuthStore {
  createOtpChallenge(input: {
    phone: string;
    codeHash: string;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<OtpChallengeRecord>;
  /** Most recently created challenge for this phone, consumed or not — `AuthService` uses it purely for the resend cooldown check. */
  latestOtpChallengeForPhone(phone: string): Promise<OtpChallengeRecord | null>;
  findOtpChallenge(id: string): Promise<OtpChallengeRecord | null>;
  recordFailedOtpAttempt(id: string): Promise<void>;
  consumeOtpChallenge(id: string, consumedAt: Date): Promise<void>;

  findUserByPhone(phone: string): Promise<AuthUserRecord | null>;
  findUserById(userId: string): Promise<AuthUserRecord | null>;
  createPatientUser(input: { phone: string; locale: string }): Promise<AuthUserRecord>;

  /** The Google identity path's equivalent of `findUserByPhone` — looked up by `sub`, never by email, so two Google accounts that happen to share a recovery email can never collide. */
  findUserByGoogleSub(googleSub: string): Promise<AuthUserRecord | null>;
  createGoogleUser(input: { googleSub: string; email: string; locale: string }): Promise<AuthUserRecord>;

  createPatientProfile(input: { userId: string; displayName: string }): Promise<{ id: string }>;
  findPatientProfileByUserId(userId: string): Promise<{ id: string } | null>;

  createSession(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<SessionRecord>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  revokeSession(id: string, revokedAt: Date): Promise<void>;

  /**
   * Raises `userId` to `IDENTITY_VERIFIED`. The one caller is
   * `IdentityService.approve`, itself only reachable once per owner —
   * `packages/identity`'s `verificationTransitions` has no edge back into
   * `APPROVED`, so a second approval throws before this is ever called
   * twice for the same person. Idempotent regardless, since re-setting an
   * already-`IDENTITY_VERIFIED` user to the same value is harmless.
   */
  markIdentityVerified(userId: string): Promise<void>;
}

import type { UserRole } from '@swasthya/database';

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
  role: UserRole;
  locale: string;
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
}

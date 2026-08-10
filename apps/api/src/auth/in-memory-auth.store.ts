import { randomUUID } from 'node:crypto';
import type { AuthStore, AuthUserRecord, OtpChallengeRecord, SessionRecord } from './auth-store.js';

/**
 * A hand-rolled `AuthStore` fake, test-only — `AuthModule` always wires the
 * real `PrismaAuthStore` (see its own doc comment on why auth specifically
 * doesn't get an in-memory production fallback the way `RecordsModule`'s
 * storage port does). Exists so `auth.service.test.ts` and
 * `session-auth.guard.test.ts` can exercise real business logic without a
 * live Postgres, the same trade every other domain package in this repo
 * made before Round two's real-database push began.
 */
export class InMemoryAuthStore implements AuthStore {
  private readonly challenges = new Map<string, OtpChallengeRecord>();
  private readonly usersByPhone = new Map<string, AuthUserRecord>();
  private readonly usersById = new Map<string, AuthUserRecord>();
  private readonly profilesByUserId = new Map<string, { id: string }>();
  private readonly sessionsByTokenHash = new Map<string, SessionRecord>();

  createOtpChallenge(input: { phone: string; codeHash: string; expiresAt: Date; createdAt: Date }): Promise<OtpChallengeRecord> {
    const challenge: OtpChallengeRecord = { id: randomUUID(), attempts: 0, consumedAt: null, ...input };
    this.challenges.set(challenge.id, challenge);
    return Promise.resolve(challenge);
  }

  latestOtpChallengeForPhone(phone: string): Promise<OtpChallengeRecord | null> {
    const forPhone = [...this.challenges.values()].filter((c) => c.phone === phone);
    forPhone.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return Promise.resolve(forPhone[0] ?? null);
  }

  findOtpChallenge(id: string): Promise<OtpChallengeRecord | null> {
    return Promise.resolve(this.challenges.get(id) ?? null);
  }

  recordFailedOtpAttempt(id: string): Promise<void> {
    const challenge = this.challenges.get(id);
    if (challenge) challenge.attempts += 1;
    return Promise.resolve();
  }

  consumeOtpChallenge(id: string, consumedAt: Date): Promise<void> {
    const challenge = this.challenges.get(id);
    if (challenge) challenge.consumedAt = consumedAt;
    return Promise.resolve();
  }

  findUserByPhone(phone: string): Promise<AuthUserRecord | null> {
    return Promise.resolve(this.usersByPhone.get(phone) ?? null);
  }

  findUserById(userId: string): Promise<AuthUserRecord | null> {
    return Promise.resolve(this.usersById.get(userId) ?? null);
  }

  createPatientUser(input: { phone: string; locale: string }): Promise<AuthUserRecord> {
    const user: AuthUserRecord = { id: randomUUID(), phone: input.phone, role: 'PATIENT', locale: input.locale };
    this.usersByPhone.set(input.phone, user);
    this.usersById.set(user.id, user);
    return Promise.resolve(user);
  }

  createPatientProfile(input: { userId: string; displayName: string }): Promise<{ id: string }> {
    const profile = { id: randomUUID() };
    this.profilesByUserId.set(input.userId, profile);
    return Promise.resolve(profile);
  }

  findPatientProfileByUserId(userId: string): Promise<{ id: string } | null> {
    return Promise.resolve(this.profilesByUserId.get(userId) ?? null);
  }

  createSession(input: { userId: string; tokenHash: string; expiresAt: Date; createdAt: Date }): Promise<SessionRecord> {
    const session: SessionRecord = { id: randomUUID(), revokedAt: null, ...input };
    this.sessionsByTokenHash.set(session.tokenHash, session);
    return Promise.resolve(session);
  }

  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return Promise.resolve(this.sessionsByTokenHash.get(tokenHash) ?? null);
  }

  revokeSession(id: string, revokedAt: Date): Promise<void> {
    for (const session of this.sessionsByTokenHash.values()) {
      if (session.id === id) session.revokedAt = revokedAt;
    }
    return Promise.resolve();
  }
}

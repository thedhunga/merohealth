export const HISTORY_STORE = 'HISTORY_STORE';

export interface HistoryExchangeInput {
  askedAt: string;
  question: string;
  /** Null when the answer was refused, unavailable, an emergency stop, or off-topic — see `AnonymousExchange` in `apps/web`. */
  answer: string | null;
  language: string;
  outcome: 'answered' | 'emergency' | 'offTopic' | 'unavailable';
}

/**
 * Raw, as offered anonymously — not yet a `TwinFact`. See
 * `HistoryMigration.profileSnapshot`'s doc comment in `schema.prisma` for
 * why. `| undefined`, not just `?:` — this is the shape zod's `.optional()`
 * infers, matching `VerifyOtpInput`'s own reasoning under
 * `exactOptionalPropertyTypes`.
 */
export interface AnonymousProfileSnapshot {
  ageBand?: string | undefined;
  conditions?: string[] | undefined;
  askingFor?: string | undefined;
}

export interface MigrateHistoryInput {
  userId: string;
  anonymousId: string;
  exchanges: readonly HistoryExchangeInput[];
  profile: AnonymousProfileSnapshot;
}

/**
 * Port behind `POST /history/migrate` — same "port here, `Prisma*` adapter
 * plus an in-memory test fake" shape as `AuthStore`/`FamilyGrantsStore`.
 *
 * One method, not a separate `findMigration` + `save`: idempotency-on-conflict
 * is an invariant of "migrate", not two steps a caller could get out of
 * order, so the port only exposes the operation whole.
 */
export interface HistoryStore {
  /**
   * Persists the exchanges and profile snapshot for a first-time
   * `anonymousId`. A retry with an `anonymousId` already recorded is a
   * no-op — `alreadyMigrated: true` — never a duplicate insert or an error,
   * because the client only clears its local copy after it sees success, so
   * a dropped response must be safe to retry.
   */
  migrate(input: MigrateHistoryInput): Promise<{ alreadyMigrated: boolean }>;
}

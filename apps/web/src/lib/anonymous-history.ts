/**
 * Conversation history before anyone has signed in.
 *
 * The product promise is that a person asks, gets an answer, and is only asked
 * to sign in once there is something worth keeping. That is impossible if the
 * first visit forgets everything. So questions and answers accumulate here,
 * on the device, under a random anonymous id — and when the person does sign
 * in, `drainForMigration` hands the whole thing to the account so nothing
 * they told us before is lost.
 *
 * Deliberately localStorage rather than a server-side session:
 *
 *   - Nothing leaves the phone until the person chooses an account. A store
 *     of unauthenticated health questions on our servers would be a liability
 *     with no owner to answer to.
 *   - It survives a closed tab, which sessionStorage does not, and "I asked
 *     yesterday" is exactly the case that matters.
 *   - It is per-device, which is the honest scope of anonymity anyway.
 *
 * Capped and pruned so it cannot grow without bound on a low-storage phone.
 */

import { TRIAL_MINUTES_FREE } from '@/content/pricing';

export const ANON_HISTORY_KEY = 'mero-health:anon-history';
export const ANON_ID_KEY = 'mero-health:anon-id';
export const PENDING_PROFILE_KEY = 'mero-health:pending-profile-confirmation';
export const UPSELL_DISMISSED_KEY = 'mero-health:upsell-dismissed';

/** Enough to be useful, small enough to migrate in one request. */
const MAX_ENTRIES = 40;

export interface AnonymousExchange {
  id: string;
  askedAt: string;
  question: string;
  /** Null when the answer was refused, unavailable, an emergency stop, or off-topic. */
  answer: string | null;
  language: string;
  /** What we already know from the profile prompts, if answered. */
  outcome: 'answered' | 'emergency' | 'offTopic' | 'unavailable';
  /**
   * The advisory attached to `answer`, if any — so the saved transcript
   * still shows the "see a health worker" warning, not just the answer it
   * was attached to. Absent rather than `null` on an old entry: no
   * migration runs over what is already in localStorage, so a pre-existing
   * entry simply has no opinion on whether it warranted one.
   */
  advisory?: { kind: 'medicine' | 'advice'; medicines: string[] };
  /**
   * Round five, task H: groups the exchanges asked in one sitting so the
   * thread UI can render them as a single conversation rather than a flat
   * list. `GetCareFlow` mints one id per mount and again on every explicit
   * reset; absent on any exchange saved before this field existed, so old
   * entries just render as their own single-turn conversation.
   */
  conversationId?: string;
  /**
   * Whether the question came in by voice (dictation) rather than typed —
   * `GetCareFlow` uses this to decide whether the *answer* should be spoken
   * automatically without the person pressing Listen. Absent on an entry
   * saved before this field existed, which is correctly read as "no",
   * matching how a typed question never auto-spoke either.
   */
  spokenIn?: boolean;
}

export interface AnonymousProfile {
  /** Free-text age band or year, whatever the person offered. */
  ageBand?: string;
  /** Conditions the person mentioned or confirmed, in their own words. */
  conditions?: string[];
  /** Whether they are asking for someone else, and who. */
  askingFor?: string;
  /** Prompts already asked, so the same one is never repeated. */
  askedPrompts: string[];
}

/**
 * Round six, task L: the free tier's monthly trial allowance of duplex
 * voice minutes (`TRIAL_MINUTES_FREE`), metered on-device against the
 * anonymous id. `monthKey` (`YYYY-MM`, UTC) is what makes the counter a
 * *monthly* allowance rather than a lifetime one — a stored bucket from a
 * past month reads as zero without anything having to run on a schedule to
 * reset it.
 */
export interface VoiceUsage {
  monthKey: string;
  secondsUsed: number;
}

interface Store {
  version: 1;
  exchanges: AnonymousExchange[];
  profile: AnonymousProfile;
  usage: VoiceUsage;
}

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

const emptyUsage = (): VoiceUsage => ({ monthKey: currentMonthKey(), secondsUsed: 0 });

function normalizeUsage(raw: unknown): VoiceUsage {
  if (
    raw &&
    typeof raw === 'object' &&
    typeof (raw as VoiceUsage).monthKey === 'string' &&
    typeof (raw as VoiceUsage).secondsUsed === 'number'
  ) {
    return raw as VoiceUsage;
  }
  return emptyUsage();
}

const empty = (): Store => ({ version: 1, exchanges: [], profile: { askedPrompts: [] }, usage: emptyUsage() });

function read(): Store {
  try {
    const raw = window.localStorage.getItem(ANON_HISTORY_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Store>;
    if (parsed.version !== 1 || !Array.isArray(parsed.exchanges)) return empty();
    return {
      version: 1,
      exchanges: parsed.exchanges,
      profile: { askedPrompts: [], ...(parsed.profile ?? {}) },
      // Absent on any store written before this field existed — reads as a
      // fresh, empty allowance for the current month rather than failing.
      usage: normalizeUsage(parsed.usage),
    };
  } catch {
    return empty();
  }
}

function write(store: Store): void {
  try {
    window.localStorage.setItem(ANON_HISTORY_KEY, JSON.stringify(store));
  } catch {
    // Quota or private mode: degrade to memory-only for this page load.
  }
}

/** Stable per-device id, created on first use. Never sent anywhere until sign-in. */
export function anonymousId(): string {
  try {
    const existing = window.localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(ANON_ID_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export function recordExchange(entry: Omit<AnonymousExchange, 'id' | 'askedAt'>): void {
  const store = read();
  store.exchanges.push({ ...entry, id: crypto.randomUUID(), askedAt: new Date().toISOString() });
  // Keep the newest; the oldest are the least likely to matter to an answer.
  if (store.exchanges.length > MAX_ENTRIES) {
    store.exchanges = store.exchanges.slice(-MAX_ENTRIES);
  }
  write(store);
}

export function history(): readonly AnonymousExchange[] {
  return read().exchanges;
}

export function profile(): AnonymousProfile {
  return read().profile;
}

export function updateProfile(patch: Partial<Omit<AnonymousProfile, 'askedPrompts'>>): void {
  const store = read();
  store.profile = { ...store.profile, ...patch };
  write(store);
}

export function markPromptAsked(promptKey: string): void {
  const store = read();
  if (!store.profile.askedPrompts.includes(promptKey)) {
    store.profile.askedPrompts.push(promptKey);
    write(store);
  }
}

/**
 * Everything, for hand-off to an account on sign-in. Returns the payload and
 * clears local storage only after the caller confirms the migration landed —
 * a failed network call must not lose the person's history.
 */
export function snapshotForMigration(): { anonymousId: string; store: Store } {
  return { anonymousId: anonymousId(), store: read() };
}

export function clearAfterMigration(): void {
  try {
    window.localStorage.removeItem(ANON_HISTORY_KEY);
    window.localStorage.removeItem(ANON_ID_KEY);
  } catch {
    // Nothing to do; a stale copy on the device is the safe failure.
  }
}

/**
 * What `stashPendingProfileConfirmation` carries across the sign-in redirect
 * — deliberately just the three confirmable fields, not the whole
 * `AnonymousProfile`. `| undefined` on every field, not just `?:` — this is
 * built from a destructured `AnonymousProfile`, whose own optional fields
 * carry `| undefined` in their static type, matching
 * `AnonymousProfileSnapshot`'s own reasoning in `apps/api`'s
 * `history-store.ts` under `exactOptionalPropertyTypes`.
 */
export interface PendingProfileConfirmation {
  ageBand?: string | undefined;
  conditions?: string[] | undefined;
  askingFor?: string | undefined;
}

/**
 * Round four F2. `clearAfterMigration` below wipes `AnonymousProfile`
 * entirely once the raw hint is safely stored server-side
 * (`HistoryMigration.profileSnapshot`) — that data is not yet a `TwinFact`,
 * and the person hasn't confirmed anything yet, so it must not survive as
 * `AnonymousProfile` past that point. This is a deliberate, separate copy
 * under its own key, written by `migrateAnonymousHistory` right before it
 * clears, so `/account`'s confirmation card has something to show back after
 * the redirect. A no-op when there is nothing worth confirming, so the key
 * is never created empty.
 */
export function stashPendingProfileConfirmation(profile: AnonymousProfile): void {
  const { ageBand, conditions, askingFor } = profile;
  if (!ageBand && !askingFor && (!conditions || conditions.length === 0)) return;
  try {
    const pending: PendingProfileConfirmation = { ageBand, conditions, askingFor };
    window.localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(pending));
  } catch {
    // Quota or private mode: the confirmation step just has nothing to show
    // — the same degradation `write()` already accepts elsewhere, and no
    // worse than the hint never having been offered.
  }
}

export function readPendingProfileConfirmation(): PendingProfileConfirmation | null {
  try {
    const raw = window.localStorage.getItem(PENDING_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingProfileConfirmation;
  } catch {
    return null;
  }
}

/** Called once the person has explicitly confirmed or skipped — either way, the hint has been acted on and must not be offered again on the next visit to `/account`. */
export function clearPendingProfileConfirmation(): void {
  try {
    window.localStorage.removeItem(PENDING_PROFILE_KEY);
  } catch {
    // Nothing to do; a stale copy on the device is the safe failure.
  }
}

/**
 * Whether it is a good moment to suggest signing in.
 *
 * Not on the first question — she came for an answer, not an account. After
 * a couple of real answers there is genuinely something worth keeping, and
 * saying so is a service rather than a sales pitch.
 */
export function shouldSuggestSignIn(): boolean {
  const answered = read().exchanges.filter((e) => e.outcome === 'answered').length;
  return answered >= 2;
}

/**
 * Round six, task L: the upsell card shown in the dialogue after a first
 * voice answer is dismissible, once, forever — never nagging. A separate
 * top-level key rather than a field on `AnonymousProfile`: dismissal is a UI
 * preference, not part of the person's health profile, and must survive
 * independently of whatever `clearAfterMigration` does to the history/profile
 * store.
 */
export function isUpsellDismissed(): boolean {
  try {
    return window.localStorage.getItem(UPSELL_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissUpsell(): void {
  try {
    window.localStorage.setItem(UPSELL_DISMISSED_KEY, '1');
  } catch {
    // Quota or private mode: the card simply offers itself again next visit
    // — no worse than the dismiss button never having existed.
  }
}

/**
 * Round six, task L: on-device metering for the free tier's monthly trial
 * minutes of duplex voice. Recorded inside the same `Store` as `exchanges`
 * and `profile`, not a separate top-level key like `UPSELL_DISMISSED_KEY`
 * above — this *is* part of the person's history in the sense that matters
 * here: `snapshotForMigration` must carry a running total across sign-in the
 * same way it already carries the exchanges themselves, so someone who used
 * five of their trial minutes anonymously does not see the counter reset to
 * zero the moment they create an account.
 *
 * Nothing calls this yet. Today's spoken conversation (task H) runs on the
 * browser's own free Web Speech API, not the billed Gemini Live duplex
 * session this allowance is actually for (task K′, still a flag-gated spike
 * with no shipped page). Metering the free Web Speech conversation against
 * this allowance would silently start capping a feature that is unlimited
 * for everyone today — a product change nobody has asked for, not a data-
 * layer task. So this exists as the ledger box asked for it — the counter
 * and its migration — ready for K′ to call the moment duplex actually spends
 * a person's minutes.
 */
export function recordVoiceUsageSeconds(seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const store = read();
  const usage = store.usage.monthKey === currentMonthKey() ? store.usage : emptyUsage();
  store.usage = { monthKey: usage.monthKey, secondsUsed: usage.secondsUsed + seconds };
  write(store);
}

/** Seconds of duplex voice used so far this calendar month; 0 the instant a new month starts. */
export function voiceUsageSecondsThisMonth(): number {
  const usage = read().usage;
  return usage.monthKey === currentMonthKey() ? usage.secondsUsed : 0;
}

/**
 * Minutes left of the free tier's monthly trial allowance, or `null` when
 * the owner has not set `TRIAL_MINUTES_FREE` yet. Mirrors every other unset
 * freemium value in this product (`formatFreemiumMinutes` and friends):
 * "we don't know the limit" is a distinct state from "the limit is zero,"
 * and must never be read as though someone had exhausted an allowance
 * nobody has actually configured.
 */
export function remainingTrialMinutes(): number | null {
  if (TRIAL_MINUTES_FREE === null) return null;
  const usedMinutes = voiceUsageSecondsThisMonth() / 60;
  return Math.max(0, TRIAL_MINUTES_FREE - usedMinutes);
}

/** True only once a real, owner-set trial allowance has actually run out. */
export function hasExhaustedTrialMinutes(): boolean {
  const remaining = remainingTrialMinutes();
  return remaining !== null && remaining <= 0;
}

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

export const ANON_HISTORY_KEY = 'mero-health:anon-history';
export const ANON_ID_KEY = 'mero-health:anon-id';
export const PENDING_PROFILE_KEY = 'mero-health:pending-profile-confirmation';

/** Enough to be useful, small enough to migrate in one request. */
const MAX_ENTRIES = 40;

export interface AnonymousExchange {
  id: string;
  askedAt: string;
  question: string;
  /** Null when the answer was refused, unavailable, or an emergency stop. */
  answer: string | null;
  language: string;
  /** What we already know from the profile prompts, if answered. */
  outcome: 'answered' | 'emergency' | 'unavailable';
  /**
   * The advisory attached to `answer`, if any — so the saved transcript
   * still shows the "see a health worker" warning, not just the answer it
   * was attached to. Absent rather than `null` on an old entry: no
   * migration runs over what is already in localStorage, so a pre-existing
   * entry simply has no opinion on whether it warranted one.
   */
  advisory?: { kind: 'medicine' | 'advice'; medicines: string[] };
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

interface Store {
  version: 1;
  exchanges: AnonymousExchange[];
  profile: AnonymousProfile;
}

const empty = (): Store => ({ version: 1, exchanges: [], profile: { askedPrompts: [] } });

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

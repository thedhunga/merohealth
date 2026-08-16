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

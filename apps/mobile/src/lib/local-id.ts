/**
 * A session-scoped identifier, not a persistent account id. Nothing in this
 * app persists across a relaunch yet — `AppStateProvider`'s own `facts` state
 * is plain in-memory `useState`, the same as this — and there is still no
 * identity/auth layer anywhere in the repo (see `agent-progress.md`'s
 * standing notes on every `apps/api` run touching owner scoping). Minting a
 * durable per-device id here would quietly pretend that gap is closed.
 *
 * `Math.random` is enough for a value that only needs to be
 * collision-unlikely within one running session, not cryptographically
 * unpredictable: there is no `crypto.randomUUID` guaranteed present on Hermes
 * across every Expo SDK 57 target, and reaching for `node:crypto` would break
 * Metro bundling the same way `packages/devices` deliberately avoided it.
 */
function generateLocalId(prefix: string): string {
  const stamp = Date.now().toString(36);
  // padEnd guards the (astronomically unlikely but real) case where
  // Math.random() lands on a value whose base-36 expansion is short.
  const random = Math.random().toString(36).slice(2, 10).padEnd(4, '0');
  return `${prefix}-${stamp}-${random}`;
}

export function generateLocalOwnerId(): string {
  return generateLocalId('local');
}

/** Same scheme, distinct prefix — for `CorpusUtterance.id`, not an owner. */
export function generateUtteranceId(): string {
  return generateLocalId('utterance');
}

/**
 * A session-scoped random id for client-only state that has nowhere to
 * persist yet. `apps/web` has no identity/auth layer or backend of its own
 * (see `agent-progress.md`'s standing note on every `apps/api`-adjacent run
 * touching owner scoping) — this stands in for the real id a future service
 * layer would assign. Unlike `apps/mobile`'s own `local-id.ts`, there's no
 * Hermes/Metro bundling constraint here: this file only ever runs in a
 * browser or during Next's Node-based SSR pass, both of which have
 * `crypto.randomUUID()` natively.
 */
export function generateLocalId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

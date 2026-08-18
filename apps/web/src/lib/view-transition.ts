export interface ViewTransitionEnv {
  /**
   * A minimal, structural stand-in for `Document` — not `Pick<Document,
   * 'startViewTransition'>` — so a test double doesn't have to return a real
   * `ViewTransition`, matching the injectable-`matchMedia` style below
   * rather than the DOM lib's exact (and much wider) signature.
   */
  document?: { startViewTransition?: ((run: () => void) => unknown) | undefined } | undefined;
  matchMedia?: ((query: string) => { matches: boolean }) | undefined;
  /**
   * React's `flushSync`, injected rather than imported so this module stays
   * DOM-only and testable without `react-dom`. `startViewTransition` needs
   * the DOM to already reflect the new state by the time its callback
   * returns to capture an accurate before/after snapshot; an ordinary
   * (possibly batched/async) React update can commit too late for that.
   * Omit it and `run` executes as given — the right default for a plain,
   * non-React DOM change.
   */
  flushSync?: ((run: () => void) => void) | undefined;
}

/**
 * Should a route change use the native View Transitions API, or just
 * navigate instantly?
 *
 * Same injectable-`matchMedia` shape as `shouldAnimateReveal`
 * (`hooks/useReveal.ts`) and `shouldPlayAmbientLoop`
 * (`components/ui/LoopVideo.tsx`), so it's testable without a DOM. Chromium
 * 125+ and recent Safari/Firefox implement `startViewTransition`; everywhere
 * else this returns `false` and callers fall back to a plain, unanimated
 * navigation — the browser's own default, never a blocked or delayed one.
 */
export function shouldUseViewTransition(env: ViewTransitionEnv = {}): boolean {
  if (typeof env.document?.startViewTransition !== 'function') return false;
  const mm = env.matchMedia;
  if (!mm) return true;
  return !mm('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Runs `run` — a route change — inside `document.startViewTransition` when
 * supported and wanted, otherwise runs it immediately. `run` always executes
 * synchronously either way: `startViewTransition` calls its callback
 * synchronously too, it only defers the *animation* (capturing a before/after
 * snapshot around it), so navigation itself is never blocked or delayed by
 * this wrapper, per the Round seven task Q brief.
 */
export function runWithViewTransition(run: () => void, env: ViewTransitionEnv = {}): void {
  if (!shouldUseViewTransition(env)) {
    run();
    return;
  }
  const flush = env.flushSync;
  env.document!.startViewTransition!(flush ? () => flush(run) : run);
}

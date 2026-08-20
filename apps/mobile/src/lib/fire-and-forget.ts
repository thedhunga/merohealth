/**
 * Runs a deliberately un-awaited side effect — speech playback, a haptic tick —
 * whose success or failure must never surface to the person using the app.
 *
 * This exists because a bare `void somePromise()` does **not** make that safe.
 * `void` discards the resolved *value*, but a promise that *rejects* is still an
 * unhandled rejection — and on Hermes and on the web export that either crashes
 * the screen or floods the console, exactly the silent-failure class the camera
 * (`request-camera-access.ts`) and link (`open-external-url.ts`) helpers already
 * close. `expo-speech`'s `stop()` and `expo-haptics`' `selectionAsync()` reject
 * when the native module is missing on a stripped build or the web platform has
 * no equivalent, so the many `void Speech.stop()` calls were one platform quirk
 * away from that. Routing them through here makes the intent — "ignore the
 * outcome" — explicit *and* actually rejection-safe.
 *
 * Takes a thunk rather than a promise so a synchronous throw (a native module
 * that is entirely absent, so the call itself throws) is swallowed too, and so
 * the native call can be injected in tests without mocking the module — the same
 * shape the sibling `src/lib` helpers use.
 */
export function fireAndForget(run: () => Promise<unknown> | void): void {
  try {
    const result = run();
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      (result as PromiseLike<unknown>).then(undefined, () => {});
    }
  } catch {
    // A synchronous throw from the side effect is equally non-critical.
  }
}

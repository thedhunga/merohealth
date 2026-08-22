/**
 * Split out of `useVoiceContributionRecorder.ts` so this decision can be unit
 * tested without mocking `navigator.mediaDevices.getUserMedia`/`MediaRecorder`
 * — the hook itself still owns the side effects; this file holds only the
 * pure classification of what `getUserMedia` rejected with.
 */

/**
 * `NotAllowedError` is the only outcome an actual browser permission prompt
 * produces. Every other rejection — no microphone attached
 * (`NotFoundError`), the mic busy in another app/OS call (`NotReadableError`),
 * unsatisfiable constraints, or anything else — is a real, recoverable
 * device problem, not a permission the person needs to change. Collapsing
 * both into "permission denied" sends someone with no working microphone off
 * to check a browser setting that was never the cause, with no way to
 * self-diagnose the real issue.
 */
export function resolveGetUserMediaFailureStatus(error: unknown): 'permission-denied' | 'device-unavailable' {
  return error instanceof DOMException && error.name === 'NotAllowedError' ? 'permission-denied' : 'device-unavailable';
}

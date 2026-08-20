export type OpenUrlOutcome = { ok: true } | { ok: false };

/**
 * `Linking.openURL` returns a promise that **rejects** when the device has no
 * app registered for the URL's scheme (or the URL is malformed) — and every
 * caller here fires it from `onPress` as `void Linking.openURL(...)`. An
 * unguarded rejection therefore left a tapped source citation, and the
 * "Open Perplexity Health" fallback, doing nothing at all with no message: a
 * dead control the person cannot tell apart from a slow one. Collapsing the
 * rejection (and a synchronous throw from a null native module) into a
 * `{ ok: false }` outcome lets the screen say something instead of dropping a
 * promise nobody is holding.
 */
export async function openExternalUrl(
  open: (url: string) => Promise<unknown>,
  url: string,
): Promise<OpenUrlOutcome> {
  try {
    await open(url);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

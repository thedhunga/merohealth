/**
 * Guards the `next` query param `useSession`'s redirect through `/signin`
 * round-trips through. `next` reaches this straight from
 * `window.location.search` with no server-side validation anywhere in the
 * chain — `next=https://evil.example` or the protocol-relative
 * `next=//evil.example` (browsers resolve a leading `//` against the
 * current scheme, i.e. to an external host) would otherwise turn a routine
 * sign-in redirect into an open redirect. Only a same-origin, absolute path
 * is accepted; anything else, including `null`, falls back to the caller's
 * default.
 */
export function sanitizeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  // `//host` and `/\host` are both browser-recognised ways to smuggle a
  // different origin into what looks like a root-relative path.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
  if (raw.includes('://')) return null;
  return raw;
}

/**
 * Href for `PhoneOtpFlow`'s sign-in ↔ register switch link. A visitor
 * bounced onto `/signin?next=/clinicians/register` who doesn't actually
 * have an account yet clicks through to `/register` — without carrying
 * `next` across that hop, they land on `/account` after registering
 * instead of back on the page they were trying to reach, same bug the
 * primary bounce-and-return path had before `sanitizeNextPath` existed.
 * Returns the bare path when there is nothing to carry, which is also the
 * correct href before hydration completes (`next` is read from
 * `window.location.search`, unavailable during SSR, so the caller passes
 * `null` on the first render either way).
 */
export function switchLinkHref(basePath: string, next: string | null): string | { pathname: string; query: { next: string } } {
  return next ? { pathname: basePath, query: { next } } : basePath;
}

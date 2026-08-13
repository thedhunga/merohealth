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

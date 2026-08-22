import type { CurrentUserResponse } from '@/lib/auth-api';

export type SessionState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: CurrentUserResponse };

export type OptionalSessionState = SessionState | { status: 'anonymous' };

/**
 * Split out of `useSession.ts` so this decision logic can be unit tested
 * without pulling in `@/i18n/navigation` (next-intl's `next/navigation`
 * wrapper) at module load time — vitest's default dependency handling
 * externalises `next` to Node's own ESM resolver, which can't resolve
 * `next/navigation`'s extensionless subpath the way Next's bundler does, so
 * any test file that imports `useSession.ts` directly fails before a single
 * assertion runs. The hook itself still lives there; this file holds only
 * the pure, side-effect-free decisions it makes.
 */

/**
 * Where an anonymous visitor to a protected page should be sent, or `null`
 * if the current state isn't a reason to redirect.
 */
export function resolveSignInRedirect(
  status: OptionalSessionState['status'],
  pathname: string,
): { pathname: '/signin'; query: { next: string } } | null {
  return status === 'anonymous' ? { pathname: '/signin', query: { next: pathname } } : null;
}

/**
 * `useSession` never reports `anonymous` to its caller — while the redirect
 * to `/signin` above is in flight there is still no protected content to
 * show, so this collapses it into `loading` rather than adding a third state
 * every caller would otherwise have to handle.
 */
export function resolveSessionState(query: OptionalSessionState): SessionState {
  return query.status === 'anonymous' ? { status: 'loading' } : query;
}

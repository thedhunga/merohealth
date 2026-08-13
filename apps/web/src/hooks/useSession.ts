'use client';

import { useEffect, useState } from 'react';

import { usePathname, useRouter } from '@/i18n/navigation';
import { getCurrentUser, type CurrentUserResponse } from '@/lib/auth-api';

export type SessionState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: CurrentUserResponse };

export type OptionalSessionState = SessionState | { status: 'anonymous' };

/**
 * Shared poll against `GET /auth/me`. `useSession` and `useOptionalSession`
 * differ only in what they do with a rejection, so both read from this one
 * fetch rather than issuing it twice.
 */
function useSessionQuery(): OptionalSessionState {
  const [state, setState] = useState<OptionalSessionState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (!cancelled) setState({ status: 'authenticated', user });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'anonymous' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/**
 * `apps/web` cannot read the `mero_session` cookie itself — `AuthController`
 * sets it scoped to `apps/api`'s own origin (see `sessionCookieOptions` in
 * `apps/api`'s `auth.controller.ts`), not this site's, so there is nothing
 * for a server component here to inspect. Asking `GET /auth/me` is the only
 * way to know, which is why this is a client hook rather than middleware.
 *
 * Redirects to `/signin` on any failure, not only a clean 401 — there is no
 * protected content to half-render for someone whose session state this
 * hook can't establish, and signing in again is the one recovery path that
 * works regardless of why `/auth/me` failed. Use this only on a page that is
 * itself protected content; a public page has nothing to redirect an
 * anonymous visitor away from and should use `useOptionalSession` instead.
 *
 * Carries the page the visitor was actually trying to reach as `?next=` —
 * without it every bounce through `/signin` lands everyone back on
 * `/account` regardless of where they started, which is wrong for any
 * protected page other than `/account` itself (e.g. `/clinicians/register`).
 * `PhoneOtpFlow` reads it back once the session is live.
 */
export function useSession(): SessionState {
  const router = useRouter();
  const pathname = usePathname();
  const query = useSessionQuery();

  useEffect(() => {
    if (query.status === 'anonymous') router.replace({ pathname: '/signin', query: { next: pathname } });
  }, [query.status, router, pathname]);

  // Still redirecting: report `loading` rather than `anonymous` so a caller
  // of this hook never has to handle a third state it has no content for.
  return query.status === 'anonymous' ? { status: 'loading' } : query;
}

/**
 * The Header/MobileNav variant. Those render on every one of the ~70
 * marketing routes, which an anonymous visitor is supposed to see —
 * `useSession`'s redirect-on-failure would send most visitors straight to
 * `/signin` on every page load. This reports `anonymous` instead and leaves
 * the decision to the caller, which for nav chrome is simply which links to
 * show.
 */
export function useOptionalSession(): OptionalSessionState {
  return useSessionQuery();
}

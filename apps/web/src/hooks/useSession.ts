'use client';

import { useEffect, useState } from 'react';

import { useRouter } from '@/i18n/navigation';
import { getCurrentUser, type CurrentUserResponse } from '@/lib/auth-api';

export type SessionState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: CurrentUserResponse };

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
 * works regardless of why `/auth/me` failed.
 */
export function useSession(): SessionState {
  const router = useRouter();
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (!cancelled) setState({ status: 'authenticated', user });
      })
      .catch(() => {
        if (!cancelled) router.replace('/signin');
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return state;
}

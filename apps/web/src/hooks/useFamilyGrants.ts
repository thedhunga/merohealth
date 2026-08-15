'use client';

import { useEffect, useState } from 'react';

import { getFamilyGrants, type SubjectGrantsResponse } from '@/lib/family-api';

export type FamilyGrantsState =
  | { status: 'loading' }
  | { status: 'loaded'; grants: SubjectGrantsResponse }
  | { status: 'error' };

/**
 * `AccountView.tsx`'s real source for `buildActingSubjects`'s two grant
 * arguments, now that `GET /family/grants` exists. `enabled` gates the
 * fetch on a live session (`useSession` resolving `authenticated`) rather
 * than firing on mount unconditionally — the endpoint is
 * `SessionAuthGuard`-protected, so an anonymous request would only ever
 * 401. On `error` this reports the same empty-arrays shape the caller
 * already handled honestly before this endpoint existed — a failed fetch
 * degrades the switcher to SELF-only, never blocks the rest of the page
 * `user` already has real data for.
 *
 * The returned `refresh` function re-runs the fetch on demand — added for
 * `DelegationForm.tsx`, whose successful `POST /family/grants/delegations`
 * would otherwise leave this hook's cached `loaded` state stale until the
 * next full page load.
 */
export function useFamilyGrants(enabled: boolean): [FamilyGrantsState, () => void] {
  const [state, setState] = useState<FamilyGrantsState>({ status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ status: 'loading' });
    getFamilyGrants()
      .then((grants) => {
        if (!cancelled) setState({ status: 'loaded', grants });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, version]);

  return [state, () => setVersion((current) => current + 1)];
}

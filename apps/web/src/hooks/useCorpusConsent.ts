'use client';

import { useEffect, useState } from 'react';
import type { CorpusConsentGrant } from '@swasthya/language-corpus';

import { getCorpusConsentGrants } from '@/lib/corpus-consent-api';

export type CorpusConsentState =
  | { status: 'loading' }
  | { status: 'loaded'; grants: readonly CorpusConsentGrant[] }
  | { status: 'error' };

/**
 * `AccountView.tsx`'s source for the health-conversation-audio toggle's
 * current on/off state. Mirrors `useFamilyGrants`'s own shape exactly,
 * including why: `enabled` gates the fetch on a live session rather than
 * firing on mount, since the endpoint is `SessionAuthGuard`-protected and an
 * anonymous request would only ever 401; `error` degrades to "off" (the
 * toggle's own default-off reading of an unloaded state) rather than
 * blocking the rest of the page.
 *
 * The returned `refresh` re-runs the fetch on demand, for the toggle's own
 * grant/revoke actions to call after a successful write.
 */
export function useCorpusConsent(enabled: boolean): [CorpusConsentState, () => void] {
  const [state, setState] = useState<CorpusConsentState>({ status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ status: 'loading' });
    getCorpusConsentGrants()
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

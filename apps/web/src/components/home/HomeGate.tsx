'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';

import { history } from '@/lib/anonymous-history';
import { homeVariant, ssrHomeVariant } from '@/lib/home-screen';
import { HomeScreen } from '@/components/home/HomeScreen';
import { FirstVisitScreen } from '@/components/home/FirstVisitScreen';

/**
 * Round seven, task O: `/` renders differently depending on whether the
 * device has asked before, and — for a first visit — which locale. Only once
 * mounted can this component read `localStorage`, so before that it renders
 * `ssrHomeVariant`'s pick: the lean first-visit screen for `ne`, marketing
 * for `/en`. It used to render marketing pre-mount for every locale, which
 * meant `page.tsx`'s whole marketing subtree — three ~35 KB images included
 * — was server-rendered, downloaded, and then discarded on every first
 * Nepali visit; that alone broke the CI page-weight budget. `page.tsx` now
 * passes `marketing` only for locales whose SSR variant is marketing, so the
 * Nepali payload doesn't even contain it. A returning `ne` device briefly
 * sees the same-shaped, mic-first first-visit screen before `HomeScreen`
 * takes over — a milder flash than the marketing page it used to show.
 */
export function HomeGate({ marketing }: { marketing?: ReactNode }) {
  const locale = useLocale();
  const [returning, setReturning] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setReturning(history().length > 0);
    setMounted(true);
  }, []);

  const variant = mounted ? homeVariant(locale, returning) : ssrHomeVariant(locale);
  if (variant === 'returning') return <HomeScreen />;
  if (variant === 'firstVisitLean') return <FirstVisitScreen />;
  return <>{marketing}</>;
}

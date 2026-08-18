'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';

import { history } from '@/lib/anonymous-history';
import { homeVariant } from '@/lib/home-screen';
import { HomeScreen } from '@/components/home/HomeScreen';
import { FirstVisitScreen } from '@/components/home/FirstVisitScreen';

/**
 * Round seven, task O: `/` renders differently depending on whether the
 * device has asked before, and — for a first visit — which locale. `marketing`
 * is what the server already rendered for `page.tsx`'s current JSX: real
 * HTML in the initial response, so search crawlers and a first-time
 * visitor's first paint are unaffected. Only once mounted can this
 * component read `localStorage` at all, so it starts by showing exactly
 * what the server sent, then `homeVariant` decides what it swaps to — the
 * same after-mount reveal `shouldSuggestSignIn` and the upsell card already
 * use elsewhere in this codebase for a signal that only exists on the
 * client. `marketing` variant is a no-op swap (the server already rendered
 * it), so `/en` never flashes.
 */
export function HomeGate({ marketing }: { marketing: ReactNode }) {
  const locale = useLocale();
  const [returning, setReturning] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setReturning(history().length > 0);
    setMounted(true);
  }, []);

  const variant = mounted ? homeVariant(locale, returning) : 'marketing';
  if (variant === 'returning') return <HomeScreen />;
  if (variant === 'firstVisitLean') return <FirstVisitScreen />;
  return <>{marketing}</>;
}

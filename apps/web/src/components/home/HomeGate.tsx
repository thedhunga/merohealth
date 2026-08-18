'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { history } from '@/lib/anonymous-history';
import { HomeScreen } from '@/components/home/HomeScreen';

/**
 * Round seven, task O: `/` renders differently for a device that has asked
 * before. `marketing` is what the server already rendered — real HTML in
 * the initial response, so search crawlers and a first-time visitor's first
 * paint are unaffected. Only once mounted can this component read
 * `localStorage` at all, so it starts by showing exactly what the server
 * sent and swaps to `HomeScreen` a moment later for a device with history —
 * the same after-mount reveal `shouldSuggestSignIn` and the upsell card
 * already use elsewhere in this codebase for a signal that only exists on
 * the client.
 */
export function HomeGate({ marketing }: { marketing: ReactNode }) {
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    setReturning(history().length > 0);
  }, []);

  if (returning) return <HomeScreen />;
  return <>{marketing}</>;
}

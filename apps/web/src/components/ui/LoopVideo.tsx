'use client';

import { useEffect, useState } from 'react';

interface LoopVideoProps {
  src: string;
  poster: string;
  /** Minimum viewport width at which the loop is worth its bytes. */
  minWidth?: number;
}

/**
 * Should this device spend data on an ambient loop?
 *
 * Measured on the live homepage at 375 px: the hero loop is 2.5 MB — 89% of
 * the page. `autoplay` makes browsers fetch the file regardless of
 * `preload="metadata"`, and `display:none` hides a video without stopping the
 * download. So the decision has to be made *before* the element exists.
 * Phones, Save-Data, slow connections and reduced-motion get the poster only.
 */
export function shouldPlayAmbientLoop(minWidth: number, env: {
  matchMedia?: ((q: string) => { matches: boolean }) | undefined;
  connection?: { saveData?: boolean; effectiveType?: string } | undefined;
} = {}): boolean {
  const mm = env.matchMedia;
  if (!mm) return false;
  if (mm('(prefers-reduced-motion: reduce)').matches) return false;
  if (!mm(`(min-width: ${minWidth}px)`).matches) return false;
  const c = env.connection;
  if (c?.saveData) return false;
  if (c?.effectiveType && c.effectiveType !== '4g') return false;
  return true;
}

export function LoopVideo({ src, poster, minWidth = 768 }: LoopVideoProps) {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } };
    setPlay(
      shouldPlayAmbientLoop(minWidth, {
        matchMedia: typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : undefined,
        connection: nav.connection,
      }),
    );
  }, [minWidth]);

  if (!play) return null;

  return (
    <video
      aria-hidden
      autoPlay
      className="absolute inset-0 size-full object-cover"
      loop
      muted
      playsInline
      poster={poster}
      preload="metadata"
      tabIndex={-1}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}

'use client';

import type { ReactNode } from 'react';
import { useReveal } from '@/hooks/useReveal';
import { cn } from '@/lib/cn';

/**
 * The class string for a given reveal state, pulled out of the component so
 * it's testable without a DOM — same split as `shouldPlayAmbientLoop` /
 * `LoopVideo`. `translate-y-3` is exactly 12px on the default Tailwind scale
 * (`0.75rem`); only `opacity`/`transform` change, so nothing here can shift
 * layout the way an animated `margin` or `height` would.
 */
export function revealClassName(hidden: boolean, className?: string): string {
  return cn('transition-[opacity,transform] duration-[280ms] ease-out', hidden && 'translate-y-3 opacity-0', className);
}

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Fraction of the element that must be visible before it reveals. */
  threshold?: number;
}

/**
 * Fade/translate-in wrapper, the JS-side complement to `globals.css`'s
 * `.reveal` (see `useReveal` for why one isn't just the other). Renders
 * fully visible everywhere by default — server, first paint, no-JS,
 * `prefers-reduced-motion` — and only takes on the hidden starting state
 * once `useReveal` confirms, client-side and after mount, that it can
 * actually animate back in. A stalled or disabled script therefore never
 * leaves the content invisible.
 */
export function Reveal({ children, className, threshold }: RevealProps) {
  const { ref, armed, visible } = useReveal<HTMLDivElement>({ threshold });

  return (
    <div ref={ref} className={revealClassName(armed && !visible, className)}>
      {children}
    </div>
  );
}

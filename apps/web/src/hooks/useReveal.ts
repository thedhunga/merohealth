'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Should scroll-reveal actually animate, or should content just be visible?
 *
 * Mirrors `shouldPlayAmbientLoop`'s injectable-`matchMedia` pattern
 * (`components/ui/LoopVideo.tsx`) so the decision is testable without a DOM.
 * A missing `matchMedia` (very old browser, or no `window` yet) is treated
 * as "animate" rather than "reduced motion" — `Reveal` never actually hides
 * content until this returns `true` and an observer confirms support (see
 * `useReveal` below), so the unsafe direction to guess wrong in is never hit
 * either way; this just keeps the ordinary case honest.
 */
export function shouldAnimateReveal(
  env: {
    matchMedia?: ((query: string) => { matches: boolean }) | undefined;
  } = {},
): boolean {
  const mm = env.matchMedia;
  if (!mm) return true;
  return !mm('(prefers-reduced-motion: reduce)').matches;
}

interface UseRevealOptions {
  /** Fraction of the element that must be visible before it reveals. */
  threshold?: number | undefined;
}

interface UseRevealResult<T extends HTMLElement> {
  ref: React.RefObject<T | null>;
  /**
   * True once JS has confirmed motion is wanted and `IntersectionObserver`
   * exists. `Reveal` only applies its hidden starting state once this is
   * true, so a person without JS, on `prefers-reduced-motion`, or on a
   * browser lacking the observer always just sees the content — never a
   * permanently invisible block waiting on a script that didn't run.
   */
  armed: boolean;
  /** True once the element has entered the viewport past `threshold`. */
  visible: boolean;
}

/**
 * Scroll-triggered fade/translate-in, JS-side.
 *
 * `globals.css`'s `.reveal`/`.reveal-stagger` already do this with
 * `animation-timeline: view()`, but that's unsupported in Firefox (the
 * comment right above those rules says so) and simply skips the animation
 * there rather than degrading to a matching one. This hook is the
 * cross-browser version, built on `IntersectionObserver` instead of scroll
 * timelines, for anywhere that gap matters.
 */
export function useReveal<T extends HTMLElement = HTMLElement>({
  threshold = 0.2,
}: UseRevealOptions = {}): UseRevealResult<T> {
  const ref = useRef<T | null>(null);
  const [armed, setArmed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    const animate = shouldAnimateReveal({
      matchMedia: typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : undefined,
    });
    if (!animate || !node || typeof IntersectionObserver !== 'function') return;

    setArmed(true);
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, armed, visible };
}

import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

import { FOCUSABLE_SELECTOR, shouldWrapFocus } from '@/lib/focusTrap';

interface UseFocusTrapOptions {
  /** Focus returns here on close instead of wherever `document.activeElement` drifted to. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /**
   * Selector for landmarks outside the trap to mark `inert` while active, so
   * a screen reader user can't navigate into page content hidden behind the
   * modal drawer. Defaults to the two landmarks that sit outside `<header>`
   * in `app/[locale]/layout.tsx` — there is exactly one of each per page.
   */
  inertSelector?: string;
}

/**
 * Traps Tab focus inside `containerRef` while `active` and moves focus into
 * it on activation. Hand-rolled rather than a dependency: the mobile drawer
 * is the only modal surface in this app so far, and the logic is small
 * enough that a library would cost more to audit than to write.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  { returnFocusRef, inertSelector = 'main, footer' }: UseFocusTrapOptions = {},
) {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const inertTargets = Array.from(document.querySelectorAll<HTMLElement>(inertSelector));
    inertTargets.forEach((el) => {
      el.inert = true;
    });

    const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    (focusables[0] ?? container).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const current = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      const first = current[0];
      const last = current[current.length - 1];
      if (!first || !last) return;

      const wrap = shouldWrapFocus(document.activeElement, first, last, event.shiftKey);
      if (wrap === 'first') {
        event.preventDefault();
        first.focus();
      } else if (wrap === 'last') {
        event.preventDefault();
        last.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);

    return () => {
      container.removeEventListener('keydown', onKeyDown);
      inertTargets.forEach((el) => {
        el.inert = false;
      });
      (returnFocusRef?.current ?? previouslyFocused.current)?.focus();
    };
  }, [active, containerRef, returnFocusRef, inertSelector]);
}

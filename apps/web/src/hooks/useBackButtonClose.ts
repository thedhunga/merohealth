import { useEffect } from 'react';

/**
 * Makes the OS/browser back gesture close an open overlay instead of
 * leaving the page behind it. An installed PWA (`display: 'standalone'`)
 * has no browser chrome, so the back gesture is the *only* "back" a phone
 * user has — without a history entry for the overlay to consume, that
 * gesture skips straight past it to whatever's underneath (the previous
 * page, or off the app entirely), the opposite of how every native app's
 * back button treats an open sheet or menu.
 *
 * Hand-rolled rather than a dependency, same call `useFocusTrap` already
 * made: the mobile drawer is the only overlay in this app that needs it,
 * and the logic is a few lines. Deliberately does not call `history.back()`
 * on a non-popstate close (Escape, outside click, a nav link) — a link tap
 * closes the drawer *and* pushes its own history entry in the same event,
 * and calling `back()` there would race that push and undo the navigation
 * instead of the drawer. The pushed state is left in the stack in that
 * case; it is a harmless same-URL duplicate, not a functional bug.
 */
export function useBackButtonClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;

    window.history.pushState({ backButtonClose: true }, '');

    const onPopState = () => onClose();
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [active, onClose]);
}

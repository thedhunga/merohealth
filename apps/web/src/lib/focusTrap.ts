/**
 * Elements a keyboard user can Tab to. Mirrors the standard focus-trap
 * selector (links with an href, enabled form controls, explicit tabindex)
 * rather than pulling in a dependency for the one modal surface in this app.
 */
export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Decides whether Tab/Shift+Tab should wrap around the trap, and to which
 * end. Pulled out of the DOM-wiring hook so the boundary logic is testable
 * without a browser: it only ever compares element identity, never touches
 * `document` or focus itself.
 */
export function shouldWrapFocus<T>(
  activeElement: T,
  first: T,
  last: T,
  shiftKey: boolean,
): 'first' | 'last' | null {
  if (shiftKey && activeElement === first) return 'last';
  if (!shiftKey && activeElement === last) return 'first';
  return null;
}

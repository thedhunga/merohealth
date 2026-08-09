import { describe, expect, it } from 'vitest';

import { shouldWrapFocus } from '@/lib/focusTrap';

describe('shouldWrapFocus', () => {
  it('wraps to the last element on Shift+Tab from the first', () => {
    expect(shouldWrapFocus('a', 'a', 'z', true)).toBe('last');
  });

  it('wraps to the first element on Tab from the last', () => {
    expect(shouldWrapFocus('z', 'a', 'z', false)).toBe('first');
  });

  it('does not intervene when focus sits in the middle of the trap', () => {
    expect(shouldWrapFocus('m', 'a', 'z', false)).toBeNull();
    expect(shouldWrapFocus('m', 'a', 'z', true)).toBeNull();
  });

  it('does not intervene when the first element is tabbed forward normally', () => {
    // First-to-second is ordinary browser Tab behaviour, not a boundary.
    expect(shouldWrapFocus('a', 'a', 'z', false)).toBeNull();
  });

  it('wraps to itself when only one element is focusable', () => {
    expect(shouldWrapFocus('a', 'a', 'a', false)).toBe('first');
    expect(shouldWrapFocus('a', 'a', 'a', true)).toBe('last');
  });
});

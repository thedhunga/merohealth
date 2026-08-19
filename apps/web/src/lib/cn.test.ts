import { describe, expect, it } from 'vitest';

import { cn } from '@/lib/cn';

describe('cn', () => {
  it('joins truthy values with a single space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('drops falsy values — false, null, undefined, empty string', () => {
    expect(cn('a', false, 'b', null, undefined, '', 'c')).toBe('a b c');
  });

  it('keeps 0 despite being falsy — the one documented exception', () => {
    // Used across the app as `cn(count && 'label')`-style guards; `0` is a
    // real value some callers pass deliberately (e.g. a badge count), not a
    // "no class" signal like `false`/`''` are.
    expect(cn(0, 'a')).toBe('0 a');
  });

  it('flattens nested arrays, including arrays of arrays', () => {
    expect(cn('a', ['b', 'c'], ['d', ['e', 'f']])).toBe('a b c d e f');
  });

  it('drops an array that flattens to nothing', () => {
    expect(cn('a', [false, null, undefined], 'b')).toBe('a b');
  });

  it('stringifies non-string values', () => {
    expect(cn(1, 'a', 2)).toBe('1 a 2');
  });

  it('returns an empty string when nothing survives', () => {
    expect(cn()).toBe('');
    expect(cn(false, null, undefined, '')).toBe('');
  });
});

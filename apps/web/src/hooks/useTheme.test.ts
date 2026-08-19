import { describe, expect, it } from 'vitest';
import { resolveEffectiveTheme } from './useTheme';

describe('resolveEffectiveTheme', () => {
  it('uses the stored choice when one exists, regardless of OS preference', () => {
    expect(resolveEffectiveTheme({ getStored: () => 'light', prefersDark: () => true })).toBe('light');
    expect(resolveEffectiveTheme({ getStored: () => 'dark', prefersDark: () => false })).toBe('dark');
  });

  it('falls back to the OS preference when nothing is stored', () => {
    expect(resolveEffectiveTheme({ getStored: () => null, prefersDark: () => true })).toBe('dark');
    expect(resolveEffectiveTheme({ getStored: () => null, prefersDark: () => false })).toBe('light');
  });

  it('ignores a stored value that is not a real theme', () => {
    expect(resolveEffectiveTheme({ getStored: () => 'system', prefersDark: () => true })).toBe('dark');
  });

  it('defaults to light when nothing is available at all', () => {
    expect(resolveEffectiveTheme()).toBe('light');
  });
});

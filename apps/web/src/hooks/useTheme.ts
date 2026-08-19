'use client';

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'mero-theme';

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark';
}

/**
 * The theme actually in effect: an explicit stored choice wins, otherwise
 * the OS preference does. Pure and injectable so it's testable without a
 * DOM — mirrors `shouldAnimateReveal`'s pattern in `useReveal.ts`.
 */
export function resolveEffectiveTheme(
  env: {
    getStored?: (() => string | null) | undefined;
    prefersDark?: (() => boolean) | undefined;
  } = {},
): Theme {
  const stored = env.getStored?.() ?? null;
  if (isTheme(stored)) return stored;
  return env.prefersDark?.() ? 'dark' : 'light';
}

function readStoredTheme(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing / storage disabled — treated the same as "no
    // preference stored", which falls back to the OS setting below.
    return null;
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // The static `<meta name="theme-color">` pair in `layout.tsx` already
  // tracks `prefers-color-scheme` with no JS at all; this only needs to run
  // when a person overrides that default, so the browser chrome matches the
  // choice they just made rather than the OS setting they walked away from.
  const color = theme === 'dark' ? '#0e0b1f' : '#171233';
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', color);
  });
}

/**
 * The account-page dark-mode switch (Round seven, task T). `globals.css`'s
 * `prefers-color-scheme` media query already paints the very first frame
 * correctly with zero JavaScript; this hook's job is narrower — reflect
 * that effective theme once mounted, react live if the OS setting changes
 * and nothing has been chosen here, and persist an explicit override when
 * the person flips the switch. Rendered state before mount always matches
 * the server's (`light`), so there's no hydration mismatch to suppress here
 * — only `<html>` itself needs `suppressHydrationWarning`, for the inline
 * script's own attribute write on an explicit override.
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const prefersDark = () =>
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;

    setThemeState(resolveEffectiveTheme({ getStored: readStoredTheme, prefersDark }));

    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (!isTheme(readStoredTheme())) setThemeState(media.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Still switches this tab; just won't persist across a reload.
      }
      applyTheme(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dismissInstall, installPlatform, isInstallDismissed, isRunningStandalone } from '@/lib/install-prompt';

/** Same hand-rolled `localStorage` fake `anonymous-history.test.ts` already uses. */
function createFakeLocalStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  } as unknown as Storage;
}

describe('installPlatform', () => {
  it('recognises iPhone and iPad', () => {
    expect(installPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)')).toBe('ios');
    expect(installPlatform('Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X)')).toBe('ios');
  });

  it('recognises Android', () => {
    expect(installPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126')).toBe('android');
  });

  it('falls through to other for desktop and unrecognised agents', () => {
    expect(installPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)')).toBe('other');
    expect(installPlatform('')).toBe('other');
  });
});

describe('isRunningStandalone', () => {
  it('is false with no signal from either platform', () => {
    expect(isRunningStandalone({})).toBe(false);
  });

  it('reads Android/desktop display-mode', () => {
    expect(isRunningStandalone({ matchMedia: () => ({ matches: true }) })).toBe(true);
    expect(isRunningStandalone({ matchMedia: () => ({ matches: false }) })).toBe(false);
  });

  it('reads iOS Safari navigator.standalone even without matchMedia support', () => {
    expect(isRunningStandalone({ navigatorStandalone: true })).toBe(true);
  });
});

describe('install dismissal, once, forever', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: createFakeLocalStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is not dismissed until dismissInstall is called', () => {
    expect(isInstallDismissed()).toBe(false);
    dismissInstall();
    expect(isInstallDismissed()).toBe(true);
  });

  it('degrades to "not dismissed" when localStorage throws (private mode/quota)', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      },
    });

    expect(isInstallDismissed()).toBe(false);
    expect(() => dismissInstall()).not.toThrow();
  });
});

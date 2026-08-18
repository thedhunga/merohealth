import { afterEach, describe, expect, it, vi } from 'vitest';

import { healthLibraryArticles } from '@/content/healthLibrary';
import { history } from '@/lib/anonymous-history';
import { dailyArticle, greetingPeriod, homeVariant, micHeroLayout } from '@/lib/home-screen';

describe('greetingPeriod', () => {
  it('is morning before noon', () => {
    expect(greetingPeriod(0)).toBe('morning');
    expect(greetingPeriod(11)).toBe('morning');
  });

  it('is afternoon from noon until 5pm', () => {
    expect(greetingPeriod(12)).toBe('afternoon');
    expect(greetingPeriod(16)).toBe('afternoon');
  });

  it('is evening from 5pm on', () => {
    expect(greetingPeriod(17)).toBe('evening');
    expect(greetingPeriod(23)).toBe('evening');
  });
});

describe('dailyArticle', () => {
  it('always returns one of the real health-library articles', () => {
    for (let day = 0; day < healthLibraryArticles.length * 3; day += 1) {
      const article = dailyArticle(new Date(day * 86_400_000));
      expect(healthLibraryArticles).toContain(article);
    }
  });

  it('is stable within the same calendar day', () => {
    const morning = dailyArticle(new Date('2026-08-18T02:00:00.000Z'));
    const night = dailyArticle(new Date('2026-08-18T22:00:00.000Z'));
    expect(morning).toBe(night);
  });

  it('advances the next day', () => {
    const today = dailyArticle(new Date('2026-08-18T12:00:00.000Z'));
    const tomorrow = dailyArticle(new Date('2026-08-19T12:00:00.000Z'));
    // Only a guaranteed inequality when there is more than one article to
    // rotate through — true today (three articles) and worth asserting on
    // directly rather than assuming.
    expect(healthLibraryArticles.length).toBeGreaterThan(1);
    expect(tomorrow).not.toBe(today);
  });
});

describe('homeVariant', () => {
  it('always returns the daily-use screen for a device with history, in any locale', () => {
    expect(homeVariant('ne', true)).toBe('returning');
    expect(homeVariant('en', true)).toBe('returning');
  });

  it('gives a first-time Nepali visitor the lean screen', () => {
    expect(homeVariant('ne', false)).toBe('firstVisitLean');
  });

  it('keeps the full marketing page for a first-time /en visitor', () => {
    expect(homeVariant('en', false)).toBe('marketing');
  });
});

describe('micHeroLayout', () => {
  it('leads with voice when the device has the Web Speech API', () => {
    expect(micHeroLayout(true)).toBe('voiceFirst');
  });

  it('falls back to text-first when the device has no Web Speech API', () => {
    expect(micHeroLayout(false)).toBe('textFirst');
  });

  it('falls back to text-first when the mic permission is denied, even if the API exists', () => {
    expect(micHeroLayout(true, true)).toBe('textFirst');
  });

  it('leads with voice when the API exists and permission was not denied', () => {
    expect(micHeroLayout(true, false)).toBe('voiceFirst');
  });
});

describe('outage: history unreadable → first-time layout — round seven task O', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a device whose localStorage throws to the first-time variant, not the returning one', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError');
        },
        setItem: () => {},
        removeItem: () => {},
      },
    });

    // This is exactly what `HomeGate` does on mount: read history, then hand
    // whether it's non-empty to `homeVariant`. A throwing localStorage must
    // never surface as `'returning'` — that would show a stranger's device
    // someone else's last conversation.
    const isReturning = history().length > 0;

    expect(isReturning).toBe(false);
    expect(homeVariant('ne', isReturning)).toBe('firstVisitLean');
    expect(homeVariant('en', isReturning)).toBe('marketing');
  });
});

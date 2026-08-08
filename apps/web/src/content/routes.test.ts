import { describe, expect, it } from 'vitest';

import { getRouteEntry, routeEntries } from '@/content/routes';

describe('routeEntries', () => {
  it('has no duplicate pathname — sitemap.ts and every generateMetadata read this list, so a duplicate would silently shadow one route', () => {
    const pathnames = routeEntries.map((entry) => entry.pathname);
    expect(new Set(pathnames).size).toBe(pathnames.length);
  });

  it('gives every entry a non-empty titleKey and descriptionKey', () => {
    for (const entry of routeEntries) {
      expect(entry.titleKey).toBeTruthy();
      expect(entry.descriptionKey).toBeTruthy();
    }
  });
});

describe('getRouteEntry', () => {
  it('finds a known route', () => {
    expect(getRouteEntry('/pricing')).toEqual({
      pathname: '/pricing',
      titleKey: 'pricing.hero.title',
      descriptionKey: 'pricing.hero.body',
    });
  });

  it('throws for a route with no registered metadata, rather than silently returning nothing', () => {
    expect(() => getRouteEntry('/does-not-exist')).toThrow('/does-not-exist');
  });
});

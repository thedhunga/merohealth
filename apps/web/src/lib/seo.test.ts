import { describe, expect, it } from 'vitest';

import {
  absoluteUrl,
  alternateLanguages,
  isDemonstrationBuild,
  siteUrl,
  socialImageUrl,
} from '@/lib/seo';

describe('isDemonstrationBuild', () => {
  it('is true, since packages/configuration has no legal entity registered yet', () => {
    // Guards the "keep robots noindex while the demonstration notice is
    // shown" contract: this must flip to false only when a real
    // `legalEntity.registrationId` is configured, never by editing
    // robots.ts or the layout's metadata by hand.
    expect(isDemonstrationBuild).toBe(true);
  });
});

describe('absoluteUrl', () => {
  it('serves the default locale (Nepali) from the bare path', () => {
    expect(absoluteUrl('ne', '/pricing')).toBe(`${siteUrl}/pricing`);
  });

  it('prefixes every other locale', () => {
    expect(absoluteUrl('en', '/pricing')).toBe(`${siteUrl}/en/pricing`);
  });

  it('collapses the bare-path root to the site root, not a trailing slash', () => {
    expect(absoluteUrl('ne', '/')).toBe(`${siteUrl}/`);
    expect(absoluteUrl('en', '/')).toBe(`${siteUrl}/en`);
  });
});

describe('alternateLanguages', () => {
  it('lists every configured locale, keyed by locale code', () => {
    expect(alternateLanguages('/pricing')).toEqual({
      ne: `${siteUrl}/pricing`,
      en: `${siteUrl}/en/pricing`,
    });
  });
});

describe('socialImageUrl', () => {
  it('points at the one real social image in public/, at the same bare path regardless of locale — proxy.ts excludes files with an extension from locale rewriting', () => {
    expect(socialImageUrl()).toBe(`${siteUrl}/mero-health-social.png`);
  });
});

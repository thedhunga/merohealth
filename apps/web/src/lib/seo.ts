import type { Metadata } from 'next';
import { brandConfig } from '@swasthya/configuration';
import { getTranslations } from 'next-intl/server';

import { getRouteEntry } from '@/content/routes';
import { routing, type Locale } from '@/i18n/routing';

/**
 * No production domain is configured yet, so this falls back to the same
 * reserved-for-documentation placeholder `packages/configuration` already
 * uses for the support email (`support@example.invalid`) rather than
 * inventing a real-looking one. Set `NEXT_PUBLIC_SITE_URL` once a domain is
 * registered.
 */
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.invalid';

/**
 * There is no separate "demo mode" flag anywhere in the repo — the one
 * concrete, already-standing fact is that no legal entity is registered yet
 * (`legalEntity.registrationId` is null; see `packages/configuration` and
 * `legal/privacy`, which already keys its own copy off this same field).
 * Robots and per-page indexing follow that fact directly, so flipping it
 * over to a real registration id is the one change that turns indexing back
 * on — nobody has to remember to also edit robots.ts by hand.
 */
export const isDemonstrationBuild = brandConfig.legalEntity.registrationId === null;

/**
 * Mirrors `routing.localePrefix: 'as-needed'` by hand rather than going
 * through `next-intl/navigation`'s `getPathname` — that helper pulls in
 * Next's client-side router bindings, which is fine inside a React tree but
 * drags an import chain into plain modules like this one that has no
 * business being there. The rule itself is simple: the default locale
 * (Nepali) is served bare, every other locale is prefixed.
 */
function localizedPathname(locale: Locale, pathname: string): string {
  if (locale === routing.defaultLocale) {
    return pathname;
  }
  return pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;
}

export function absoluteUrl(locale: Locale, pathname: string): string {
  return new URL(localizedPathname(locale, pathname), siteUrl).toString();
}

/** One entry per locale this route is served under, keyed by locale code — the shape `alternates.languages` expects. */
export function alternateLanguages(pathname: string): Record<string, string> {
  return Object.fromEntries(
    routing.locales.map((locale) => [locale, absoluteUrl(locale, pathname)]),
  );
}

/**
 * The one real social-share image in the repo (`public/mero-health-social.png`)
 * — used site-wide since there's no per-page photography yet. Every page's
 * `openGraph`/`twitter` block must repeat this, not just the root layout's,
 * because Next.js replaces the parent's `openGraph`/`twitter` object outright
 * (rather than merging field-by-field) whenever a page defines its own.
 *
 * Deliberately not run through `absoluteUrl` — `proxy.ts`'s matcher excludes
 * any path with a file extension from locale rewriting, so this file is
 * always served at the same bare path, unlike an actual `[locale]` route.
 */
export function socialImageUrl(): string {
  return new URL('/mero-health-social.png', siteUrl).toString();
}

/**
 * Every marketing page builds its metadata the same way: a title and
 * description read straight from the copy the page itself already renders
 * (via `titleKey`/`descriptionKey`, dot-paths into the locale's messages),
 * never written fresh for SEO — so there is no second copy of a sentence
 * that can drift from what the page actually says. `pathname` is the
 * locale-less route (e.g. `/pricing`), used to derive the canonical URL and
 * language alternates.
 */
export async function buildPageMetadata({
  locale,
  pathname,
  titleKey,
  descriptionKey,
}: {
  locale: string;
  pathname: string;
  titleKey: string;
  descriptionKey: string;
}): Promise<Metadata> {
  const t = await getTranslations({ locale });
  const title = t(titleKey);
  const description = t(descriptionKey);
  const url = absoluteUrl(locale as Locale, pathname);
  const image = socialImageUrl();

  return {
    title,
    description,
    alternates: { canonical: url, languages: alternateLanguages(pathname) },
    openGraph: { title, description, url, images: [{ url: image }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

/**
 * Looks `pathname` up in the route registry and returns a ready-to-export
 * `generateMetadata` — the one line every page.tsx needs, instead of each
 * repeating `buildPageMetadata` with its own title/description keys.
 */
export function createRouteMetadata(pathname: string) {
  const { titleKey, descriptionKey } = getRouteEntry(pathname);

  return async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: string }>;
  }): Promise<Metadata> {
    const { locale } = await params;
    return buildPageMetadata({ locale, pathname, titleKey, descriptionKey });
  };
}

import type { MetadataRoute } from 'next';

import { routeEntries } from '@/content/routes';
import { routing } from '@/i18n/routing';
import { absoluteUrl, alternateLanguages } from '@/lib/seo';

/**
 * One `<url>` entry per route per locale (bare-path Nepali and `/en`-prefixed
 * English are two distinct URLs), each carrying `alternates.languages` so
 * crawlers see the hreflang relationship between them. Built entirely from
 * `content/routes.ts` — the same registry every page's `generateMetadata`
 * reads — so a route can't be missing here without also being missing its
 * own metadata, and vice versa.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return routeEntries.flatMap((entry) =>
    routing.locales.map((locale) => ({
      url: absoluteUrl(locale, entry.pathname),
      alternates: { languages: alternateLanguages(entry.pathname) },
    })),
  );
}

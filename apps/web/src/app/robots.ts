import type { MetadataRoute } from 'next';

import { isDemonstrationBuild, siteUrl } from '@/lib/seo';

/**
 * Blocks crawling outright while `isDemonstrationBuild` holds, rather than
 * relying on the per-page `noindex` meta tag alone — a crawler that never
 * fetches the page never has a reason to index it in the first place. Both
 * this file and every page's `robots` metadata key off the same fact
 * (`legalEntity.registrationId === null`, see `lib/seo.ts`), so registering
 * a real legal entity is the one change that reopens both at once.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', ...(isDemonstrationBuild ? { disallow: '/' } : { allow: '/' }) },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

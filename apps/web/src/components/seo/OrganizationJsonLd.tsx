import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';
import { absoluteUrl, socialImageUrl } from '@/lib/seo';

/**
 * `Organization` + `WebSite` structured data, built only from copy already
 * shipped and shown elsewhere (`brand.name`/`brand.tagline`, the same
 * strings the page `<title>` and header already use) — no address, phone or
 * social profile, since none of those are real yet (the footer's own
 * address and support contact are explicit placeholders, and the social
 * icons link to generic platform homepages, not an actual Mero Health
 * profile). Adding a fabricated one here would hand a search engine a fact
 * this repo doesn't actually have.
 */
export async function OrganizationJsonLd({ locale }: { locale: Locale }) {
  const brand = await getTranslations({ locale, namespace: 'brand' });
  const url = absoluteUrl(locale, '/');
  const logo = socialImageUrl();
  const name = brand('name');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name,
        alternateName: brand('nameLatin'),
        url,
        logo,
        description: brand('tagline'),
      },
      {
        '@type': 'WebSite',
        name,
        url,
        inLanguage: locale,
      },
    ],
  };

  return (
    <script
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      type="application/ld+json"
    />
  );
}

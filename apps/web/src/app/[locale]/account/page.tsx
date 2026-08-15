import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AccountView } from '@/components/account/AccountView';

/**
 * Deliberately not registered in `content/routes.ts` / `sitemap.ts` — every
 * route there is public marketing content meant to be crawled and indexed
 * once `isDemonstrationBuild` clears. This one renders a specific signed-in
 * person's own data and must stay out of the sitemap and out of search
 * results permanently, not just while the whole site is still noindexed —
 * hence the explicit `robots` below instead of inheriting the layout's.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.hero' });
  return {
    title: t('title'),
    description: t('body'),
    robots: { index: false, follow: false },
  };
}

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccountView />;
}

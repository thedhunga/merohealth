import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { OfflineView } from '@/components/layout/OfflineView';
import type { Locale } from '@/i18n/routing';

/**
 * Not in `content/routes.ts` and so not in the sitemap or nav — this route
 * exists only as the service worker's offline fallback (`public/sw.js`),
 * never as something a person navigates to on purpose, so it carries its
 * own `noindex` metadata rather than going through `createRouteMetadata`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'offline' });
  return { title: t('heading'), robots: { index: false, follow: false } };
}

export default async function OfflinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <OfflineView locale={locale as Locale} />;
}

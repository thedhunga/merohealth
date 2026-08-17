import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { VoiceLabView } from '@/components/voice-lab/VoiceLabView';

/**
 * Round six K′ spike, owner-only. Deliberately not registered in
 * `content/routes.ts` / `sitemap.ts` (see `account/page.tsx` for the same
 * pattern) and given an explicit `robots` here rather than inheriting the
 * layout's, so it stays out of search results permanently, not just while
 * `isDemonstrationBuild` keeps the whole site noindexed.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'voiceLab.meta' });
  return {
    title: t('title'),
    description: t('body'),
    robots: { index: false, follow: false },
  };
}

export default async function VoiceLabPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <VoiceLabView locale={locale === 'en' ? 'en' : 'ne'} />;
}

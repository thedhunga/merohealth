import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { VoiceContributionView } from '@/components/voice-contribution/VoiceContributionView';

/**
 * Round six §M's third box. Deliberately not registered in
 * `content/routes.ts` / `sitemap.ts` — the same "account/page.tsx pattern"
 * `voice-lab/page.tsx`'s own comment already names: this renders a specific
 * signed-in person's own consent state and self-report, not public
 * marketing content, so it stays out of the sitemap and search results
 * permanently rather than only while `isDemonstrationBuild` keeps the whole
 * site noindexed.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'voiceContribution' });
  return {
    title: t('heading'),
    description: t('intro'),
    robots: { index: false, follow: false },
  };
}

export default async function ContributePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <VoiceContributionView />;
}

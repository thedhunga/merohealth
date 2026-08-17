import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { VoiceValidationView } from '@/components/voice-validation/VoiceValidationView';

/**
 * Round six §M's Validation flow box. Deliberately not registered in
 * `content/routes.ts` / `sitemap.ts` — the same "account/page.tsx pattern"
 * `contribute/page.tsx`'s own comment already names: this renders a
 * specific signed-in person's own validation queue, not public marketing
 * content, so it stays out of the sitemap and search results permanently.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'voiceValidation' });
  return {
    title: t('heading'),
    description: t('intro'),
    robots: { index: false, follow: false },
  };
}

export default async function ValidatePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <VoiceValidationView />;
}

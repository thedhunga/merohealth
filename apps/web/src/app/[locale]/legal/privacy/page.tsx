import { setRequestLocale } from 'next-intl/server';

import { PrivacyView } from '@/components/legal/PrivacyView';

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <PrivacyView />;
}

import { setRequestLocale } from 'next-intl/server';

import { LegalIndexView } from '@/components/legal/LegalIndexView';

export default async function LegalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <LegalIndexView />;
}

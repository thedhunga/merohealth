import { setRequestLocale } from 'next-intl/server';

import { FaqsView } from '@/components/individuals/FaqsView';

export default async function FaqsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <FaqsView />;
}

import { setRequestLocale } from 'next-intl/server';

import { HowItWorksView } from '@/components/individuals/HowItWorksView';

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HowItWorksView />;
}

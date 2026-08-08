import { setRequestLocale } from 'next-intl/server';

import { HowItWorksView } from '@/components/individuals/HowItWorksView';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/individuals/how-it-works');

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HowItWorksView />;
}

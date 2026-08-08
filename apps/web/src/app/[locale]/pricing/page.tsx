import { setRequestLocale } from 'next-intl/server';

import { PricingView } from '@/components/pricing/PricingView';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/pricing');

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <PricingView />;
}

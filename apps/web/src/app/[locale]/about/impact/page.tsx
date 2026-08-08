import { setRequestLocale } from 'next-intl/server';

import { ImpactView } from '@/components/company/ImpactView';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/about/impact');

export default async function ImpactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ImpactView />;
}

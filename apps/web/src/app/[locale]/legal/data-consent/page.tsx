import { setRequestLocale } from 'next-intl/server';

import { DataConsentView } from '@/components/legal/DataConsentView';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/legal/data-consent');

export default async function DataConsentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <DataConsentView />;
}

import { setRequestLocale } from 'next-intl/server';

import { HealthLibraryIndexView } from '@/components/health-library/HealthLibraryIndexView';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/health-library');

export default async function HealthLibraryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HealthLibraryIndexView />;
}

import { setRequestLocale } from 'next-intl/server';

import { HealthLibraryIndexView } from '@/components/health-library/HealthLibraryIndexView';

export default async function HealthLibraryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HealthLibraryIndexView />;
}

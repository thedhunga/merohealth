import { setRequestLocale } from 'next-intl/server';

import { ResourceCenterView } from '@/components/organizations/ResourceCenterView';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/organizations/resource-center');

export default async function ResourceCenterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ResourceCenterView />;
}

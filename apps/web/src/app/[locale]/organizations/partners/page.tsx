import { setRequestLocale } from 'next-intl/server';

import { PartnersView } from '@/components/organizations/PartnersView';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/organizations/partners');

export default async function PartnersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <PartnersView />;
}

import { setRequestLocale } from 'next-intl/server';

import { OurProvidersView } from '@/components/clinicians/OurProvidersView';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/clinicians/our-providers');

export default async function OurProvidersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <OurProvidersView />;
}

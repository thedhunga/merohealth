import { setRequestLocale } from 'next-intl/server';

import { OurProvidersView } from '@/components/clinicians/OurProvidersView';

export default async function OurProvidersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <OurProvidersView />;
}

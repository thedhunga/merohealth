import { setRequestLocale } from 'next-intl/server';

import { PartnersView } from '@/components/organizations/PartnersView';

export default async function PartnersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <PartnersView />;
}

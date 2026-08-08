import { setRequestLocale } from 'next-intl/server';

import { OurApproachView } from '@/components/organizations/OurApproachView';

export default async function OurApproachPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <OurApproachView />;
}

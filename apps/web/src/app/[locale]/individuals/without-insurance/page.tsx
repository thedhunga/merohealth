import { setRequestLocale } from 'next-intl/server';

import { WithoutInsuranceView } from '@/components/individuals/WithoutInsuranceView';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/individuals/without-insurance');

export default async function WithoutInsurancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <WithoutInsuranceView />;
}

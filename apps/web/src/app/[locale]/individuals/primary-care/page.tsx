import { setRequestLocale } from 'next-intl/server';

import { IndividualsPageView } from '@/components/individuals/IndividualsPageView';
import { getIndividualsPage } from '@/content/individuals';
import { createRouteMetadata } from '@/lib/seo';

const page = getIndividualsPage('primaryCare');

export const generateMetadata = createRouteMetadata('/individuals/primary-care');

export default async function PrimaryCarePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <IndividualsPageView page={page} />;
}

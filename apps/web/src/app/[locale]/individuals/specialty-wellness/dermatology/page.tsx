import { setRequestLocale } from 'next-intl/server';

import { IndividualsPageView } from '@/components/individuals/IndividualsPageView';
import { getIndividualsPage } from '@/content/individuals';
import { createRouteMetadata } from '@/lib/seo';

const page = getIndividualsPage('dermatology');

export const generateMetadata = createRouteMetadata('/individuals/specialty-wellness/dermatology');

export default async function DermatologyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <IndividualsPageView page={page} />;
}

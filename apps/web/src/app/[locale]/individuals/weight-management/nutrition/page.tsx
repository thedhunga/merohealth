import { setRequestLocale } from 'next-intl/server';

import { IndividualsPageView } from '@/components/individuals/IndividualsPageView';
import { getIndividualsPage } from '@/content/individuals';
import { createRouteMetadata } from '@/lib/seo';

const page = getIndividualsPage('nutrition');

export const generateMetadata = createRouteMetadata('/individuals/weight-management/nutrition');

export default async function NutritionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <IndividualsPageView page={page} />;
}

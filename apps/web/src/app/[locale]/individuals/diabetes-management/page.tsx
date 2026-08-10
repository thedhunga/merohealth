import { setRequestLocale } from 'next-intl/server';

import { IndividualsPageView } from '@/components/individuals/IndividualsPageView';
import { getIndividualsPage } from '@/content/individuals';
import { createRouteMetadata } from '@/lib/seo';

const page = getIndividualsPage('diabetesManagement');

export const generateMetadata = createRouteMetadata('/individuals/diabetes-management');

export default async function DiabetesManagementPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <IndividualsPageView page={page} />;
}

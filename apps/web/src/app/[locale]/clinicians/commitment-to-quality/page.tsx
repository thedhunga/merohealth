import { setRequestLocale } from 'next-intl/server';

import { CommitmentToQualityView } from '@/components/clinicians/CommitmentToQualityView';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/clinicians/commitment-to-quality');

export default async function CommitmentToQualityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <CommitmentToQualityView />;
}

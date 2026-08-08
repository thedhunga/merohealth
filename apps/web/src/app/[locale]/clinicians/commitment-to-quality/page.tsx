import { setRequestLocale } from 'next-intl/server';

import { CommitmentToQualityView } from '@/components/clinicians/CommitmentToQualityView';

export default async function CommitmentToQualityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <CommitmentToQualityView />;
}

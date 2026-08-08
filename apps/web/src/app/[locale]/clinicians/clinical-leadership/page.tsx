import { setRequestLocale } from 'next-intl/server';

import { ClinicalLeadershipView } from '@/components/clinicians/ClinicalLeadershipView';

export default async function ClinicalLeadershipPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ClinicalLeadershipView />;
}

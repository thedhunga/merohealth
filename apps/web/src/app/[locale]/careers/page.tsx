import { setRequestLocale } from 'next-intl/server';

import { CareersView } from '@/components/company/CareersView';

export default async function CareersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <CareersView />;
}

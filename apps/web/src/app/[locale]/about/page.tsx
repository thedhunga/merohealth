import { setRequestLocale } from 'next-intl/server';

import { AboutView } from '@/components/company/AboutView';

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AboutView />;
}

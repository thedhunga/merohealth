import { setRequestLocale } from 'next-intl/server';

import { AboutView } from '@/components/company/AboutView';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/about');

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AboutView />;
}

import { setRequestLocale } from 'next-intl/server';

import { CareersView } from '@/components/clinicians/CareersView';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/clinicians/careers');

export default async function CareersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <CareersView />;
}

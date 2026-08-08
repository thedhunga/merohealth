import { setRequestLocale } from 'next-intl/server';

import { HelpView } from '@/components/legal/HelpView';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/help');

export default async function HelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HelpView />;
}

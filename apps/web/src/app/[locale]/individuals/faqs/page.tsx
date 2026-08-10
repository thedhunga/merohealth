import { setRequestLocale } from 'next-intl/server';

import { FaqsView } from '@/components/individuals/FaqsView';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/individuals/faqs');

export default async function FaqsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <FaqsView />;
}

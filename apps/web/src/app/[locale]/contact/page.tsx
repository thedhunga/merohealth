import { setRequestLocale } from 'next-intl/server';

import { ContactView } from '@/components/company/ContactView';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/contact');

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ContactView />;
}

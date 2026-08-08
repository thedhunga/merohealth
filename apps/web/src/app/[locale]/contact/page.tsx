import { setRequestLocale } from 'next-intl/server';

import { ContactView } from '@/components/company/ContactView';

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ContactView />;
}

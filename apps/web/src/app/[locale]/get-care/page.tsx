import { setRequestLocale } from 'next-intl/server';

import { GetCareFlow } from '@/components/get-care/GetCareFlow';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/get-care');

export default async function GetCarePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <GetCareFlow locale={locale === 'en' ? 'en' : 'ne'} />;
}

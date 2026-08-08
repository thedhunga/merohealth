import { setRequestLocale } from 'next-intl/server';

import { NewsroomView } from '@/components/company/NewsroomView';

export default async function NewsroomPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <NewsroomView />;
}

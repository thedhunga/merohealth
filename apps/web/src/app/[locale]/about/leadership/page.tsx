import { setRequestLocale } from 'next-intl/server';

import { LeadershipView } from '@/components/company/LeadershipView';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/about/leadership');

export default async function LeadershipPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <LeadershipView />;
}

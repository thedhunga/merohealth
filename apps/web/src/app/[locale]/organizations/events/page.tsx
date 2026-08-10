import { setRequestLocale } from 'next-intl/server';

import { EventsView } from '@/components/organizations/EventsView';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/organizations/events');

export default async function EventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <EventsView />;
}

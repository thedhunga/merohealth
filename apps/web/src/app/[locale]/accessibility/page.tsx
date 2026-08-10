import { setRequestLocale } from 'next-intl/server';

import { AccessibilityView } from '@/components/legal/AccessibilityView';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/accessibility');

export default async function AccessibilityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AccessibilityView />;
}

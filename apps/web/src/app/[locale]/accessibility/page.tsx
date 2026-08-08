import { setRequestLocale } from 'next-intl/server';

import { AccessibilityView } from '@/components/legal/AccessibilityView';

export default async function AccessibilityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AccessibilityView />;
}

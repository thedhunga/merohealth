import { setRequestLocale } from 'next-intl/server';

import { CommunityGuidelinesView } from '@/components/legal/CommunityGuidelinesView';

export default async function CommunityGuidelinesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <CommunityGuidelinesView />;
}

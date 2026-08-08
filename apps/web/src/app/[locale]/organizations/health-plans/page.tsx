import { setRequestLocale } from 'next-intl/server';

import { OrganizationPartnerView } from '@/components/organizations/OrganizationPartnerView';
import { getOrganizationPartnerPage } from '@/content/organizations';

const page = getOrganizationPartnerPage('healthPlans');

export default async function HealthPlansPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <OrganizationPartnerView page={page} />;
}

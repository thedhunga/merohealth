import { setRequestLocale } from 'next-intl/server';

import { OrganizationPartnerView } from '@/components/organizations/OrganizationPartnerView';
import { getOrganizationPartnerPage } from '@/content/organizations';
import { createRouteMetadata } from '@/lib/seo';

const page = getOrganizationPartnerPage('hospitals');

export const generateMetadata = createRouteMetadata('/organizations/hospitals-health-systems');

export default async function HospitalsHealthSystemsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <OrganizationPartnerView page={page} />;
}

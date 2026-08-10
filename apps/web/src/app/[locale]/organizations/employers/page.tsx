import { setRequestLocale } from 'next-intl/server';

import { OrganizationPartnerView } from '@/components/organizations/OrganizationPartnerView';
import { getOrganizationPartnerPage } from '@/content/organizations';
import { createRouteMetadata } from '@/lib/seo';

const page = getOrganizationPartnerPage('employers');

export const generateMetadata = createRouteMetadata('/organizations/employers');

export default async function EmployersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <OrganizationPartnerView page={page} />;
}

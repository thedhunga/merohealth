import { setRequestLocale } from 'next-intl/server';

import { RegisterView } from '@/components/clinicians/RegisterView';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/clinicians/register');

export default async function ClinicianRegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RegisterView />;
}

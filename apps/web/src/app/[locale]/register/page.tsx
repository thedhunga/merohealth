import { setRequestLocale } from 'next-intl/server';

import { PhoneOtpFlow } from '@/components/auth/PhoneOtpFlow';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/register');

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PhoneOtpFlow intent="REGISTER" />;
}

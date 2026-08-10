import { setRequestLocale } from 'next-intl/server';

import { PhoneOtpFlow } from '@/components/auth/PhoneOtpFlow';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/signin');

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PhoneOtpFlow intent="SIGN_IN" />;
}

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { Martel, Mukta } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd';
import { routing } from '@/i18n/routing';
import { isDemonstrationBuild, siteUrl, socialImageUrl } from '@/lib/seo';

import '@/styles/globals.css';

// Both faces carry Devanagari and Latin, so Nepali and English share one type
// system rather than switching families mid-page.
const martel = Martel({
  subsets: ['devanagari', 'latin'],
  weight: ['400', '700', '800', '900'],
  variable: '--font-martel',
  display: 'swap',
});

const mukta = Mukta({
  subsets: ['devanagari', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-mukta',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'brand' });
  const home = await getTranslations({ locale, namespace: 'home.hero' });
  const socialImage = socialImageUrl();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${t('name')} · ${home('title')}`,
      template: `%s · ${t('name')}`,
    },
    description: home('body'),
    applicationName: t('name'),
    openGraph: {
      type: 'website',
      siteName: t('name'),
      title: `${t('name')} · ${home('title')}`,
      description: home('body'),
      locale: locale === 'ne' ? 'ne_NP' : 'en_US',
      images: [{ url: socialImage }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${t('name')} · ${home('title')}`,
      description: home('body'),
      images: [socialImage],
    },
    robots: {
      // The demonstration build should not be indexed until real content and
      // qualified clinical review are in place — same fact `robots.ts` keys
      // off, see `lib/seo.ts`.
      index: !isDemonstrationBuild,
      follow: !isDemonstrationBuild,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html className={`${martel.variable} ${mukta.variable}`} lang={locale}>
      <body className="flex min-h-dvh flex-col bg-paper">
        <OrganizationJsonLd locale={locale} />
        <NextIntlClientProvider>
          <Header />
          <main className="flex-1" id="main">
            {children}
          </main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

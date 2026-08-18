import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { Martel, Mukta } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ServiceWorkerRegistration } from '@/components/layout/ServiceWorkerRegistration';
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd';
import { routing } from '@/i18n/routing';
import { isDemonstrationBuild, siteUrl, socialImageUrl } from '@/lib/seo';

import '@/styles/globals.css';

// Both faces carry Devanagari and Latin, so Nepali and English share one type
// system rather than switching families mid-page.
//
// Split into two calls rather than one `weight: [...]` array: `next/font`
// preloads every weight file a call declares, on every route that shares
// this layout, with no way to preload a subset of one call's weights. 700
// and 800 are the only Martel weights anything above the fold renders
// anywhere in the app (h1/h2/h3 default to 800, several override to
// font-bold/700) — 400 is unused entirely — so only those two are preloaded.
const martel = Martel({
  subsets: ['devanagari', 'latin'],
  weight: ['700', '800'],
  variable: '--font-martel',
  display: 'swap',
});

// 900 (true black) is real but only ever used below the fold — the
// script-mark signature, a pricing figure, the early-access heading — so it
// is never a candidate for `/`'s first-load budget. `preload: false` keeps
// it out of every route's preload list; `globals.css`'s `font-display-black`
// utility and `script-mark` reach for it explicitly (see the comment there
// on why it can't just live in `--font-display`'s fallback stack).
const martelBlack = Martel({
  subsets: ['devanagari', 'latin'],
  weight: ['900'],
  variable: '--font-martel-black',
  display: 'swap',
  preload: false,
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

// Browser chrome takes the brand indigo; `viewportFit: cover` lets the
// installed app paint under the iPhone notch/home bar like a native app.
export const viewport: Viewport = {
  themeColor: '#171233',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

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
    // PWA: the manifest makes "Add to Home Screen" a real app icon and a
    // full-screen window; appleWebApp does the same for iOS Safari.
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      title: t('name'),
      statusBarStyle: 'black-translucent',
    },
    formatDetection: { telephone: false },
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
    <html
      className={`${martel.variable} ${martelBlack.variable} ${mukta.variable}`}
      lang={locale}
    >
      <body className="flex min-h-dvh flex-col bg-paper">
        <OrganizationJsonLd locale={locale} />
        <ServiceWorkerRegistration />
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

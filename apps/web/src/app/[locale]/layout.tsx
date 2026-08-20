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
// Exactly four faces, chosen against the CI page-weight budget: preload
// flags don't stop downloads — any text that renders a declared weight
// fetches its ~65 KB Devanagari subset — so the only real lever is declaring
// fewer weights. Display is Martel 800 alone (a `font-bold` on the display
// family resolves to 800 by standard font matching; the difference is
// invisible at heading sizes). Body is Mukta 400/600/700; 500 and 900 are
// gone, and `globals.css` maps their old utilities onto shipped weights.
const martel = Martel({
  subsets: ['devanagari', 'latin'],
  weight: ['800'],
  variable: '--font-martel',
  display: 'swap',
});

const mukta = Mukta({
  subsets: ['devanagari', 'latin'],
  weight: ['400', '600', '700'],
  variable: '--font-mukta',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Browser chrome takes the brand indigo, light or dark depending on the OS
// preference — `useTheme.ts`'s `applyTheme` overwrites this same
// `theme-color` meta directly when a person picks an explicit theme via the
// account toggle, so an override doesn't leave the chrome mismatched.
// `viewportFit: cover` lets the installed app paint under the iPhone
// notch/home bar like a native app.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#171233' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0b1f' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// Runs before hydration so an explicit dark-mode override (`useTheme.ts`,
// stored in `localStorage`) paints on the very first frame instead of
// flashing light first. The OS-default case needs none of this — it's
// handled by a plain `prefers-color-scheme` media query in `globals.css`
// with zero JavaScript — so this only ever sets the attribute when there is
// a real stored choice to honour.
const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('mero-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}`;

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
      className={`${martel.variable} ${mukta.variable}`}
      lang={locale}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
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

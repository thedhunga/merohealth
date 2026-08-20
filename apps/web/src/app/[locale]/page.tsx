import { setRequestLocale } from 'next-intl/server';

import { ssrHomeVariant } from '@/lib/home-screen';
import { SymptomEntry } from '@/components/home/SymptomEntry';
import { Hero } from '@/components/home/Hero';
import { ServiceCards } from '@/components/home/ServiceCards';
import { OrganizationTabs } from '@/components/home/OrganizationTabs';
import { Testimonials } from '@/components/home/Testimonials';
import { FinalCta } from '@/components/home/FinalCta';
import { HomeGate } from '@/components/home/HomeGate';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/');

/**
 * Order is by who is reading, not by what we want to say.
 *
 * Someone arriving on a phone has a symptom and wants to type it, so
 * `SymptomEntry` remains the first interaction inside the photographic hero.
 * The record story then explains the differentiator before the broader care
 * catalogue asks the reader to compare services.
 * `OrganizationTabs` sells to employers and health plans — a real audience,
 * but not this one — so it sits after the material aimed at patients rather
 * than a third of the way up the page.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The marketing subtree is passed only where the SSR variant will actually
  // render it. For `ne` it used to be server-rendered and then thrown away on
  // mount — every first Nepali visit downloaded three ~35 KB images and six
  // sections of DOM for nothing, which is what broke the CI page-weight
  // budget (see `ssrHomeVariant` in `lib/home-screen.ts`).
  return (
    <HomeGate
      marketing={
        ssrHomeVariant(locale) === 'marketing' ? (
          <>
            <SymptomEntry />
            <Hero />
            <ServiceCards />
            <OrganizationTabs />
            <Testimonials />
            <FinalCta />
          </>
        ) : undefined
      }
    />
  );
}

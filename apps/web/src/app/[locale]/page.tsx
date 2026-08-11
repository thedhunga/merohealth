import { setRequestLocale } from 'next-intl/server';

import { SymptomEntry } from '@/components/home/SymptomEntry';
import { Hero } from '@/components/home/Hero';
import { ServiceCards } from '@/components/home/ServiceCards';
import { OrganizationTabs } from '@/components/home/OrganizationTabs';
import { Testimonials } from '@/components/home/Testimonials';
import { PartnerMarquee } from '@/components/home/PartnerMarquee';
import { FinalCta } from '@/components/home/FinalCta';
import { createRouteMetadata } from '@/lib/seo';

export const generateMetadata = createRouteMetadata('/');

/**
 * Order is by who is reading, not by what we want to say.
 *
 * Someone arriving on a phone has a symptom and wants to type it, so
 * `SymptomEntry` is first and everything else earns its place below.
 * `OrganizationTabs` sells to employers and health plans — a real audience,
 * but not this one — so it sits after the material aimed at patients rather
 * than a third of the way up the page.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SymptomEntry />
      <ServiceCards />
      <Hero />
      <Testimonials />
      <OrganizationTabs />
      <PartnerMarquee />
      <FinalCta />
    </>
  );
}

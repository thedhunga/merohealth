import { setRequestLocale } from 'next-intl/server';

import { Hero } from '@/components/home/Hero';
import { ServiceCards } from '@/components/home/ServiceCards';
import { OrganizationTabs } from '@/components/home/OrganizationTabs';
import { Testimonials } from '@/components/home/Testimonials';
import { PartnerMarquee } from '@/components/home/PartnerMarquee';
import { FinalCta } from '@/components/home/FinalCta';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <Hero />
      <ServiceCards />
      <OrganizationTabs />
      <Testimonials />
      <PartnerMarquee />
      <FinalCta />
    </>
  );
}

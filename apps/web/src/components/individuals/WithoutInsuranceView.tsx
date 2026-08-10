import { useTranslations } from 'next-intl';

import { HospitalReach } from '@/components/art/HospitalReach';
import { Highlights } from '@/components/ui/Highlights';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section, SectionHeading } from '@/components/ui/Section';

const HIGHLIGHT_KEYS = ['one', 'two', 'three'] as const;

/**
 * `/individuals/without-insurance` — the page the homepage hero's secondary
 * CTA already links to (`Hero.tsx`). Same "no hero CTA" shape as
 * `HowItWorksView`: this route explains the pay-direct model rather than
 * routing straight into care, so it closes on the shared CTA band instead.
 */
export function WithoutInsuranceView() {
  const t = useTranslations('individuals');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.withoutInsurance'),
    title: t('withoutInsurance.hero.title'),
    body: t('withoutInsurance.hero.body'),
    Art: HospitalReach,
    artPosition: 'start' as const,
  };

  const cta = {
    id: 'without-insurance-cta-heading',
    heading: t('cta.heading'),
    body: t('cta.body'),
    primaryCta: { href: '/register', label: t('cta.primaryCta') },
    secondaryCta: { external: true, href: '/app', label: t('cta.secondaryCta') },
  };

  return (
    <PageTemplate cta={cta} hero={hero}>
      <Section labelledBy="without-insurance-highlights-heading">
        <SectionHeading
          align="center"
          id="without-insurance-highlights-heading"
          title={t('sectionHeadings.highlights')}
        />
        <Highlights
          className="mt-12"
          items={HIGHLIGHT_KEYS.map((key) => ({
            key,
            title: t(`withoutInsurance.highlights.items.${key}.title`),
            body: t(`withoutInsurance.highlights.items.${key}.body`),
          }))}
        />
      </Section>
    </PageTemplate>
  );
}

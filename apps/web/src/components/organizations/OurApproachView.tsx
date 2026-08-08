import { useTranslations } from 'next-intl';

import { MemberRouting } from '@/components/art/MemberRouting';
import { Highlights } from '@/components/ui/Highlights';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section, SectionHeading } from '@/components/ui/Section';

const HIGHLIGHT_KEYS = ['one', 'two', 'three'] as const;

/**
 * `/organizations/our-approach`. A single-topic page describing how Mero
 * Health builds for organisations, so it follows the same shape an
 * Individuals condition page uses (hero + a three-up `Highlights` list)
 * rather than the anchored multi-section shape the three partner-type pages
 * need.
 */
export function OurApproachView() {
  const t = useTranslations('organizations.ourApproach');
  const cta = useTranslations('organizations.cta');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.ourApproach'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: MemberRouting,
    artPosition: 'end' as const,
  };

  const ctaProps = {
    id: 'our-approach-cta-heading',
    heading: cta('heading'),
    body: cta('body'),
    primaryCta: { href: '/contact', label: cta('primaryCta') },
    secondaryCta: { href: '/organizations/resource-center', label: cta('secondaryCta') },
  };

  return (
    <PageTemplate cta={ctaProps} hero={hero}>
      <Section labelledBy="our-approach-highlights-heading">
        <SectionHeading
          align="center"
          id="our-approach-highlights-heading"
          title={t('highlightsHeading')}
        />
        <Highlights
          className="mt-12"
          items={HIGHLIGHT_KEYS.map((key) => ({
            key,
            title: t(`highlights.items.${key}.title`),
            body: t(`highlights.items.${key}.body`),
          }))}
        />
      </Section>
    </PageTemplate>
  );
}

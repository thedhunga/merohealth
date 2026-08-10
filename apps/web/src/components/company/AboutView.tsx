import { useTranslations } from 'next-intl';

import { RecordTransform } from '@/components/art/RecordTransform';
import { Highlights } from '@/components/ui/Highlights';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section, SectionHeading } from '@/components/ui/Section';

const HIGHLIGHT_KEYS = ['one', 'two', 'three'] as const;

/**
 * `/about`. Restates the platform's own opening pillars — personal EHR,
 * storage choice, Nepali-first assistant with safety ahead of the model,
 * `platform-vision.md` §1 — in company-facing voice, the same instinct
 * `OurApproachView`/`CommitmentToQualityView` already use for their own
 * audiences. Reuses `RecordTransform`, the homepage hero's signature
 * artwork, rather than a lesser thematic fit: this page's whole point is
 * explaining what the product is, which is exactly what that illustration
 * depicts.
 */
export function AboutView() {
  const t = useTranslations('company.about');
  const cta = useTranslations('company.cta');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.aboutUs'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: RecordTransform,
    artPosition: 'end' as const,
  };

  const ctaProps = {
    id: 'about-cta-heading',
    heading: cta('heading'),
    body: cta('body'),
    primaryCta: { href: '/contact', label: cta('primaryCta') },
    secondaryCta: { href: '/careers', label: cta('secondaryCta') },
  };

  return (
    <PageTemplate cta={ctaProps} hero={hero}>
      <Section labelledBy="about-highlights-heading">
        <SectionHeading
          align="center"
          id="about-highlights-heading"
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

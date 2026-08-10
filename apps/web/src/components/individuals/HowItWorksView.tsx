import { useTranslations } from 'next-intl';

import { MemberRouting } from '@/components/art/MemberRouting';
import { Highlights } from '@/components/ui/Highlights';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section, SectionHeading } from '@/components/ui/Section';

const STEP_KEYS = ['one', 'two', 'three', 'four'] as const;

/**
 * `/individuals/how-it-works`. The only Individuals route that's a sequence
 * rather than a single topic, so it reuses `Highlights`'s numbered list for
 * ordered steps instead of the unordered "what this includes" points a
 * condition page uses. No hero CTA, matching the segment pages: this route
 * explains the product rather than routing straight into care.
 */
export function HowItWorksView() {
  const t = useTranslations('individuals');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.howItWorks'),
    title: t('howItWorks.hero.title'),
    body: t('howItWorks.hero.body'),
    Art: MemberRouting,
    artPosition: 'end' as const,
  };

  const cta = {
    id: 'how-it-works-cta-heading',
    heading: t('cta.heading'),
    body: t('cta.body'),
    primaryCta: { href: '/register', label: t('cta.primaryCta') },
    secondaryCta: { external: true, href: '/app', label: t('cta.secondaryCta') },
  };

  return (
    <PageTemplate cta={cta} hero={hero}>
      <Section labelledBy="how-it-works-steps-heading">
        <SectionHeading
          align="center"
          id="how-it-works-steps-heading"
          title={t('howItWorks.stepsHeading')}
        />
        <Highlights
          className="mt-12"
          items={STEP_KEYS.map((key) => ({
            key,
            title: t(`howItWorks.steps.${key}.title`),
            body: t(`howItWorks.steps.${key}.body`),
          }))}
        />
      </Section>
    </PageTemplate>
  );
}

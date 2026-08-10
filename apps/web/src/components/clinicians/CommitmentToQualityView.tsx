import { useTranslations } from 'next-intl';

import { DiagnosticFocus } from '@/components/art/DiagnosticFocus';
import { Highlights } from '@/components/ui/Highlights';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section, SectionHeading } from '@/components/ui/Section';

const HIGHLIGHT_KEYS = ['one', 'two', 'three'] as const;

/**
 * `/clinicians/commitment-to-quality`. Unlike `clinical-leadership` and
 * `careers`, this has real standing facts to draw on — `clinical-safety`'s
 * deterministic interception and the CONFIRMED/CORRECTED-only rule — so it
 * restates those constraints in clinician-facing voice rather than an empty
 * state, the same instinct as `OurApproachView` restating them for
 * organisations.
 */
export function CommitmentToQualityView() {
  const t = useTranslations('clinicians.commitmentToQuality');
  const cta = useTranslations('clinicians.cta');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.commitmentToQuality'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: DiagnosticFocus,
    artPosition: 'start' as const,
  };

  const ctaProps = {
    id: 'commitment-to-quality-cta-heading',
    heading: cta('heading'),
    body: cta('body'),
    primaryCta: { href: '/contact', label: cta('primaryCta') },
    secondaryCta: { href: '/clinicians/careers', label: cta('secondaryCta') },
  };

  return (
    <PageTemplate cta={ctaProps} hero={hero}>
      <Section labelledBy="commitment-to-quality-highlights-heading">
        <SectionHeading
          align="center"
          id="commitment-to-quality-highlights-heading"
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

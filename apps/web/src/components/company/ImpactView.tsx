import { useTranslations } from 'next-intl';

import { VitalsTrend } from '@/components/art/VitalsTrend';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section } from '@/components/ui/Section';

/**
 * `/about/impact`. Mero Health hasn't reached real patients yet, so this is
 * an honest empty state — same instinct as `EventsView`/`CareersView` —
 * rather than a fabricated statistic. `VitalsTrend`'s trend line stands in
 * for "the impact we'll eventually measure" without showing any actual data.
 */
export function ImpactView() {
  const t = useTranslations('company.impact');
  const cta = useTranslations('company.cta');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.ourImpact'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: VitalsTrend,
    artPosition: 'start' as const,
  };

  const ctaProps = {
    id: 'impact-cta-heading',
    heading: cta('heading'),
    body: cta('body'),
    primaryCta: { href: '/contact', label: cta('primaryCta') },
    secondaryCta: { href: '/careers', label: cta('secondaryCta') },
  };

  return (
    <PageTemplate cta={ctaProps} hero={hero}>
      <Section labelledBy="impact-empty-heading">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
          <h2 className="text-2xl font-bold text-ink" id="impact-empty-heading">
            {t('emptyState.heading')}
          </h2>
          <p className="text-lg leading-relaxed text-ink-soft">{t('emptyState.body')}</p>
        </div>
      </Section>
    </PageTemplate>
  );
}

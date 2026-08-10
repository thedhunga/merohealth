import { useTranslations } from 'next-intl';

import { WorkplaceInvestment } from '@/components/art/WorkplaceInvestment';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section } from '@/components/ui/Section';

/**
 * `/careers` — company-wide hiring (footer's `whoWeAre` column), distinct
 * from `/clinicians/careers` (clinical hiring, footer's `clinicians`
 * column). No listings exist for either, so this is the same honest empty
 * state shape, with its own copy for a different audience. Reuses
 * `WorkplaceInvestment` a third time (already `clinicians/careers` and
 * `organizations/events`): its "investment that compounds" framing is still
 * the single best fit in the art library for a careers page, and no
 * distinct composition exists for company-wide hiring specifically.
 */
export function CareersView() {
  const t = useTranslations('company.careers');
  const cta = useTranslations('company.cta');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.careers'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: WorkplaceInvestment,
    artPosition: 'end' as const,
  };

  // This page IS "see open roles" — the shared secondary link would point
  // back at itself, so it routes to the company mission page instead.
  const ctaProps = {
    id: 'company-careers-cta-heading',
    heading: cta('heading'),
    body: cta('body'),
    primaryCta: { href: '/contact', label: cta('primaryCta') },
    secondaryCta: { href: '/about', label: nav('items.ourCompany') },
  };

  return (
    <PageTemplate cta={ctaProps} hero={hero}>
      <Section labelledBy="company-careers-empty-heading">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
          <h2 className="text-2xl font-bold text-ink" id="company-careers-empty-heading">
            {t('emptyState.heading')}
          </h2>
          <p className="text-lg leading-relaxed text-ink-soft">{t('emptyState.body')}</p>
        </div>
      </Section>
    </PageTemplate>
  );
}

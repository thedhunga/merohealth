import { useTranslations } from 'next-intl';

import { WorkplaceInvestment } from '@/components/art/WorkplaceInvestment';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section } from '@/components/ui/Section';

/**
 * `/clinicians/careers`. No open roles are posted yet, so this is an honest
 * empty state rather than fabricated listings — same shape as `EventsView`.
 * The hero title reuses `nav.promos.clinicians.title` verbatim: the
 * mega-menu promo tile and this dedicated page describe the same "join the
 * clinical team" pitch and shouldn't carry two competing headlines.
 */
export function CareersView() {
  const t = useTranslations('clinicians.careers');
  const cta = useTranslations('clinicians.cta');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.providerCareers'),
    title: nav('promos.clinicians.title'),
    body: t('hero.body'),
    Art: WorkplaceInvestment,
    artPosition: 'end' as const,
  };

  // This page IS "see open roles" — the shared secondary link would point
  // back at itself, so it routes to the provider roster instead.
  const ctaProps = {
    id: 'careers-cta-heading',
    heading: cta('heading'),
    body: cta('body'),
    primaryCta: { href: '/contact', label: cta('primaryCta') },
    secondaryCta: { href: '/clinicians/our-providers', label: nav('items.ourProviders') },
  };

  return (
    <PageTemplate cta={ctaProps} hero={hero}>
      <Section labelledBy="careers-empty-heading">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
          <h2 className="text-2xl font-bold text-ink" id="careers-empty-heading">
            {t('emptyState.heading')}
          </h2>
          <p className="text-lg leading-relaxed text-ink-soft">{t('emptyState.body')}</p>
        </div>
      </Section>
    </PageTemplate>
  );
}

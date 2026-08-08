import { useTranslations } from 'next-intl';

import { HabitSprout } from '@/components/art/HabitSprout';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section } from '@/components/ui/Section';

/**
 * `/clinicians/clinical-leadership`. No leadership team has been named yet,
 * so this is an honest empty state — same instinct as `EventsView` and
 * `PartnersView` — rather than fabricated names, credentials or headcounts.
 */
export function ClinicalLeadershipView() {
  const t = useTranslations('clinicians.clinicalLeadership');
  const cta = useTranslations('clinicians.cta');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.clinicalLeadership'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: HabitSprout,
    artPosition: 'start' as const,
  };

  const ctaProps = {
    id: 'clinical-leadership-cta-heading',
    heading: cta('heading'),
    body: cta('body'),
    primaryCta: { href: '/contact', label: cta('primaryCta') },
    secondaryCta: { href: '/clinicians/careers', label: cta('secondaryCta') },
  };

  return (
    <PageTemplate cta={ctaProps} hero={hero}>
      <Section labelledBy="clinical-leadership-empty-heading">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
          <h2 className="text-2xl font-bold text-ink" id="clinical-leadership-empty-heading">
            {t('emptyState.heading')}
          </h2>
          <p className="text-lg leading-relaxed text-ink-soft">{t('emptyState.body')}</p>
        </div>
      </Section>
    </PageTemplate>
  );
}

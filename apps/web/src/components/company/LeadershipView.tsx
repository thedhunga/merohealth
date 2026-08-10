import { useTranslations } from 'next-intl';

import { HabitSprout } from '@/components/art/HabitSprout';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section } from '@/components/ui/Section';

/**
 * `/about/leadership`, distinct from `/clinicians/clinical-leadership` — this
 * is the company-wide leadership team, not the clinical one. No roster
 * exists for either yet, so both use the same "team still forming" honest
 * empty state, deliberately reusing `HabitSprout` again for the same
 * metaphor rather than a different composition for what's the same
 * underlying fact.
 */
export function LeadershipView() {
  const t = useTranslations('company.leadership');
  const cta = useTranslations('company.cta');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.leadership'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: HabitSprout,
    artPosition: 'start' as const,
  };

  const ctaProps = {
    id: 'leadership-cta-heading',
    heading: cta('heading'),
    body: cta('body'),
    primaryCta: { href: '/contact', label: cta('primaryCta') },
    secondaryCta: { href: '/careers', label: cta('secondaryCta') },
  };

  return (
    <PageTemplate cta={ctaProps} hero={hero}>
      <Section labelledBy="leadership-empty-heading">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
          <h2 className="text-2xl font-bold text-ink" id="leadership-empty-heading">
            {t('emptyState.heading')}
          </h2>
          <p className="text-lg leading-relaxed text-ink-soft">{t('emptyState.body')}</p>
        </div>
      </Section>
    </PageTemplate>
  );
}

import { useTranslations } from 'next-intl';

import { WorkplaceInvestment } from '@/components/art/WorkplaceInvestment';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section } from '@/components/ui/Section';

/**
 * `/organizations/events`. No events exist yet, so this is an honest empty
 * state — the same "read as a placeholder, not a leftover" instinct behind
 * `organizationTabs`'s em-dash stats — rather than fabricated listings.
 */
export function EventsView() {
  const t = useTranslations('organizations.events');
  const cta = useTranslations('organizations.cta');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.events'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: WorkplaceInvestment,
    artPosition: 'start' as const,
  };

  const ctaProps = {
    id: 'events-cta-heading',
    heading: cta('heading'),
    body: cta('body'),
    primaryCta: { href: '/contact', label: cta('primaryCta') },
    secondaryCta: { href: '/organizations/resource-center', label: cta('secondaryCta') },
  };

  return (
    <PageTemplate cta={ctaProps} hero={hero}>
      <Section labelledBy="events-empty-heading">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
          <h2 className="text-2xl font-bold text-ink" id="events-empty-heading">
            {t('emptyState.heading')}
          </h2>
          <p className="text-lg leading-relaxed text-ink-soft">{t('emptyState.body')}</p>
        </div>
      </Section>
    </PageTemplate>
  );
}

import { useTranslations } from 'next-intl';

import { HospitalReach } from '@/components/art/HospitalReach';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section } from '@/components/ui/Section';

/**
 * `/newsroom`. No press coverage or announcements exist yet, so this is an
 * honest empty state rather than fabricated press mentions. `HospitalReach`'s
 * "signal reaching outward" already stands for capability reaching beyond a
 * single facility; the same signal fits a newsroom's job of reaching outward
 * to press and media.
 */
export function NewsroomView() {
  const t = useTranslations('company.newsroom');
  const cta = useTranslations('company.cta');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.newsroom'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: HospitalReach,
    artPosition: 'start' as const,
  };

  const ctaProps = {
    id: 'newsroom-cta-heading',
    heading: cta('heading'),
    body: cta('body'),
    primaryCta: { href: '/contact', label: cta('primaryCta') },
    secondaryCta: { href: '/careers', label: cta('secondaryCta') },
  };

  return (
    <PageTemplate cta={ctaProps} hero={hero}>
      <Section labelledBy="newsroom-empty-heading">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
          <h2 className="text-2xl font-bold text-ink" id="newsroom-empty-heading">
            {t('emptyState.heading')}
          </h2>
          <p className="text-lg leading-relaxed text-ink-soft">{t('emptyState.body')}</p>
        </div>
      </Section>
    </PageTemplate>
  );
}

import { useTranslations } from 'next-intl';

import { DiagnosticFocus } from '@/components/art/DiagnosticFocus';
import { FaqList } from '@/components/ui/FaqList';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section, SectionHeading } from '@/components/ui/Section';

const FAQ_KEYS = ['one', 'two', 'three', 'four', 'five', 'six'] as const;

/**
 * `/individuals/faqs` — answers grounded in what's already built (Nepali
 * default locale, storage choice, `clinical-safety` interception, the
 * confirm-before-reasoning rule, the entitlements catalogue) rather than
 * roadmap pillars like wearables or provider export that haven't shipped
 * yet. `FaqList` renders both the visible disclosures and the matching
 * `FAQPage` JSON-LD from one `items` array.
 */
export function FaqsView() {
  const t = useTranslations('individuals');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.faqs'),
    title: t('faqs.hero.title'),
    body: t('faqs.hero.body'),
    Art: DiagnosticFocus,
    artPosition: 'end' as const,
  };

  const cta = {
    id: 'faqs-cta-heading',
    heading: t('cta.heading'),
    body: t('cta.body'),
    primaryCta: { href: '/register', label: t('cta.primaryCta') },
    secondaryCta: { external: true, href: '/app', label: t('cta.secondaryCta') },
  };

  return (
    <PageTemplate cta={cta} hero={hero}>
      <Section labelledBy="faqs-heading">
        <SectionHeading align="center" id="faqs-heading" title={t('faqs.heading')} />
        <FaqList
          className="mx-auto mt-12 max-w-3xl"
          items={FAQ_KEYS.map((key) => ({
            key,
            question: t(`faqs.items.${key}.question`),
            answer: t(`faqs.items.${key}.answer`),
          }))}
        />
      </Section>
    </PageTemplate>
  );
}

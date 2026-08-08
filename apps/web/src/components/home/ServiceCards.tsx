import { useTranslations } from 'next-intl';

import { serviceCards } from '@/content/home';
import { Section, SectionHeading } from '@/components/ui/Section';
import { FeatureGrid } from '@/components/ui/FeatureGrid';

export function ServiceCards() {
  const t = useTranslations('home.services');
  const nav = useTranslations('nav.items');

  const items = serviceCards.map(({ key, href, Art, links }) => ({
    key,
    href,
    Art,
    title: t(`items.${key}.title`),
    body: t(`items.${key}.body`),
    links: links?.map((link) => ({ key: link.key, href: link.href, label: nav(link.key) })),
  }));

  return (
    <Section labelledBy="services-heading" tone="surface">
      <SectionHeading
        align="center"
        body={t('body')}
        className="reveal"
        id="services-heading"
        title={t('heading')}
      />

      <FeatureGrid className="reveal-stagger mt-14" items={items} learnMoreLabel={t('learnMore')} />
    </Section>
  );
}

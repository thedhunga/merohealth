import { useTranslations } from 'next-intl';

import { DiagnosticFocus } from '@/components/art/DiagnosticFocus';
import { organizationTabs } from '@/content/home';
import { FeatureGrid } from '@/components/ui/FeatureGrid';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section, SectionHeading } from '@/components/ui/Section';

/**
 * `/organizations/resource-center`. No resource library exists yet — that's
 * the separate, consumer-facing "Health library" queue item — so rather than
 * inventing articles this routes to the three organisation-type pages
 * instead, which are the resources that genuinely exist today.
 */
export function ResourceCenterView() {
  const t = useTranslations('organizations.resourceCenter');
  const homeOrg = useTranslations('home.organizations');
  const cta = useTranslations('organizations.cta');
  const nav = useTranslations('nav');
  const common = useTranslations('common');

  const hero = {
    eyebrow: nav('items.resourceCenter'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: DiagnosticFocus,
    artPosition: 'end' as const,
  };

  const ctaProps = {
    id: 'resource-center-cta-heading',
    heading: cta('heading'),
    body: cta('body'),
    primaryCta: { href: '/contact', label: cta('primaryCta') },
    secondaryCta: { href: '/organizations/our-approach', label: cta('secondaryCta') },
  };

  return (
    <PageTemplate cta={ctaProps} hero={hero}>
      <Section labelledBy="resource-center-grid-heading">
        <SectionHeading align="center" id="resource-center-grid-heading" title={t('gridHeading')} />
        <FeatureGrid
          className="mt-12"
          items={organizationTabs.map((tab) => ({
            key: tab.key,
            href: tab.href,
            Art: tab.Art,
            title: homeOrg(`tabs.${tab.key}.label`),
            body: homeOrg(`tabs.${tab.key}.body`),
          }))}
          learnMoreLabel={common('learnMore')}
        />
      </Section>
    </PageTemplate>
  );
}

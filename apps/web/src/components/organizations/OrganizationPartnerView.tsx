import { useTranslations } from 'next-intl';

import { organizationTabs } from '@/content/home';
import type { OrganizationPartnerPage } from '@/content/organizations';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section, SectionHeading } from '@/components/ui/Section';

/**
 * Renders any of the three partner-type routes (employers, health plans,
 * hospitals) from its `content/organizations.ts` entry — one component
 * instead of three near-identical `page.tsx` bodies, matching the pattern
 * `IndividualsPageView` already established. Hero art/title/body are pulled
 * from `organizationTabs` (content/home.ts); only the anchored capability
 * sections are new content here.
 */
export function OrganizationPartnerView({ page }: { page: OrganizationPartnerPage }) {
  const t = useTranslations('organizations');
  const homeOrg = useTranslations('home.organizations');
  const nav = useTranslations('nav');

  const tab = organizationTabs.find((candidate) => candidate.key === page.key);
  if (!tab) {
    throw new Error(`Unknown organization tab: ${page.key}`);
  }

  const hero = {
    eyebrow: nav('segments.organizations'),
    title: homeOrg(`tabs.${page.key}.title`),
    body: homeOrg(`tabs.${page.key}.body`),
    Art: tab.Art,
    artPosition: page.artPosition,
    cta: { label: t('contactCta'), href: '/contact' },
  };

  const cta = {
    id: `${page.key}-cta-heading`,
    heading: t('cta.heading'),
    body: t('cta.body'),
    primaryCta: { href: '/contact', label: t('cta.primaryCta') },
    secondaryCta: {
      href: '/organizations/resource-center',
      label: t('cta.secondaryCta'),
    },
  };

  return (
    <PageTemplate cta={cta} hero={hero}>
      {page.sections.map((section, index) => (
        <Section
          id={section.anchorId}
          key={section.anchorId}
          labelledBy={`${page.key}-${section.anchorId}-heading`}
          tone={index % 2 === 0 ? 'surface' : 'canvas'}
        >
          <SectionHeading
            align="center"
            body={t(`${page.key}.sections.${section.navKey}.body`)}
            id={`${page.key}-${section.anchorId}-heading`}
            title={nav(`items.${section.navKey}`)}
          />
        </Section>
      ))}
    </PageTemplate>
  );
}

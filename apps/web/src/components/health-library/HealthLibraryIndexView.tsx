import { useTranslations } from 'next-intl';

import { MemberRouting } from '@/components/art/MemberRouting';
import { FeatureGrid } from '@/components/ui/FeatureGrid';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section, SectionHeading } from '@/components/ui/Section';
import { healthLibraryArticles } from '@/content/healthLibrary';

/**
 * `/health-library` — the index the header mega-menu and footer have linked
 * to since the marketing-site routes were first built, previously 404ing.
 * `MemberRouting` for the hero, matching its use as the routing/hub metaphor
 * on `/legal` (the other pure index page in the site).
 */
export function HealthLibraryIndexView() {
  const t = useTranslations('healthLibrary');
  const nav = useTranslations('nav');
  const common = useTranslations('common');

  const hero = {
    eyebrow: nav('items.healthLibrary'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: MemberRouting,
    artPosition: 'end' as const,
  };

  const cta = {
    id: 'health-library-cta-heading',
    heading: t('cta.heading'),
    body: t('cta.body'),
    primaryCta: { href: '/register', label: t('cta.primaryCta') },
    secondaryCta: { href: '/individuals/faqs', label: t('cta.secondaryCta') },
  };

  return (
    <PageTemplate cta={cta} hero={hero}>
      <Section labelledBy="health-library-grid-heading">
        <SectionHeading
          align="center"
          id="health-library-grid-heading"
          title={t('gridHeading')}
        />
        <FeatureGrid
          className="mt-12"
          items={healthLibraryArticles.map((article) => ({
            key: article.key,
            href: `/health-library/${article.slug}`,
            Art: article.Art,
            title: t(`articles.${article.key}.title`),
            body: t(`articles.${article.key}.summary`),
          }))}
          learnMoreLabel={common('readMore')}
        />
      </Section>
    </PageTemplate>
  );
}

import { useTranslations } from 'next-intl';

import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section, SectionHeading } from '@/components/ui/Section';
import { FeatureGrid } from '@/components/ui/FeatureGrid';
import { Highlights } from '@/components/ui/Highlights';
import type { IndividualsPage } from '@/content/individuals';
import { hasAsset } from '@/lib/assets';

/**
 * Renders any Individuals route from its `content/individuals.ts` entry —
 * one component instead of near-identical JSX repeated across twelve
 * `page.tsx` files. Condition pages (no children) get a `Highlights` list;
 * segment pages (`weightManagement`, `specialtyWellness`) get a `FeatureGrid`
 * routing to their own sub-pages instead, since they have no content of
 * their own beyond "here is what this covers."
 */
export function IndividualsPageView({ page }: { page: IndividualsPage }) {
  const t = useTranslations('individuals');
  const nav = useTranslations('nav');
  const common = useTranslations('common');

  const heroBase = {
    eyebrow: nav('segments.individuals'),
    title: t(`${page.key}.hero.title`),
    body: t(`${page.key}.hero.body`),
    Art: page.Art,
    artPosition: page.artPosition,
    // Photography lands one file at a time; `SectionIntro` renders whatever
    // it's handed with no existence check of its own (it's shared with
    // client components, so it can't import the filesystem-backed
    // `hasAsset`), so this server component resolves presence and falls back
    // to the branded `Art` by omitting `image` entirely when the file isn't
    // there yet — the same "never a broken image" contract `EditorialImage`
    // gives `Testimonials`.
    ...(page.image && hasAsset(page.image.src)
      ? {
          image: {
            ...page.image,
            alt: t(`${page.key}.hero.imageAlt`),
          },
        }
      : {}),
  };

  // Segment pages route on to their children rather than offering care
  // directly, so they get no "get care now" action of their own.
  const hero =
    page.kind === 'condition'
      ? { ...heroBase, cta: { label: nav('items.getCareNow'), href: '/get-care' } }
      : heroBase;

  const cta = {
    id: `${page.key}-cta-heading`,
    heading: t('cta.heading'),
    body: t('cta.body'),
    primaryCta: { href: '/register', label: t('cta.primaryCta') },
    secondaryCta: { external: true, href: '/app', label: t('cta.secondaryCta') },
  };

  return (
    <PageTemplate cta={cta} hero={hero}>
      {page.kind === 'condition' ? (
        <Section labelledBy={`${page.key}-highlights-heading`}>
          <SectionHeading
            align="center"
            id={`${page.key}-highlights-heading`}
            title={t('sectionHeadings.highlights')}
          />
          <Highlights
            className="mt-12"
            items={page.highlightKeys.map((key) => ({
              key,
              title: t(`${page.key}.highlights.items.${key}.title`),
              body: t(`${page.key}.highlights.items.${key}.body`),
            }))}
          />
        </Section>
      ) : (
        <Section labelledBy={`${page.key}-children-heading`}>
          <SectionHeading
            align="center"
            id={`${page.key}-children-heading`}
            title={t('sectionHeadings.children')}
          />
          <FeatureGrid
            className="mt-12"
            items={page.children.map((child) => ({
              key: child.key,
              href: child.href,
              Art: child.Art,
              title: nav(`items.${child.key}`),
              body: t(`${page.key}.children.${child.key}.body`),
            }))}
            learnMoreLabel={common('learnMore')}
          />
        </Section>
      )}
    </PageTemplate>
  );
}

import { useTranslations } from 'next-intl';

import { HomeFirstVisit } from '@/components/art/HomeFirstVisit';
import { Highlights } from '@/components/ui/Highlights';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section, SectionHeading } from '@/components/ui/Section';
import { hasAsset } from '@/lib/assets';

const HIGHLIGHT_KEYS = ['one', 'two', 'three'] as const;
const HERO_IMAGE_SRC = '/imagery/clinicians.webp';

/**
 * `/clinicians/our-providers`. No provider roster exists to list, so this
 * describes the kind of clinician reachable through the platform — the same
 * facts `home.services` already establishes (board-certified, licensed
 * therapists and psychiatrists) — rather than a directory of named people
 * that doesn't exist yet.
 */
export function OurProvidersView() {
  const t = useTranslations('clinicians.ourProviders');
  const cta = useTranslations('clinicians.cta');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.ourProviders'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: HomeFirstVisit,
    // `SectionIntro` can't check the filesystem itself (it's shared with
    // client components), so this server component resolves presence and
    // falls back to `Art` alone by omitting `image` when the file is missing.
    ...(hasAsset(HERO_IMAGE_SRC)
      ? { image: { src: HERO_IMAGE_SRC, alt: t('hero.imageAlt') } }
      : {}),
    artPosition: 'end' as const,
  };

  const ctaProps = {
    id: 'our-providers-cta-heading',
    heading: cta('heading'),
    body: cta('body'),
    primaryCta: { href: '/contact', label: cta('primaryCta') },
    secondaryCta: { href: '/clinicians/careers', label: cta('secondaryCta') },
  };

  return (
    <PageTemplate cta={ctaProps} hero={hero}>
      <Section labelledBy="our-providers-highlights-heading">
        <SectionHeading
          align="center"
          id="our-providers-highlights-heading"
          title={t('highlightsHeading')}
        />
        <Highlights
          className="mt-12"
          items={HIGHLIGHT_KEYS.map((key) => ({
            key,
            title: t(`highlights.items.${key}.title`),
            body: t(`highlights.items.${key}.body`),
          }))}
        />
      </Section>
    </PageTemplate>
  );
}

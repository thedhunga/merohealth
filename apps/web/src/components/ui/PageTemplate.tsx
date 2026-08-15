import type { ComponentType, ReactNode } from 'react';

import { CtaBand } from '@/components/ui/CtaBand';
import { SectionIntro, type SectionIntroTone } from '@/components/ui/SectionIntro';

interface PageTemplateHero {
  eyebrow?: string;
  title: string;
  body?: string;
  Art: ComponentType<{ className?: string }>;
  image?: { src: string; alt: string; objectPosition?: string };
  artCaption?: string;
  cta?: { label: string; href: string };
  tone?: SectionIntroTone;
  artPosition?: 'start' | 'end';
}

interface PageTemplateCtaLink {
  label: string;
  href: string;
  external?: boolean;
}

interface PageTemplateCta {
  id: string;
  heading: string;
  body?: string;
  primaryCta: PageTemplateCtaLink;
  secondaryCta?: PageTemplateCtaLink & { icon?: ReactNode };
}

interface PageTemplateProps {
  hero: PageTemplateHero;
  /**
   * The page's own body sections — a `FeatureGrid` inside a `Section`, prose,
   * a comparison table, whatever the content calls for. Deliberately not
   * typed as a fixed shape: a condition page (single topic, few sections) and
   * a segment index (routes out to many sub-pages) need different bodies, and
   * guessing one generic "section" shape for both before real content exists
   * would just be a layout to work around later.
   */
  children: ReactNode;
  /** Omit for pages — legal, utility — that shouldn't end on a CTA band. */
  cta?: PageTemplateCta;
}

/**
 * The hero → content → CTA shell shared by condition pages
 * (`/individuals/diabetes-management`) and segment index pages
 * (`/individuals`, `/organizations`, `/clinicians`) alike, so the ~35
 * remaining marketing routes are content composed onto this shell rather
 * than bespoke layout each. `SectionIntro` is the hero and defaults to the
 * light `paper` tone; `CtaBand` is the close and stays a deliberate indigo
 * accent — one saturated band per page, not a second full-bleed dark hero.
 */
export function PageTemplate({ hero, children, cta }: PageTemplateProps) {
  return (
    <>
      <SectionIntro {...hero} />
      {children}
      {cta ? <CtaBand {...cta} /> : null}
    </>
  );
}

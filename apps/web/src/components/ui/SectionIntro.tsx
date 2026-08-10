import type { ComponentType } from 'react';

import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export type SectionIntroTone = 'forest' | 'paper';

interface SectionIntroCta {
  label: string;
  href: string;
}

interface SectionIntroProps {
  eyebrow?: string;
  title: string;
  body?: string;
  /**
   * Editorial SVG composition, required rather than optional: the point of
   * this component is that an inner page opens with a visual instead of a
   * wall of text, and an optional prop would let that slip.
   */
  Art: ComponentType<{ className?: string }>;
  artCaption?: string;
  cta?: SectionIntroCta;
  /**
   * `forest` continues the layered depth already established by the header
   * and homepage Hero (dark chrome into a dark opener, then a curved lip
   * down to paper). `paper` skips that for pages — legal, utility — where
   * stacking another full-bleed dark block under the permanently dark header
   * would read as too heavy.
   */
  tone?: SectionIntroTone;
  /** Which side the artwork sits on at desktop widths. */
  artPosition?: 'start' | 'end';
  className?: string;
}

const toneStyles: Record<
  SectionIntroTone,
  { section: string; eyebrow: string; title: string; body: string; caption: string }
> = {
  forest: {
    section: 'bg-indigo-800 text-white',
    eyebrow: 'text-indigo-200',
    title: 'text-white',
    body: 'text-indigo-100',
    caption: 'text-indigo-200',
  },
  paper: {
    section: 'bg-paper text-ink',
    eyebrow: 'text-success-600',
    title: 'text-ink',
    body: 'text-ink-soft',
    caption: 'text-ink-soft',
  },
};

/**
 * The opening section for an inner page: a title and a short body next to an
 * editorial illustration, the same shape as the homepage `Hero` but generic
 * enough for any route. Every inner page should reach for this instead of a
 * bare heading, per the art direction's "show, don't tell."
 */
export function SectionIntro({
  eyebrow,
  title,
  body,
  Art,
  artCaption,
  cta,
  tone = 'forest',
  artPosition = 'end',
  className,
}: SectionIntroProps) {
  const styles = toneStyles[tone];

  return (
    <section className={cn('relative overflow-hidden', styles.section, className)}>
      <div
        className={cn(
          'container-site relative grid items-center gap-12 py-16 md:py-24 lg:gap-16',
          artPosition === 'end' ? 'lg:grid-cols-[1.05fr_1fr]' : 'lg:grid-cols-[1fr_1.05fr]',
        )}
      >
        <div className="flex flex-col items-start gap-6">
          {eyebrow ? (
            <span className={cn('text-sm font-semibold tracking-wide uppercase', styles.eyebrow)}>
              {eyebrow}
            </span>
          ) : null}

          {/*
            No leading-* utility here on purpose. The base layer sets 1.12 for
            Latin and 1.34 for :lang(ne); a utility class would win over both
            and clip Devanagari matras at display sizes.
          */}
          <h1 className={cn('text-4xl text-balance sm:text-5xl lg:text-[3.5rem]', styles.title)}>
            {title}
          </h1>

          {body ? (
            <p className={cn('max-w-lg text-lg leading-relaxed', styles.body)}>{body}</p>
          ) : null}

          {cta ? (
            <ButtonLink
              className="mt-1"
              href={cta.href}
              size="lg"
              variant={tone === 'forest' ? 'accent' : 'primary'}
            >
              {cta.label}
            </ButtonLink>
          ) : null}
        </div>

        <div className={cn('relative', artPosition === 'start' && 'lg:order-first')}>
          <Art className="w-full drop-shadow-2xl" />
          {artCaption ? (
            <p className={cn('mt-5 max-w-sm text-sm leading-relaxed', styles.caption)}>
              {artCaption}
            </p>
          ) : null}
        </div>
      </div>

      {tone === 'forest' ? (
        // Curved lip into the next section, matching the homepage Hero so the
        // ground still ends deliberately rather than cutting off flat.
        <div
          aria-hidden
          className="h-10 rounded-t-[2.5rem] bg-paper md:h-14 md:rounded-t-[4rem]"
        />
      ) : null}
    </section>
  );
}

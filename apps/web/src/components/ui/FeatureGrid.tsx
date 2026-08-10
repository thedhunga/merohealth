import type { ComponentType } from 'react';
import { ArrowRight } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

export interface FeatureGridItem {
  /** React key; also disambiguates the nested link keys below. */
  key: string;
  href: string;
  /** Editorial SVG composition for the card, aria-hidden. */
  Art: ComponentType<{ className?: string }>;
  title: string;
  body: string;
  /** Optional related links, rendered above the stretched card link. */
  links?: Array<{ key: string; href: string; label: string }> | undefined;
}

interface FeatureGridProps {
  items: readonly FeatureGridItem[];
  /** Trailing "learn more" label, shared across every card. */
  learnMoreLabel: string;
  className?: string;
}

/**
 * The card-grid section body used across condition and segment pages —
 * extracted from the homepage `ServiceCards` so it isn't the only place this
 * layout exists. Every string arrives pre-resolved through props; the
 * component itself has no i18n namespace of its own.
 */
export function FeatureGrid({ items, learnMoreLabel, className }: FeatureGridProps) {
  return (
    <ul className={cn('grid gap-6 md:grid-cols-2 lg:grid-cols-3', className)}>
      {items.map(({ key, href, Art, title, body, links }) => (
        <li key={key}>
          <article className="group relative flex h-full flex-col gap-4 rounded-card border border-line bg-white p-7 transition-all duration-200 hover:-translate-y-1 hover:border-jade-200 hover:shadow-card">
            <Art className="aspect-[3/2] w-full rounded-2xl" />

            <h3 className="text-xl font-bold text-ink">
              {/*
                The whole card is clickable via this stretched link, which
                keeps a single tab stop and a real link target for the title.
              */}
              <Link className="after:absolute after:inset-0 after:content-['']" href={href}>
                {title}
              </Link>
            </h3>

            <p className="flex-1 leading-relaxed text-ink-soft">{body}</p>

            {links ? (
              // Nested links sit above the stretched overlay so they stay
              // independently clickable.
              <ul className="relative z-10 flex flex-wrap gap-2 pt-1">
                {links.map((link) => (
                  <li key={`${key}-${link.key}`}>
                    <Link
                      className="inline-block rounded-pill bg-sand px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-jade-100 hover:text-forest-700"
                      href={link.href}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-600">
              {learnMoreLabel}
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform group-hover:translate-x-1"
              />
            </span>
          </article>
        </li>
      ))}
    </ul>
  );
}

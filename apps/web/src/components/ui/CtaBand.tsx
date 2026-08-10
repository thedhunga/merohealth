import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

import { ButtonLink } from '@/components/ui/Button';
import { PulseLine } from '@/components/ui/PulseLine';
import { cn } from '@/lib/cn';

interface CtaBandLink {
  label: string;
  href: string;
  external?: boolean;
}

interface CtaBandSecondaryLink extends CtaBandLink {
  /** e.g. a lucide icon element, rendered before the label. */
  icon?: ReactNode;
}

interface CtaBandProps {
  /** Used as both the section's `aria-labelledby` and the heading's `id`. */
  id: string;
  heading: string;
  body?: string;
  primaryCta: CtaBandLink;
  secondaryCta?: CtaBandSecondaryLink;
  className?: string;
}

/**
 * The closing call-to-action band every inner page can end on — extracted
 * from the homepage `FinalCta` so condition and segment pages get the same
 * treatment without re-implementing it. All copy and links are props; this
 * component holds no i18n keys of its own.
 */
export function CtaBand({ id, heading, body, primaryCta, secondaryCta, className }: CtaBandProps) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'relative overflow-hidden bg-linear-to-br from-indigo-700 to-indigo-900 py-20 md:py-28',
        className,
      )}
    >
      <PulseLine className="absolute inset-x-0 top-10 h-24 text-white/15" />
      <PulseLine className="absolute inset-x-0 bottom-10 h-24 text-white/10" />

      <div className="container-site reveal relative flex flex-col items-center gap-6 text-center">
        <h2 className="max-w-3xl text-3xl font-bold text-balance text-white md:text-5xl" id={id}>
          {heading}
        </h2>
        {body ? <p className="max-w-2xl text-lg text-indigo-100">{body}</p> : null}

        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <ButtonLink
            external={primaryCta.external ?? false}
            href={primaryCta.href}
            size="lg"
            variant="inverse"
          >
            {primaryCta.label}
            <ArrowRight aria-hidden className="size-4.5" />
          </ButtonLink>
          {secondaryCta ? (
            <ButtonLink
              className="border border-white/30 bg-transparent text-white hover:bg-white/10"
              external={secondaryCta.external ?? false}
              href={secondaryCta.href}
              size="lg"
              variant="ghost"
            >
              {secondaryCta.icon}
              {secondaryCta.label}
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </section>
  );
}

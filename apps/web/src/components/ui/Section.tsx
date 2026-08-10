import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

type Tone = 'surface' | 'canvas' | 'mint' | 'deep';

const tones: Record<Tone, string> = {
  surface: 'bg-paper text-ink',
  canvas: 'bg-sand text-ink',
  mint: 'bg-jade-50 text-ink',
  deep: 'bg-forest-800 text-white',
};

interface SectionProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  id?: string;
  /** Renders as <section aria-labelledby> when the heading has an id. */
  labelledBy?: string;
}

export function Section({ children, tone = 'surface', className, id, labelledBy }: SectionProps) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn('py-16 md:py-24', tones[tone], className)}
      id={id}
    >
      <div className="container-site">{children}</div>
    </section>
  );
}

interface SectionHeadingProps {
  id?: string;
  eyebrow?: string;
  title: string;
  body?: string;
  align?: 'left' | 'center';
  tone?: 'dark' | 'light';
  className?: string;
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  body,
  align = 'left',
  tone = 'dark',
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        align === 'center' && 'items-center text-center',
        align === 'center' ? 'max-w-3xl mx-auto' : 'max-w-2xl',
        className,
      )}
    >
      {eyebrow ? (
        <span
          className={cn(
            'text-sm font-semibold tracking-wide uppercase',
            tone === 'dark' ? 'text-jade-500' : 'text-jade-200',
          )}
        >
          {eyebrow}
        </span>
      ) : null}
      <h2
        className={cn(
          'text-3xl font-bold text-balance md:text-4xl lg:text-[2.75rem]',
          tone === 'dark' ? 'text-ink' : 'text-white',
        )}
        id={id}
      >
        {title}
      </h2>
      {body ? (
        <p className={cn('text-lg', tone === 'dark' ? 'text-ink-soft' : 'text-jade-100')}>{body}</p>
      ) : null}
    </div>
  );
}

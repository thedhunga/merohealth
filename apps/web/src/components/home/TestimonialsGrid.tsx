'use client';

import { type ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/cn';

const COLLAPSED_COUNT = 2;

interface TestimonialsGridProps {
  /** Pre-rendered `<li>` cards from the server — `EditorialImage` needs `node:fs`, so
   * the card markup must stay server-side; only the expand/collapse is interactive. */
  cards: ReactNode[];
  showMoreLabel: string;
  showFewerLabel: string;
}

/** Only the first two cards render on load; the rest expand in place, no navigation. */
export function TestimonialsGrid({ cards, showMoreLabel, showFewerLabel }: TestimonialsGridProps) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = cards.length - COLLAPSED_COUNT;
  const visible = expanded ? cards : cards.slice(0, COLLAPSED_COUNT);

  return (
    <>
      <ul className="reveal-stagger mt-6 grid gap-3 sm:mt-10 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visible}
      </ul>

      {hiddenCount > 0 ? (
        <button
          aria-expanded={expanded}
          className="mx-auto mt-6 flex min-h-11 items-center gap-2 rounded-pill border border-white/20 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:mt-8"
          onClick={() => {
            setExpanded((value) => !value);
          }}
          type="button"
        >
          {expanded ? showFewerLabel : showMoreLabel}
          <ChevronDown
            aria-hidden
            className={cn('size-4 transition-transform', expanded && 'rotate-180')}
          />
        </button>
      ) : null}
    </>
  );
}

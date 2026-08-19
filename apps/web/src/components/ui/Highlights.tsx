import { cn } from '@/lib/cn';

export interface HighlightItem {
  key: string;
  title: string;
  body: string;
}

interface HighlightsProps {
  items: readonly HighlightItem[];
  className?: string;
}

/**
 * A plain-text three-up list for condition pages — no icon, no illustration.
 * `FeatureGrid` needs an `Art` per card, which doesn't scale to every short
 * point on every condition page without diluting the "distinct composition"
 * illustration convention; a numbered text block covers this case instead.
 */
export function Highlights({ items, className }: HighlightsProps) {
  return (
    <ul className={cn('grid grid-cols-1 gap-10 sm:grid-cols-3', className)}>
      {items.map((item, index) => (
        <li className="flex flex-col gap-3" key={item.key}>
          <span aria-hidden className="font-display-black text-3xl text-accent-text">
            {String(index + 1).padStart(2, '0')}
          </span>
          <h3 className="text-lg font-bold text-ink">{item.title}</h3>
          <p className="leading-relaxed text-ink-soft">{item.body}</p>
        </li>
      ))}
    </ul>
  );
}

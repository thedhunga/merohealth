import { cn } from '@/lib/cn';

export interface FaqItem {
  key: string;
  question: string;
  answer: string;
}

interface FaqListProps {
  items: readonly FaqItem[];
  className?: string;
}

/**
 * An accessible FAQ list — native `<details>`/`<summary>` disclosures, no JS
 * needed to expand one — paired with a `FAQPage` JSON-LD block built from the
 * same `items`. One array backs both the visible copy and the structured
 * data, so there's no second place a question/answer pair can drift out of
 * sync.
 */
export function FaqList({ items, className }: FaqListProps) {
  return (
    <>
      <div className={cn('flex flex-col gap-4', className)}>
        {items.map((item) => (
          <details
            className="group rounded-card border border-line bg-surface p-6 open:border-indigo-200"
            key={item.key}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold text-ink [&::-webkit-details-marker]:hidden">
              {item.question}
              <span
                aria-hidden
                className="inline-block shrink-0 text-2xl font-black text-accent-text transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-4 leading-relaxed text-ink-soft">{item.answer}</p>
          </details>
        ))}
      </div>
      {/*
        Static JSON built from the same `items` this component already
        rendered above — not user input, so a script tag is the standard,
        safe way Next.js documents embedding JSON-LD.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: items.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: { '@type': 'Answer', text: item.answer },
            })),
          }),
        }}
        type="application/ld+json"
      />
    </>
  );
}

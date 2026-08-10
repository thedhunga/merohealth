import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { AroundTheClockCare } from '@/components/art/AroundTheClockCare';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section, SectionHeading } from '@/components/ui/Section';
import { Link } from '@/i18n/navigation';

const ROUTE_KEYS = ['faqs', 'howItWorks', 'contact'] as const;

const ROUTE_HREFS: Record<(typeof ROUTE_KEYS)[number], string> = {
  faqs: '/individuals/faqs',
  howItWorks: '/individuals/how-it-works',
  contact: '/contact',
};

/**
 * `/help` — no separate help-desk content exists, so this routes to the
 * pages that actually answer a support question (`/individuals/faqs`,
 * `/individuals/how-it-works`, `/contact`) rather than duplicating their
 * content a third time, the same instinct as `ContactView`/
 * `ResourceCenterView`. `AroundTheClockCare` gets its first dedicated use
 * outside the homepage here — "available any time" is a genuine fit for a
 * help center's job, not a reach.
 */
export function HelpView() {
  const t = useTranslations('legal.help');
  const common = useTranslations('common');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.helpCenter'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: AroundTheClockCare,
    artPosition: 'end' as const,
    tone: 'paper' as const,
  };

  return (
    <PageTemplate hero={hero}>
      <Section labelledBy="help-routes-heading">
        <SectionHeading align="center" id="help-routes-heading" title={t('routesHeading')} />
        <ul className="mt-12 grid gap-6 sm:grid-cols-3">
          {ROUTE_KEYS.map((key) => (
            <li key={key}>
              <article className="group relative flex h-full flex-col gap-3 rounded-card border border-line bg-white p-7 transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-card">
                <h3 className="text-lg font-bold text-ink">
                  <Link
                    className="after:absolute after:inset-0 after:content-['']"
                    href={ROUTE_HREFS[key]}
                  >
                    {t(`routes.items.${key}.title`)}
                  </Link>
                </h3>
                <p className="flex-1 leading-relaxed text-ink-soft">
                  {t(`routes.items.${key}.body`)}
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700">
                  {common('learnMore')}
                  <ArrowRight
                    aria-hidden
                    className="size-4 transition-transform group-hover:translate-x-1"
                  />
                </span>
              </article>
            </li>
          ))}
        </ul>
      </Section>
    </PageTemplate>
  );
}

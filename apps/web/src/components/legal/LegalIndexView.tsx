import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { MemberRouting } from '@/components/art/MemberRouting';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section, SectionHeading } from '@/components/ui/Section';
import { Link } from '@/i18n/navigation';

const ROUTE_KEYS = ['privacy', 'dataConsent', 'communityGuidelines', 'accessibility'] as const;

const ROUTE_HREFS: Record<(typeof ROUTE_KEYS)[number], string> = {
  privacy: '/legal/privacy',
  dataConsent: '/legal/data-consent',
  communityGuidelines: '/legal/community-guidelines',
  accessibility: '/accessibility',
};

/**
 * `/legal` — the hub for `/legal/privacy`, `/legal/data-consent` and
 * `/legal/community-guidelines`, plus `/accessibility` (a sibling route, not
 * nested under `/legal`, but grouped here since the footer's `helpfulLinks`
 * column treats all four as one "legal & compliance" bucket). `tone: 'paper'`
 * per an earlier run's note — the first section to actually use it, since
 * stacking another full-bleed dark block under the permanently dark header
 * reads as too heavy for a legal/utility page. No closing `CtaBand`,
 * matching `PageTemplate`'s own guidance to omit one on pages like this.
 *
 * The hero states plainly that Mero Health has no registered legal entity
 * yet (`packages/configuration`'s `legalEntity.displayName`) rather than
 * implying these are signed legal documents — the highest-risk copy in this
 * task, per an earlier run's note.
 */
export function LegalIndexView() {
  const t = useTranslations('legal.index');
  const common = useTranslations('common');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.legal'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: MemberRouting,
    artPosition: 'end' as const,
    tone: 'paper' as const,
  };

  return (
    <PageTemplate hero={hero}>
      <Section labelledBy="legal-routes-heading">
        <SectionHeading align="center" id="legal-routes-heading" title={t('routesHeading')} />
        <ul className="mt-12 grid gap-6 sm:grid-cols-3">
          {ROUTE_KEYS.map((key) => (
            <li key={key}>
              <article className="group relative flex h-full flex-col gap-3 rounded-card border border-line bg-white p-7 transition-all duration-200 hover:-translate-y-1 hover:border-jade-200 hover:shadow-card">
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
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-600">
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

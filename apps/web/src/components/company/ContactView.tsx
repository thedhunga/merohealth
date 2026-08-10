import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { MemberRouting } from '@/components/art/MemberRouting';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section, SectionHeading } from '@/components/ui/Section';
import { Link } from '@/i18n/navigation';

const ROUTE_KEYS = ['careers', 'partnerships', 'press'] as const;

const ROUTE_HREFS: Record<(typeof ROUTE_KEYS)[number], string> = {
  careers: '/careers',
  partnerships: '/organizations/our-approach',
  press: '/newsroom',
};

/**
 * `/contact` — referenced by nearly every CTA band on the site, so this is
 * the highest-traffic dead link the Company routes task closes. No live
 * contact channel is configured in this demonstration build (see
 * `footer.demoNotice` and `packages/configuration`'s placeholder support
 * email) — inventing an email or phone number here would violate "invent no
 * facts." Instead of a form with nowhere to submit, this routes each likely
 * reason for landing here to the existing page that actually answers it.
 * No closing `CtaBand`: this page IS "talk to our team," so a band pointing
 * back at `/contact` from `/contact` would be circular.
 */
export function ContactView() {
  const t = useTranslations('company.contact');
  const common = useTranslations('common');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.contactUs'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: MemberRouting,
    artPosition: 'end' as const,
  };

  return (
    <PageTemplate hero={hero}>
      <Section labelledBy="contact-routes-heading">
        <SectionHeading align="center" id="contact-routes-heading" title={t('routesHeading')} />
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

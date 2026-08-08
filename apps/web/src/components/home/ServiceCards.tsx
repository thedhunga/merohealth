import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';

import { serviceCards } from '@/content/home';
import { Link } from '@/i18n/navigation';
import { Section, SectionHeading } from '@/components/ui/Section';

export function ServiceCards() {
  const t = useTranslations('home.services');
  const nav = useTranslations('nav.items');

  return (
    <Section labelledBy="services-heading" tone="surface">
      <SectionHeading
        align="center"
        body={t('body')}
        className="reveal"
        id="services-heading"
        title={t('heading')}
      />

      <ul className="reveal-stagger mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {serviceCards.map(({ key, href, Art, links }) => (
          <li key={key}>
            <article className="group relative flex h-full flex-col gap-4 rounded-card border border-line bg-white p-7 transition-all duration-200 hover:-translate-y-1 hover:border-jade-200 hover:shadow-card">
              <Art className="aspect-[3/2] w-full rounded-2xl" />

              <h3 className="text-xl font-bold text-ink">
                {/*
                  The whole card is clickable via this stretched link, which
                  keeps a single tab stop and a real link target for the title.
                */}
                <Link className="after:absolute after:inset-0 after:content-['']" href={href}>
                  {t(`items.${key}.title`)}
                </Link>
              </h3>

              <p className="flex-1 leading-relaxed text-ink-soft">{t(`items.${key}.body`)}</p>

              {links ? (
                // Nested links sit above the stretched overlay so they stay
                // independently clickable.
                <ul className="relative z-10 flex flex-wrap gap-2 pt-1">
                  {links.map((link) => (
                    <li key={`${link.key}-${link.href}`}>
                      <Link
                        className="inline-block rounded-pill bg-sand px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-jade-100 hover:text-forest-700"
                        href={link.href}
                      >
                        {nav(link.key)}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}

              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-600">
                {t('learnMore')}
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
  );
}

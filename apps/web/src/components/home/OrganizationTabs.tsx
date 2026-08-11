'use client';

import { useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';

import { organizationTabs } from '@/content/home';
import { Link } from '@/i18n/navigation';
import { SectionHeading } from '@/components/ui/Section';
import { cn } from '@/lib/cn';

export function OrganizationTabs() {
  const t = useTranslations('home.organizations');
  const locale = useLocale();
  const baseId = useId();
  const [active, setActive] = useState(organizationTabs[0]?.key ?? '');

  const current = organizationTabs.find((tab) => tab.key === active) ?? organizationTabs[0];
  if (!current) return null;

  return (
    <section aria-labelledby="orgs-heading" className="bg-indigo-800 py-16 text-white md:py-24">
      <div className="container-site">
        <SectionHeading
          body={t('body')}
          className="reveal"
          id="orgs-heading"
          title={t('heading')}
          tone="light"
        />

        <div
          aria-label={t('tabsLabel')}
          className="mt-10 flex flex-wrap gap-2"
          role="tablist"
        >
          {organizationTabs.map((tab) => {
            const selected = tab.key === active;
            return (
              <button
                aria-controls={`${baseId}-panel-${tab.key}`}
                aria-selected={selected}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-pill px-5 text-[0.9375rem] font-semibold transition-colors',
                  selected
                    ? 'bg-white text-indigo-800'
                    : 'bg-white/10 text-white ring-1 ring-inset ring-white/25 hover:bg-white/20',
                )}
                id={`${baseId}-tab-${tab.key}`}
                key={tab.key}
                onClick={() => {
                  setActive(tab.key);
                }}
                role="tab"
                type="button"
              >
                {t(`tabs.${tab.key}.label`)}
              </button>
            );
          })}
        </div>

        <div
          aria-labelledby={`${baseId}-tab-${current.key}`}
          className="mt-8 grid gap-10 rounded-card bg-white p-8 text-ink shadow-menu md:p-10 lg:grid-cols-2 lg:items-center lg:gap-14"
          id={`${baseId}-panel-${current.key}`}
          role="tabpanel"
          tabIndex={0}
        >
          <div className="flex flex-col gap-6">
            <h3 className="text-2xl font-bold text-balance text-ink md:text-3xl">
              {t(`tabs.${current.key}.title`)}
            </h3>
            <p className="text-lg leading-relaxed text-ink-soft">{t(`tabs.${current.key}.body`)}</p>

            {/*
              The figures are em-dashes until substantiated (see the field
              comment on `OrganizationTab.stats`), so each slot is built to
              look deliberate as a badge-and-label pairing rather than a bare
              number, instead of leaning on a large digit to carry the design.
            */}
            <dl className="grid gap-4 sm:grid-cols-2">
              {current.stats.map((stat) => (
                <div
                  className="flex items-center gap-3 rounded-2xl bg-sand/70 p-4 ring-1 ring-line"
                  key={stat.labelEn}
                >
                  <dt className="grid size-11 shrink-0 place-items-center rounded-full bg-indigo-50 text-lg font-bold text-indigo-700">
                    {stat.value}
                  </dt>
                  <dd className="text-sm leading-snug text-ink-soft">
                    {locale === 'ne' ? stat.labelNe : stat.labelEn}
                  </dd>
                </div>
              ))}
            </dl>

            <Link
              className="group inline-flex items-center gap-2 font-semibold text-indigo-800"
              href={current.href}
            >
              {t('learnMore')}
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>

          <current.Art className="aspect-[3/2] w-full rounded-card" />
        </div>
      </div>
    </section>
  );
}

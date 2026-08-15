'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUpRight, Building2, HeartHandshake, Network } from 'lucide-react';

import { organizationTabs } from '@/content/home';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

const TAB_ICONS = [HeartHandshake, Building2, Network] as const;

export function OrganizationTabs() {
  const t = useTranslations('home.organizations');
  const baseId = useId();
  const [active, setActive] = useState(organizationTabs[0]?.key ?? '');
  const current = organizationTabs.find((tab) => tab.key === active) ?? organizationTabs[0];

  if (!current) return null;

  return (
    <section aria-labelledby="orgs-heading" className="bg-sand py-20 md:py-28">
      <div className="container-site">
        <div className="grid gap-6 lg:grid-cols-[1fr_.75fr] lg:items-end">
          <h2 className="max-w-[17ch] text-4xl text-balance sm:text-5xl" id="orgs-heading">
            {t('heading')}
          </h2>
          <p className="max-w-xl text-lg leading-relaxed text-ink-soft lg:justify-self-end">
            {t('body')}
          </p>
        </div>

        <div aria-label={t('tabsLabel')} className="mt-10 grid gap-3 md:grid-cols-3" role="tablist">
          {organizationTabs.map((tab, index) => {
            const selected = tab.key === active;
            const Icon = TAB_ICONS[index] ?? Building2;

            return (
              <button
                aria-controls={`${baseId}-panel-${tab.key}`}
                aria-selected={selected}
                className={cn(
                  'flex min-h-16 items-center gap-3 rounded-2xl px-5 text-left font-semibold transition-all',
                  selected
                    ? 'bg-indigo-800 text-white shadow-card'
                    : 'border border-line bg-white text-ink hover:border-indigo-200 hover:bg-indigo-50',
                )}
                id={`${baseId}-tab-${tab.key}`}
                key={tab.key}
                onClick={() => {
                  setActive(tab.key);
                }}
                role="tab"
                type="button"
              >
                <Icon
                  aria-hidden
                  className={cn(
                    'size-5 shrink-0',
                    selected ? 'text-marigold-300' : 'text-indigo-600',
                  )}
                />
                {t(`tabs.${tab.key}.label`)}
              </button>
            );
          })}
        </div>

        <div
          aria-labelledby={`${baseId}-tab-${current.key}`}
          className="mt-4 grid overflow-hidden rounded-[2rem] bg-indigo-950 text-white shadow-menu lg:grid-cols-[.9fr_1.1fr] lg:items-stretch"
          id={`${baseId}-panel-${current.key}`}
          role="tabpanel"
          tabIndex={0}
        >
          <div className="flex flex-col items-start justify-center p-8 sm:p-12 lg:p-14">
            <span className="text-sm font-semibold tracking-[.14em] text-marigold-300 uppercase">
              {t(`tabs.${current.key}.label`)}
            </span>
            <h3 className="mt-4 max-w-[16ch] text-3xl text-balance text-white sm:text-4xl">
              {t(`tabs.${current.key}.title`)}
            </h3>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-indigo-100">
              {t(`tabs.${current.key}.body`)}
            </p>
            <Link
              className="group mt-8 inline-flex min-h-12 items-center gap-2 rounded-pill bg-white px-5 font-semibold text-indigo-800 transition-colors hover:bg-indigo-50"
              href={current.href}
            >
              {t('learnMore')}
              <ArrowUpRight
                aria-hidden
                className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          </div>
          <div className="flex min-h-80 items-center bg-indigo-50 p-6 sm:p-10 lg:min-h-[31rem]">
            <current.Art className="aspect-[3/2] w-full rounded-[1.5rem]" />
          </div>
        </div>
      </div>
    </section>
  );
}

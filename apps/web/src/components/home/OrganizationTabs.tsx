'use client';

import Image from 'next/image';
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
    <section aria-labelledby="orgs-heading" className="bg-sand py-16 md:py-24">
      <div className="container-site">
        <SectionHeading
          body={t('body')}
          className="reveal"
          id="orgs-heading"
          title={t('heading')}
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
                  'rounded-pill px-5 py-2.5 text-[0.9375rem] font-semibold transition-colors',
                  selected
                    ? 'bg-forest-700 text-white'
                    : 'bg-white text-ink ring-1 ring-line hover:bg-jade-50',
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
          className="mt-8 grid gap-10 rounded-card bg-white p-8 shadow-card md:p-10 lg:grid-cols-2 lg:items-center lg:gap-14"
          id={`${baseId}-panel-${current.key}`}
          role="tabpanel"
          tabIndex={0}
        >
          <div className="flex flex-col gap-6">
            <h3 className="text-2xl font-bold text-balance text-ink md:text-3xl">
              {t(`tabs.${current.key}.title`)}
            </h3>
            <p className="text-lg leading-relaxed text-ink-soft">{t(`tabs.${current.key}.body`)}</p>

            <dl className="grid gap-6 sm:grid-cols-2">
              {current.stats.map((stat) => (
                <div className="flex flex-col gap-1" key={stat.labelEn}>
                  <dt className="text-4xl font-bold text-forest-600">{stat.value}</dt>
                  <dd className="text-sm text-ink-soft">
                    {locale === 'ne' ? stat.labelNe : stat.labelEn}
                  </dd>
                </div>
              ))}
            </dl>

            <Link
              className="group inline-flex items-center gap-2 font-semibold text-forest-700"
              href={current.href}
            >
              {t('learnMore')}
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>

          <div className="relative aspect-4/3 overflow-hidden rounded-card">
            <Image
              alt={t(`tabs.${current.key}.imageAlt`)}
              className="object-cover"
              fill
              sizes="(max-width: 1024px) 100vw, 45vw"
              src={current.image}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

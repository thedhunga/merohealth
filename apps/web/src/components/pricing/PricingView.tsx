import { formatPrice, plans } from '@swasthya/entitlements';
import { Check, Minus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { WorkplaceInvestment } from '@/components/art/WorkplaceInvestment';
import { ButtonLink } from '@/components/ui/Button';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section, SectionHeading } from '@/components/ui/Section';
import { formatQuotaValue, PRICING_MODULE_ORDER, PRICING_QUOTA_ORDER } from '@/content/pricing';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/cn';

/**
 * `/pricing` — every price, description and module list below is read
 * straight from `@swasthya/entitlements`'s `plans` array. This component
 * supplies labels and layout only; changing what a plan costs or includes
 * means editing the catalogue, never this file.
 */
export function PricingView() {
  const t = useTranslations('pricing');
  const nav = useTranslations('nav');
  const locale = useLocale() as Locale;

  const hero = {
    eyebrow: nav('items.pricing'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: WorkplaceInvestment,
    artPosition: 'end' as const,
  };

  const cta = {
    id: 'pricing-cta-heading',
    heading: t('cta.heading'),
    body: t('cta.body'),
    primaryCta: { href: '/register', label: t('cta.primaryCta') },
    secondaryCta: { href: '/individuals/faqs', label: t('cta.secondaryCta') },
  };

  return (
    <PageTemplate cta={cta} hero={hero}>
      <Section labelledBy="pricing-plans-heading">
        <SectionHeading
          align="center"
          body={t('gridBody')}
          id="pricing-plans-heading"
          title={t('gridHeading')}
        />

        <ul className="mt-12 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <li key={plan.tier}>
              <article className="flex h-full flex-col gap-6 rounded-card border border-line bg-white p-8">
                <div>
                  <h3 className="text-2xl font-black text-ink">
                    {locale === 'ne' ? plan.nameNe : plan.nameEn}
                  </h3>
                  <p className="mt-2 leading-relaxed text-ink-soft">
                    {locale === 'ne' ? plan.descriptionNe : plan.descriptionEn}
                  </p>
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-4xl font-black text-ink">
                    {formatPrice(plan.monthlyPricePaisa, locale)}
                  </span>
                  {plan.monthlyPricePaisa > 0 ? (
                    <span className="text-ink-soft">{t('perMonth')}</span>
                  ) : null}
                </div>

                <ButtonLink
                  className="w-full justify-center"
                  href="/register"
                  variant={plan.tier === 'FREE' ? 'accent' : 'secondary'}
                >
                  {t('cardCta')}
                </ButtonLink>

                <div>
                  <h4 className="text-sm font-semibold tracking-wide text-indigo-700 uppercase">
                    {t('includedHeading')}
                  </h4>
                  <ul className="mt-3 flex flex-col gap-2">
                    {PRICING_MODULE_ORDER.map((moduleKey) => {
                      const included = plan.modules.includes(moduleKey);
                      return (
                        <li
                          className={cn(
                            'flex items-center gap-2 text-sm',
                            included ? 'text-ink' : 'text-ink-soft/60',
                          )}
                          key={moduleKey}
                        >
                          {included ? (
                            <Check aria-hidden className="size-4 shrink-0 text-indigo-600" />
                          ) : (
                            <Minus aria-hidden className="size-4 shrink-0 text-ink-soft/40" />
                          )}
                          {t(`modules.${moduleKey}.label`)}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-semibold tracking-wide text-indigo-700 uppercase">
                    {t('limitsHeading')}
                  </h4>
                  <dl className="mt-3 flex flex-col gap-2 text-sm">
                    {PRICING_QUOTA_ORDER.map((dimension) => (
                      <div className="flex justify-between gap-4" key={dimension}>
                        <dt className="text-ink-soft">{t(`quotas.${dimension}.label`)}</dt>
                        <dd className="font-semibold text-ink">
                          {formatQuotaValue(plan.limits[dimension], locale, t('unlimited'))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </article>
            </li>
          ))}
        </ul>

        <p className="mt-12 text-center text-sm text-ink-soft">{t('footnote')}</p>
      </Section>
    </PageTemplate>
  );
}

import { useTranslations } from 'next-intl';
import { ArrowRight, Smartphone } from 'lucide-react';

import { ButtonLink } from '@/components/ui/Button';
import { PulseLine } from '@/components/ui/PulseLine';

export function FinalCta() {
  const t = useTranslations('home.finalCta');

  return (
    <section
      aria-labelledby="final-cta-heading"
      className="relative overflow-hidden bg-linear-to-br from-primary-600 to-primary-800 py-20 md:py-28"
    >
      <PulseLine className="absolute inset-x-0 top-10 h-24 text-white/15" />
      <PulseLine className="absolute inset-x-0 bottom-10 h-24 text-white/10" />

      <div className="container-site reveal relative flex flex-col items-center gap-6 text-center">
        <h2
          className="max-w-3xl text-3xl font-bold text-balance text-white md:text-5xl"
          id="final-cta-heading"
        >
          {t('heading')}
        </h2>
        <p className="max-w-2xl text-lg text-primary-100">{t('body')}</p>

        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/register" size="lg" variant="inverse">
            {t('primaryCta')}
            <ArrowRight aria-hidden className="size-4.5" />
          </ButtonLink>
          <ButtonLink
            className="border border-white/30 bg-transparent text-white hover:bg-white/10"
            external
            href="/app"
            size="lg"
            variant="ghost"
          >
            <Smartphone aria-hidden className="size-4.5" />
            {t('secondaryCta')}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

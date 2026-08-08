import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';

import { ButtonLink } from '@/components/ui/Button';
import { PulseLine } from '@/components/ui/PulseLine';
import { Link } from '@/i18n/navigation';

export function Hero() {
  const t = useTranslations('home.hero');
  const announcement = useTranslations('home.announcement');

  return (
    <>
      <div className="bg-primary-800 text-white">
        <div className="container-site flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-2.5 text-center text-sm">
          <span className="text-primary-100">{announcement('text')}</span>
          <Link
            className="inline-flex items-center gap-1 font-semibold text-white underline-offset-4 hover:underline"
            href="/health-library"
          >
            {announcement('cta')}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>

      <section className="relative overflow-hidden bg-primary-50">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -end-24 size-[32rem] rounded-full bg-primary-200/50 blur-3xl"
        />

        <div className="container-site relative grid items-center gap-12 py-16 md:py-24 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col items-start gap-6">
            <span className="inline-flex items-center gap-2 rounded-pill bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm">
              <span aria-hidden className="size-2 rounded-full bg-primary-400" />
              {t('eyebrow')}
            </span>

            <h1 className="text-4xl leading-[1.1] font-bold text-balance text-ink md:text-5xl lg:text-[3.5rem]">
              {t('title')}
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-muted">{t('body')}</p>

            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/get-care" size="lg" variant="primary">
                {t('primaryCta')}
                <ArrowRight aria-hidden className="size-4.5" />
              </ButtonLink>
              <ButtonLink href="/individuals/without-insurance" size="lg" variant="secondary">
                {t('secondaryCta')}
              </ButtonLink>
            </div>

            <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
              <li className="inline-flex items-center gap-2 text-sm font-medium text-primary-700">
                <ShieldCheck aria-hidden className="size-4.5" />
                {t('trustOne')}
              </li>
              <li className="inline-flex items-center gap-2 text-sm font-medium text-primary-700">
                <LockKeyhole aria-hidden className="size-4.5" />
                {t('trustTwo')}
              </li>
            </ul>
          </div>

          <div className="relative">
            <div className="relative aspect-4/3 overflow-hidden rounded-card shadow-card lg:aspect-square">
              <Image
                alt=""
                className="object-cover"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                src="/imagery/mero-health-companion.webp"
              />

              {/* Live-vitals card, floated over the lower edge of the image. */}
              <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white/92 p-4 backdrop-blur-md">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold tracking-[0.12em] text-muted uppercase">
                    {t('liveLabel')}
                  </span>
                  <span
                    aria-hidden
                    className="size-2 animate-pulse rounded-full bg-primary-400"
                  />
                </div>
                <PulseLine className="mt-1 text-primary-500" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

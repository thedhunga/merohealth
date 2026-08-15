import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ArrowUpRight, Camera, FileCheck2, Languages, TrendingUp } from 'lucide-react';

import { ButtonLink } from '@/components/ui/Button';
import { RecordTransform } from '@/components/art/RecordTransform';

export function Hero() {
  const t = useTranslations('home.hero');
  const steps = [
    { key: 'recordStepOne', Icon: Camera },
    { key: 'recordStepTwo', Icon: Languages },
    { key: 'recordStepThree', Icon: TrendingUp },
  ] as const;

  return (
    <section
      aria-labelledby="record-story-heading"
      className="overflow-hidden bg-sand py-12 sm:py-20 lg:py-28"
    >
      <div className="container-site grid items-center gap-8 sm:gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-20">
        <div className="relative mx-auto w-full max-w-2xl lg:mx-0">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-indigo-950 shadow-lift">
            <Image
              alt="Illustrative scene of a woman having a private health conversation by phone"
              className="object-cover"
              fill
              sizes="(min-width: 1024px) 48vw, 100vw"
              src="/imagery/mero-private-care.webp"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/50 via-transparent to-transparent" />
            <span className="absolute top-5 left-5 inline-flex items-center gap-2 rounded-pill border border-white/25 bg-indigo-950/55 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur-md">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-marigold-300 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-marigold-300" />
              </span>
              {t('liveLabel')}
            </span>
          </div>

          {/* The floating record-preview card restates the three-step list beside
              it in visual form — a nice-to-have next to the text column, not
              load-bearing on a phone where it's pure height with no extra
              information, so it only renders once there is room beside the
              text. */}
          <div className="relative -mt-12 ml-auto hidden w-[88%] rounded-[1.5rem] border border-line bg-white p-4 shadow-menu sm:-mt-16 sm:w-[76%] sm:p-5 lg:block">
            <div className="flex items-center gap-3 border-b border-line pb-3">
              <span className="grid size-10 place-items-center rounded-xl bg-indigo-100 text-indigo-800">
                <FileCheck2 aria-hidden className="size-5" />
              </span>
              <div>
                <p className="text-xs font-semibold tracking-wide text-indigo-600 uppercase">
                  {t('recordEyebrow')}
                </p>
                <p className="text-sm font-semibold text-ink">{t('artCaption')}</p>
              </div>
            </div>
            <RecordTransform className="mt-3 aspect-[3/1] w-full overflow-hidden rounded-xl" />
          </div>
        </div>

        <div className="reveal">
          <p className="text-sm font-semibold tracking-[0.14em] text-indigo-600 uppercase">
            {t('recordEyebrow')}
          </p>
          <h2
            className="mt-4 max-w-[13ch] text-4xl text-balance sm:text-5xl"
            id="record-story-heading"
          >
            {t('recordTitle')}
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft sm:mt-5">
            {t('recordBody')}
          </p>

          <ol className="mt-6 space-y-2 sm:mt-8 sm:space-y-3">
            {steps.map(({ key, Icon }, index) => (
              <li
                className="flex items-center gap-4 rounded-2xl border border-line bg-white p-3 shadow-[0_1px_0_rgb(23_20_41/.04)] sm:p-4"
                key={key}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="flex-1 font-semibold text-ink">{t(key)}</span>
                <span className="text-sm font-bold text-indigo-200">0{index + 1}</span>
              </li>
            ))}
          </ol>

          <ButtonLink
            className="mt-6 sm:mt-8"
            href="/individuals/how-it-works"
            size="lg"
            variant="primary"
          >
            {t('secondaryCta')}
            <ArrowUpRight aria-hidden className="size-4.5" />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

import { useTranslations } from 'next-intl';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';

import { ButtonLink } from '@/components/ui/Button';
import { RecordTransform } from '@/components/art/RecordTransform';
import { Link } from '@/i18n/navigation';
import { hasAsset } from '@/lib/assets';

const HERO_VIDEO = '/video/mero-health-hero.mp4';

export function Hero() {
  const t = useTranslations('home.hero');
  const announcement = useTranslations('home.announcement');
  const heroVideoReady = hasAsset(HERO_VIDEO);

  return (
    <>
      <div className="bg-forest-900 text-white">
        <div className="container-site flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-3 text-center text-sm">
          <span className="text-jade-100">{announcement('text')}</span>
          <Link
            className="inline-flex items-center gap-1 font-semibold text-marigold-500 underline-offset-4 hover:underline"
            href="/health-library"
          >
            {announcement('cta')}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>

      <section className="relative overflow-hidden bg-forest-700 text-white">
        {/*
          Ambient footage, sitting behind everything.

          Muted with no audio track, autoplaying, looping and `playsInline` —
          the only combination browsers reliably autoplay. It is decorative, so
          it carries no controls and no label, and it is skipped entirely under
          reduced-motion via `motion-reduce:hidden`.

          The forest wash over it is deliberately opaque enough that the
          headline contrast does not depend on what the footage happens to
          show — a bright frame must not be able to make the h1 unreadable.
        */}
        {heroVideoReady ? (
          <>
            <video
              aria-hidden
              autoPlay
              className="pointer-events-none absolute inset-0 size-full object-cover opacity-45 motion-reduce:hidden"
              loop
              muted
              playsInline
              preload="metadata"
              tabIndex={-1}
            >
              <source src={HERO_VIDEO} type="video/mp4" />
            </video>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-forest-700/75"
            />
          </>
        ) : null}

        {/*
          The signature: मेरो set as artwork, bled off the edge. It is a
          graphic, not a heading — the real <h1> sits below and this is
          hidden from assistive technology.
        */}
        <span
          aria-hidden
          className="script-mark pointer-events-none absolute -top-10 -start-6 text-[26rem] text-white/[0.05] sm:text-[34rem]"
        >
          मेरो
        </span>

        <div className="container-site relative grid items-center gap-14 py-20 md:py-28 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
          <div className="flex flex-col items-start gap-7">
            <span className="inline-flex items-center gap-2.5 rounded-pill bg-white/10 py-2 ps-2.5 pe-4 text-sm font-medium text-jade-100 ring-1 ring-white/15">
              <span className="rounded-pill bg-marigold-500 px-2.5 py-0.5 text-xs font-bold text-forest-900">
                {announcement('badge')}
              </span>
              {t('eyebrow')}
            </span>

            {/*
              No leading utility here on purpose. The base layer sets 1.12 for
              Latin and 1.34 for :lang(ne); a utility class would win over both
              and clip Devanagari matras at display sizes.
            */}
            <h1 className="text-[2.75rem] text-balance text-white sm:text-6xl lg:text-[4.25rem]">
              {t('title')}
            </h1>

            <p className="max-w-lg text-lg leading-relaxed text-jade-100 sm:text-xl">
              {t('body')}
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <ButtonLink href="/get-care" size="lg" variant="accent">
                {t('primaryCta')}
                <ArrowRight aria-hidden className="size-5" />
              </ButtonLink>
              <ButtonLink href="/individuals/without-insurance" size="lg" variant="onDark">
                {t('secondaryCta')}
              </ButtonLink>
            </div>

            <ul className="flex flex-wrap gap-x-7 gap-y-2 pt-3">
              <li className="inline-flex items-center gap-2 text-sm text-jade-200">
                <ShieldCheck aria-hidden className="size-5 text-marigold-500" />
                {t('trustOne')}
              </li>
              <li className="inline-flex items-center gap-2 text-sm text-jade-200">
                <LockKeyhole aria-hidden className="size-5 text-marigold-500" />
                {t('trustTwo')}
              </li>
            </ul>
          </div>

          <div className="relative">
            <RecordTransform className="w-full drop-shadow-2xl" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-jade-200">
              {t('artCaption')}
            </p>
          </div>
        </div>

        {/* Curved lip into the next section, so the ground ends deliberately. */}
        <div
          aria-hidden
          className="h-10 rounded-t-[2.5rem] bg-paper md:h-14 md:rounded-t-[4rem]"
        />
      </section>
    </>
  );
}

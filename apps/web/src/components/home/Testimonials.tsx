import { useTranslations } from 'next-intl';
import { Play, Quote, Sparkles, User } from 'lucide-react';

import { testimonialKeys } from '@/content/home';
import { EditorialImage } from '@/components/ui/EditorialImage';
import { hasAsset } from '@/lib/assets';
import { TestimonialsGrid } from './TestimonialsGrid';

const STORY_VIDEO = '/video/mero-health-story.mp4';

/** Fictional scenarios are labelled as such; the film is illustrative. */
export function Testimonials() {
  const t = useTranslations('home.testimonials');
  const storyReady = hasAsset(STORY_VIDEO);

  // `EditorialImage` reads the filesystem to decide whether a real portrait
  // exists, so the cards must render here on the server; `TestimonialsGrid`
  // only owns the client-side expand/collapse of the already-rendered list.
  const cards = testimonialKeys.map((key, index) => (
    <li
      className="rounded-[1.5rem] border border-white/12 bg-white/8 p-6 backdrop-blur-sm"
      key={key}
    >
      <div className="flex items-center justify-between">
        <Quote aria-hidden className="size-6 text-marigold-300" />
        <span className="text-xs font-bold tracking-[.16em] text-indigo-400">0{index + 1}</span>
      </div>
      <blockquote className="mt-5 text-lg leading-relaxed text-white text-pretty">
        {t(`items.${key}.quote`)}
      </blockquote>
      <footer className="mt-6 flex items-center gap-3 border-t border-white/12 pt-4 text-sm text-indigo-200">
        {/*
          Portraits land one at a time, so each avatar falls back to a
          neutral placeholder rather than a broken image. The
          photograph is decorative — the name beside it already
          carries the meaning — so alt is empty.
        */}
        <EditorialImage
          alt=""
          className="size-11 shrink-0 rounded-full bg-white/15 ring-1 ring-white/25"
          fallback={
            <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-white/15 ring-1 ring-white/25">
              <User aria-hidden className="size-5 text-indigo-200" />
            </span>
          }
          sizes="44px"
          src={`/imagery/portrait-${key}.webp`}
        />
        <span>
          <span className="block font-semibold text-white">{t(`items.${key}.name`)}</span>
          {t(`items.${key}.context`)}
        </span>
      </footer>
    </li>
  ));

  return (
    <section
      aria-labelledby="testimonials-heading"
      className="relative isolate overflow-hidden bg-indigo-950 py-20 text-white md:py-28"
    >
      <div
        aria-hidden
        className="absolute -top-48 -right-40 -z-10 size-[34rem] rounded-full bg-indigo-600/25 blur-3xl"
      />
      <div className="container-site">
        <div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
          <div className="reveal">
            <span className="hidden items-center gap-2 rounded-pill border border-white/15 bg-white/8 px-3 py-1.5 text-sm font-semibold text-indigo-100 lg:inline-flex">
              <Sparkles aria-hidden className="size-4 text-marigold-300" />
              {t('watchVideo')}
            </span>
            <h2
              className="mt-5 max-w-[11ch] text-4xl text-balance sm:text-5xl"
              id="testimonials-heading"
            >
              {t('heading')}
            </h2>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-indigo-200">
              {t('disclaimer')}
            </p>
          </div>

          {/* The player is a nice-to-have next to the story copy, not load-bearing —
              on a phone it is pure height with no extra information (the
              testimonial cards below carry the same content), so it only
              renders once there is room for it beside the text column. */}
          <div className="group relative hidden aspect-video overflow-hidden rounded-[2rem] bg-indigo-900 shadow-menu ring-1 ring-white/10 lg:block">
            <video
              aria-label={t('watchVideo')}
              className="size-full object-cover"
              controls
              playsInline
              poster="/imagery/mero-community-care.webp"
              preload="metadata"
            >
              {storyReady ? <source src={STORY_VIDEO} type="video/mp4" /> : null}
            </video>
            {storyReady ? null : (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 grid place-items-center"
              >
                <span className="grid size-16 place-items-center rounded-full bg-white/90 text-indigo-800 transition-transform group-hover:scale-110">
                  <Play className="size-6 translate-x-0.5 fill-current" />
                </span>
              </span>
            )}
          </div>
        </div>

        <TestimonialsGrid
          cards={cards}
          showFewerLabel={t('showFewer')}
          showMoreLabel={t('showMore', { count: testimonialKeys.length - 2 })}
        />
      </div>
    </section>
  );
}

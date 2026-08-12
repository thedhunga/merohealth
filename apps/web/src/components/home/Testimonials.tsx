import { useTranslations } from 'next-intl';
import { Play, Quote, User } from 'lucide-react';

import { testimonialKeys } from '@/content/home';
import { EditorialImage } from '@/components/ui/EditorialImage';
import { SectionHeading } from '@/components/ui/Section';
import { hasAsset } from '@/lib/assets';

const STORY_VIDEO = '/video/mero-health-story.mp4';

/**
 * Testimonial carousel.
 *
 * Built on scroll-snap rather than JavaScript: it is swipeable on touch,
 * scrollable with a trackpad, and reachable by keyboard because the scroller
 * itself is focusable. No slide state to desynchronise, and it degrades to a
 * plain horizontal scroller everywhere.
 */
export function Testimonials() {
  const t = useTranslations('home.testimonials');
  const storyReady = hasAsset(STORY_VIDEO);

  return (
    <section aria-labelledby="testimonials-heading" className="bg-forest-800 py-16 md:py-24">
      <div className="container-site">
        <SectionHeading
          align="center"
          className="reveal"
          id="testimonials-heading"
          title={t('heading')}
          tone="light"
        />

        {/*
          `grid-cols-1` explicitly, not just the bare `grid` utility: without
          it there is no defined track below `lg`, so the grid falls back to
          content-based sizing and the unconstrained <video> (which has no
          intrinsic width until metadata loads) pushes its column — and the
          whole page — wider than the viewport. `grid-cols-1` uses
          `minmax(0, 1fr)`, which caps the track at the container width.
        */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            {/*
              The play badge only renders before the film exists. Once a real
              <source> is present the native controls own the play affordance,
              and a decorative badge sitting over them would be a second,
              non-functional play button.
            */}
            <div className="group relative aspect-video overflow-hidden rounded-card bg-forest-900 shadow-menu">
              <video
                aria-label={t('watchVideo')}
                className="size-full object-cover"
                controls
                playsInline
                poster="/imagery/nepali-care-team.webp"
                preload="none"
              >
                {storyReady ? <source src={STORY_VIDEO} type="video/mp4" /> : null}
              </video>
              {storyReady ? null : (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 grid place-items-center"
                >
                  <span className="grid size-16 place-items-center rounded-full bg-white/90 text-forest-700 transition-transform group-hover:scale-110">
                    <Play className="size-6 translate-x-0.5 fill-current" />
                  </span>
                </span>
              )}
            </div>
            <p className="mt-3 text-sm text-jade-200">{t('watchVideo')}</p>
          </div>

          <div className="lg:col-span-7">
            <ul
              className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 [scrollbar-width:thin]"
              tabIndex={0}
            >
              {testimonialKeys.map((key) => (
                <li
                  className="w-[min(21rem,80vw)] shrink-0 snap-start rounded-card bg-white/10 p-7 backdrop-blur-sm"
                  key={key}
                >
                  <Quote aria-hidden className="size-7 text-jade-200" />
                  <blockquote className="mt-4 text-lg leading-relaxed text-white text-pretty">
                    {t(`items.${key}.quote`)}
                  </blockquote>
                  <footer className="mt-5 flex items-center gap-3 text-sm text-jade-200">
                    {/*
                      Portraits land one at a time, so each avatar falls back
                      to a neutral placeholder rather than a broken image. The
                      photograph is decorative — the name beside it already
                      carries the meaning — so alt is empty.
                    */}
                    <EditorialImage
                      alt=""
                      className="size-11 shrink-0 rounded-full bg-white/15 ring-1 ring-white/25"
                      fallback={
                        <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-white/15 ring-1 ring-white/25">
                          <User aria-hidden className="size-5 text-jade-200" />
                        </span>
                      }
                      sizes="44px"
                      src={`/imagery/portrait-${key}.webp`}
                    />
                    <span>
                      <span className="block font-semibold text-white">
                        {t(`items.${key}.name`)}
                      </span>
                      {t(`items.${key}.context`)}
                    </span>
                  </footer>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-8 max-w-3xl text-xs leading-relaxed text-jade-200">
          {t('disclaimer')}
        </p>
      </div>
    </section>
  );
}

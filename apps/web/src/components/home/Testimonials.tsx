import { useTranslations } from 'next-intl';
import { Play, Quote } from 'lucide-react';

import { testimonialKeys } from '@/content/home';
import { SectionHeading } from '@/components/ui/Section';

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

        <div className="mt-12 grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            {/*
              Video slot. `poster` renders until real footage is supplied, so
              the section is complete-looking without shipping a fake video.
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
                {/* <source src="/video/mero-health-story.mp4" type="video/mp4" /> */}
              </video>
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 grid place-items-center"
              >
                <span className="grid size-16 place-items-center rounded-full bg-white/90 text-forest-700 transition-transform group-hover:scale-110">
                  <Play className="size-6 translate-x-0.5 fill-current" />
                </span>
              </span>
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
                  <footer className="mt-5 text-sm text-jade-200">
                    <span className="font-semibold text-white">{t(`items.${key}.name`)}</span>
                    <span aria-hidden> · </span>
                    {t(`items.${key}.context`)}
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

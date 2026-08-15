import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ArrowUpRight } from 'lucide-react';

import { serviceCards } from '@/content/home';
import { Link } from '@/i18n/navigation';

export function ServiceCards() {
  const t = useTranslations('home.services');
  const nav = useTranslations('nav.items');

  return (
    <section aria-labelledby="services-heading" className="bg-paper py-20 md:py-28">
      <div className="container-site">
        <div className="reveal grid gap-6 lg:grid-cols-[1fr_.7fr] lg:items-end">
          <h2 className="max-w-[15ch] text-4xl text-balance sm:text-5xl" id="services-heading">
            {t('heading')}
          </h2>
          <p className="max-w-xl text-lg leading-relaxed text-ink-soft lg:justify-self-end">
            {t('body')}
          </p>
        </div>

        <ul className="reveal-stagger mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-12">
          {serviceCards.map(({ key, href, Art, links }, index) => {
            const isFeatured = index === 0;

            return (
              <li
                className={
                  isFeatured
                    ? 'md:col-span-2 lg:col-span-7 lg:row-span-2'
                    : index < 3
                      ? 'lg:col-span-5'
                      : 'lg:col-span-4'
                }
                key={key}
              >
                <article
                  className={
                    isFeatured
                      ? 'group relative isolate flex min-h-[31rem] h-full overflow-hidden rounded-[2rem] bg-indigo-950 p-7 text-white shadow-card sm:min-h-[35rem] sm:p-10'
                      : 'group relative flex h-full min-h-72 flex-col overflow-hidden rounded-[1.75rem] border border-line bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-card sm:p-7'
                  }
                >
                  {isFeatured ? (
                    <>
                      <Image
                        alt="Illustrative scene of a clinician reviewing information with an older patient"
                        className="object-cover object-[38%_center] transition-transform duration-700 group-hover:scale-[1.025] motion-reduce:transform-none"
                        fill
                        sizes="(min-width: 1024px) 58vw, 100vw"
                        src="/imagery/mero-community-care.webp"
                      />
                      <div className="absolute inset-0 -z-0 bg-gradient-to-t from-indigo-950 via-indigo-950/55 to-transparent" />
                    </>
                  ) : (
                    <Art className="mb-5 aspect-[2/1] w-full rounded-2xl" />
                  )}

                  <div
                    className={
                      isFeatured
                        ? 'relative z-10 mt-auto max-w-lg'
                        : 'relative flex flex-1 flex-col'
                    }
                  >
                    <span
                      className={
                        isFeatured
                          ? 'mb-4 inline-flex rounded-pill bg-marigold-500 px-3 py-1 text-xs font-bold tracking-wide text-indigo-950 uppercase'
                          : 'mb-3 text-xs font-bold tracking-[.14em] text-indigo-400 uppercase'
                      }
                    >
                      0{index + 1}
                    </span>
                    <h3 className={isFeatured ? 'text-3xl sm:text-4xl' : 'text-2xl'}>
                      <Link className="after:absolute after:inset-0" href={href}>
                        {t(`items.${key}.title`)}
                      </Link>
                    </h3>
                    <p
                      className={
                        isFeatured
                          ? 'mt-3 max-w-md text-lg leading-relaxed text-indigo-100'
                          : 'mt-3 flex-1 leading-relaxed text-ink-soft'
                      }
                    >
                      {t(`items.${key}.body`)}
                    </p>

                    {links ? (
                      <ul className="relative z-10 mt-5 flex flex-wrap gap-2">
                        {links.map((link) => (
                          <li key={`${key}-${link.key}`}>
                            <Link
                              className="inline-flex min-h-10 items-center rounded-pill bg-sand px-3 text-sm font-medium text-ink transition-colors hover:bg-indigo-100"
                              href={link.href}
                            >
                              {nav(link.key)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <span
                      className={
                        isFeatured
                          ? 'mt-6 inline-flex items-center gap-2 font-semibold text-white'
                          : 'mt-5 inline-flex items-center gap-2 font-semibold text-indigo-700'
                      }
                    >
                      {t('learnMore')}
                      <ArrowUpRight
                        aria-hidden
                        className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      />
                    </span>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

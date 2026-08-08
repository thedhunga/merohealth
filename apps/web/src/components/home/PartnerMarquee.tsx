import { useTranslations } from 'next-intl';

import { partnerPlaceholders } from '@/content/home';

export function PartnerMarquee() {
  const t = useTranslations('home.partners');

  return (
    <section aria-labelledby="partners-heading" className="border-y border-line bg-white py-14">
      <div className="container-site flex flex-col items-center gap-3 text-center">
        <h2 className="text-lg font-semibold text-ink" id="partners-heading">
          {t('heading')}
        </h2>
        <p className="max-w-2xl text-sm text-muted">{t('body')}</p>
        <span className="rounded-pill bg-saffron-100 px-3 py-1 text-xs font-bold tracking-wide text-saffron-600 uppercase">
          {t('placeholderNote')}
        </span>
      </div>

      {/*
        The track holds the list twice so the -50% translation loops
        seamlessly. The duplicate is aria-hidden to avoid announcing every
        name twice.
      */}
      <div className="marquee mt-10 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="marquee-track flex w-max gap-4">
          {[0, 1].map((copy) => (
            <ul aria-hidden={copy === 1} className="flex gap-4" key={copy}>
              {partnerPlaceholders.map((name) => (
                <li
                  className="grid h-16 w-52 place-items-center rounded-xl border border-line bg-canvas px-5 text-sm font-semibold text-muted"
                  key={`${copy}-${name}`}
                >
                  {name}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}

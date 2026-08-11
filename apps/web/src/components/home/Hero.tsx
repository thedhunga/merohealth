import { useTranslations } from 'next-intl';
import { FileText, LockKeyhole, ShieldCheck } from 'lucide-react';

import { ButtonLink } from '@/components/ui/Button';
import { RecordTransform } from '@/components/art/RecordTransform';

/**
 * The value proposition, sitting *below* the symptom entry rather than above
 * it.
 *
 * This used to be a 1111px dark full-bleed panel — 1.4 phone screens of brand
 * before the reader could do anything, on a site whose visitors arrive with a
 * symptom in mind. It is now a light, compact band: the artwork still carries
 * the paper-report-becomes-a-record idea, but it no longer stands between the
 * person and the thing they came to do.
 *
 * Light surface on purpose. Dark full-bleed reads editorial; a health utility
 * reads clinical, which means white, dense and functional.
 */
export function Hero() {
  const t = useTranslations('home.hero');

  const assurances = [
    { key: 'trustOne', Icon: ShieldCheck },
    { key: 'trustTwo', Icon: LockKeyhole },
  ] as const;

  return (
    <section aria-labelledby="value-heading" className="border-t border-line bg-sand py-10 sm:py-14">
      <div className="container-site grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
        <div className="flex flex-col items-start gap-4">
          <span className="inline-flex items-center gap-2 rounded-pill bg-white px-3 py-1.5 text-xs font-semibold text-indigo-800 ring-1 ring-line">
            <FileText aria-hidden className="size-4" />
            {t('eyebrow')}
          </span>

          <h2
            className="text-2xl leading-snug font-bold text-balance text-ink sm:text-3xl"
            id="value-heading"
          >
            {t('title')}
          </h2>

          <p className="text-[0.9375rem] leading-relaxed text-ink-soft sm:text-base">
            {t('artCaption')}
          </p>

          <ButtonLink className="mt-1" href="/individuals/how-it-works" variant="secondary">
            {t('secondaryCta')}
          </ButtonLink>

          <ul className="mt-1 flex flex-col gap-2">
            {assurances.map(({ key, Icon }) => (
              <li className="inline-flex items-center gap-2 text-sm text-ink-soft" key={key}>
                <Icon aria-hidden className="size-4 shrink-0 text-indigo-600" />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>

        {/* Artwork is decorative support here, so it yields first on a phone. */}
        <RecordTransform className="order-first w-full max-w-sm justify-self-center lg:order-none lg:max-w-none" />
      </div>
    </section>
  );
}

'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

import { Link, useRouter } from '@/i18n/navigation';
import { useSpeechDictation } from '@/hooks/useSpeechDictation';
import { storeCareListenIntent, storeCareQuestion } from '@/lib/get-care-session';
import { micHeroLayout } from '@/lib/home-screen';
import { MicHero } from './MicHero';
import { TextEntryToggle } from './TextEntryToggle';

const CARDS = [
  { key: 'record', src: '/imagery/mero-family-report.webp', altKey: 'imageAlt' as const },
  { key: 'assistant', src: '/imagery/mero-private-care.webp', altKey: 'recordImageAlt' as const },
  { key: 'family', src: '/imagery/mero-community-care.webp', altKey: 'featuredImageAlt' as const },
] as const;

/**
 * Round seven, task O (second box): `/` for a device with no history —
 * everyone's actual first look at the product. `HomeGate` renders this only
 * on the Nepali bare path; `/en` keeps the existing full marketing page (see
 * `homeVariant` in `lib/home-screen.ts` for why), and `HomeScreen` already
 * covers a returning device. The owner's complaint was a marketing page
 * masquerading as a daily surface, so this borrows the same mic-first shape
 * as `HomeScreen` rather than another six-section pitch: mic, three things
 * this actually does (each already-photographed, already-translated, no new
 * claims), one safety line, one be-first teaser, then the shared footer.
 */
export function FirstVisitScreen() {
  const hero = useTranslations('home.hero');
  const homeScreenT = useTranslations('homeScreen');
  const servicesT = useTranslations('home.services');
  const cardsT = useTranslations('homeFirstVisit.cards');
  const whatYouGetT = useTranslations('homeFirstVisit.whatYouGet');
  const getCareT = useTranslations('getCare');
  const upsellT = useTranslations('getCare.upsell');
  const locale = useLocale();
  const router = useRouter();
  // Same as `HomeScreen`: this screen never listens itself, it only needs to
  // know whether the device can, so the mic tap can hand off to `/get-care`
  // already listening instead of one more tap away.
  const dictation = useSpeechDictation(locale, () => {});

  const imageAltByCard: Record<(typeof CARDS)[number]['altKey'], string> = {
    imageAlt: hero('imageAlt'),
    recordImageAlt: hero('recordImageAlt'),
    featuredImageAlt: servicesT('featuredImageAlt'),
  };

  const handleMicTap = () => {
    if (dictation.supported) storeCareListenIntent();
    router.push('/get-care');
  };

  const goToGetCare = (question?: string) => {
    if (question) storeCareQuestion(question);
    router.push('/get-care');
  };

  const layout = micHeroLayout(dictation.supported);

  return (
    <>
      <section aria-labelledby="first-visit-heading" className="bg-paper py-10 sm:py-14">
        <div className="container-site max-w-xl text-center">
          <span className="inline-flex items-center gap-2 rounded-pill bg-indigo-50 px-3.5 py-2 text-sm font-semibold text-indigo-700">
            <Sparkles aria-hidden className="size-4 text-marigold-500" />
            {hero('eyebrow')}
          </span>
          <h1 className="mt-4 text-3xl text-balance sm:text-4xl" id="first-visit-heading">
            {hero('title')}
          </h1>

          <div className="mt-6 flex flex-col items-center">
            <MicHero
              label={layout === 'voiceFirst' ? homeScreenT('micLabel') : homeScreenT('micUnavailable')}
              onClick={handleMicTap}
              state={layout === 'voiceFirst' ? 'idle' : 'unavailable'}
            />

            <TextEntryToggle
              onSubmit={(question) => goToGetCare(question || undefined)}
              placeholder={getCareT('form.placeholder')}
              promoted={layout === 'textFirst'}
              submitLabel={getCareT('form.submit')}
              toggleLabel={homeScreenT('typeLabel')}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="what-you-get-heading" className="bg-paper pb-10 sm:pb-14">
        <div className="container-site max-w-xl">
          <h2 className="text-center text-sm font-bold tracking-wide text-indigo-700 uppercase" id="what-you-get-heading">
            {whatYouGetT('heading')}
          </h2>
          <ul className="mt-4 grid grid-cols-3 gap-3">
            {CARDS.map(({ key, src, altKey }) => (
              <li key={key}>
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-indigo-100">
                  <Image
                    alt={imageAltByCard[altKey]}
                    className="object-cover"
                    fill
                    sizes="(min-width: 640px) 176px, 33vw"
                    src={src}
                  />
                </div>
                <p className="mt-2 text-xs font-bold text-indigo-950">{cardsT(`${key}.title`)}</p>
                <p className="mt-0.5 text-xs leading-snug text-ink-soft">{cardsT(`${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-label={getCareT('eyebrow')} className="bg-paper pb-10 sm:pb-14">
        <div className="container-site max-w-xl">
          <p className="flex items-center justify-center gap-2 text-center text-sm font-semibold text-indigo-800">
            <ShieldCheck aria-hidden className="size-4 shrink-0 text-marigold-500" />
            {hero('trustOne')}
          </p>
        </div>
      </section>

      <section aria-labelledby="be-first-heading" className="bg-paper pb-12 sm:pb-16">
        <div className="container-site max-w-xl">
          <div className="rounded-card border border-marigold-300 bg-marigold-100/50 p-5 text-center sm:p-6">
            <h2 className="text-lg font-bold text-ink" id="be-first-heading">
              {upsellT('comingSoonBody')}
            </h2>
            <Link
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-pill bg-marigold-500 px-5 text-sm font-bold text-indigo-950 hover:bg-marigold-300"
              href="/pricing#early-access"
            >
              {upsellT('comingSoonCta')}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

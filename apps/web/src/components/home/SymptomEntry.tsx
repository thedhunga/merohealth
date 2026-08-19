'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ArrowRight, HeartPulse, LockKeyhole, Mic, Search, ShieldCheck } from 'lucide-react';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { storeCareQuestion } from '@/lib/get-care-session';
import { useSpeechDictation } from '@/hooks/useSpeechDictation';
import { cn } from '@/lib/cn';

const QUICK_KEYS = ['fever', 'headache', 'stomach', 'cough', 'chest', 'skin'] as const;

/** The homepage hero and the start of the safety-gated care journey. */
export function SymptomEntry() {
  const symptom = useTranslations('home.symptom');
  const hero = useTranslations('home.hero');
  const router = useRouter();
  const locale = useLocale();
  const [value, setValue] = useState('');
  const dictation = useSpeechDictation(locale, (text) => {
    setValue((current) => (current ? `${current} ${text}` : text));
  });

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    storeCareQuestion(trimmed);
    router.push('/get-care');
  };

  return (
    <section
      aria-labelledby="home-hero-heading"
      className="relative isolate min-h-[46rem] overflow-hidden bg-indigo-950 text-white sm:min-h-[50rem] lg:min-h-[46rem]"
    >
      <Image
        alt={hero('imageAlt')}
        className="object-cover object-[68%_center] lg:object-center"
        fill
        priority
        sizes="100vw"
        src="/imagery/mero-family-report.webp"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(14,11,31,.98)_0%,rgba(14,11,31,.88)_35%,rgba(14,11,31,.34)_70%,rgba(14,11,31,.14)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(14,11,31,.96)_0%,transparent_48%,rgba(14,11,31,.18)_100%)] lg:bg-[linear-gradient(0deg,rgba(14,11,31,.75)_0%,transparent_45%)]" />
      <div
        aria-hidden
        className="absolute -top-32 -left-32 size-[28rem] rounded-full bg-indigo-400/15 blur-3xl"
      />

      <div className="container-site relative z-10 flex min-h-[46rem] flex-col justify-between py-10 sm:min-h-[50rem] sm:py-14 lg:min-h-[46rem] lg:py-16">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-pill border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold text-indigo-50 backdrop-blur-md">
            <HeartPulse aria-hidden className="size-4 text-marigold-300" />
            {hero('eyebrow')}
          </span>

          <h1
            className="mt-7 max-w-[12ch] text-[2.65rem] text-balance sm:text-6xl lg:text-[4.5rem]"
            id="home-hero-heading"
          >
            {hero('title')}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-indigo-100 sm:text-xl">
            {hero('body')}
          </p>

          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-indigo-100">
            <li className="inline-flex items-center gap-2">
              <ShieldCheck aria-hidden className="size-4 text-marigold-300" />
              {hero('trustOne')}
            </li>
            <li className="inline-flex items-center gap-2">
              <LockKeyhole aria-hidden className="size-4 text-marigold-300" />
              {hero('trustTwo')}
            </li>
          </ul>
        </div>

        <div className="mt-16 max-w-3xl lg:mt-10">
          {/*
            `theme-pin-light`: this glass card is a translucent overlay on
            the photo behind it, not "the page" — it must read the same
            regardless of site theme, the same as the always-dark
            `bg-indigo-950` section it sits in. Pins every token it and its
            children (`bg-sand`, `text-ink`, `ring-line`) use back to their
            light-mode values (see `globals.css`).
          */}
          <div className="theme-pin-light rounded-[1.75rem] border border-white/20 bg-white/95 p-4 text-ink shadow-lift backdrop-blur-xl sm:p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
              <div>
                <h2 className="font-sans text-xl font-bold tracking-normal text-ink sm:text-2xl">
                  {symptom('heading')}
                </h2>
                <p className="mt-1 text-sm text-ink-soft sm:text-base">{symptom('body')}</p>
              </div>
              <span className="mt-2 shrink-0 text-xs font-semibold tracking-wide text-indigo-600 uppercase sm:mt-0">
                {hero('liveLabel')}
              </span>
            </div>

            <form
              className="mt-4"
              onSubmit={(event) => {
                event.preventDefault();
                submit(value);
              }}
            >
              <div className="flex items-center gap-2 rounded-2xl bg-sand p-2 ring-1 ring-line focus-within:ring-2 focus-within:ring-indigo-600">
                <Search aria-hidden className="ms-2 size-5 shrink-0 text-ink-soft" />
                <input
                  aria-label={symptom('inputLabel')}
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent py-3 text-base text-ink outline-none placeholder:text-ink-soft"
                  enterKeyHint="search"
                  name="q"
                  onChange={(event) => {
                    setValue(event.target.value);
                  }}
                  placeholder={symptom('placeholder')}
                  type="search"
                  value={value}
                />
                {/*
                  Dictates in place. This used to navigate to /app/companion,
                  which 404s in production — the "microphone error" was a dead
                  route. Rendered only where the Web Speech API exists, so no
                  browser ever shows a control that cannot work.
                */}
                {dictation.supported ? (
                  <button
                    aria-label={
                      dictation.status === 'listening'
                        ? symptom('voiceListening')
                        : symptom('voiceLabel')
                    }
                    aria-pressed={dictation.status === 'listening'}
                    className={cn(
                      'grid size-12 shrink-0 place-items-center rounded-xl transition-colors',
                      dictation.status === 'listening'
                        ? 'animate-pulse bg-danger-100 text-danger-500 motion-reduce:animate-none'
                        : 'text-ink-soft hover:bg-white',
                    )}
                    onClick={dictation.toggle}
                    type="button"
                  >
                    <Mic aria-hidden className="size-5" />
                  </button>
                ) : null}
                <button
                  aria-label={symptom('submitLabel')}
                  className="grid size-12 shrink-0 place-items-center rounded-xl bg-marigold-500 text-indigo-950 transition-colors hover:bg-marigold-300"
                  type="submit"
                >
                  <ArrowRight aria-hidden className="size-5" />
                </button>
              </div>
            </form>

            <ul
              aria-label={symptom('quickLabel')}
              className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap"
            >
              {QUICK_KEYS.map((key) => (
                <li key={key}>
                  <button
                    className="inline-flex min-h-11 items-center rounded-pill bg-white px-3.5 text-sm font-sans-medium whitespace-nowrap text-ink ring-1 ring-line transition-colors hover:bg-indigo-50 hover:ring-indigo-200"
                    onClick={() => {
                      submit(symptom(`quick.${key}`));
                    }}
                    type="button"
                  >
                    {symptom(`quick.${key}`)}
                  </button>
                </li>
              ))}
            </ul>
            <p aria-live="polite" className="mt-3 text-xs leading-relaxed text-ink-soft">
              {dictation.status === 'denied' ? symptom('voiceDenied') : symptom('disclaimer')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

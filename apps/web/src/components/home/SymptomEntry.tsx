'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Mic, Search } from 'lucide-react';

import { useRouter } from '@/i18n/navigation';

/**
 * The first thing on the page, and the reason someone opened it.
 *
 * A person arriving at a health site on a phone has a symptom in mind and
 * wants to type it. Everything else — who we are, what we offer, which
 * organisations we serve — is a distant second, so this sits above it all
 * rather than after a brand statement.
 *
 * This is deliberately **not** a triage engine and must never become one. It
 * collects what the person is feeling and hands it to the assistant, where
 * `packages/clinical-safety` runs its deterministic emergency interception
 * before any model sees the text. Nothing here outputs a diagnosis.
 */
const QUICK_KEYS = ['fever', 'headache', 'stomach', 'cough', 'chest', 'skin'] as const;

export function SymptomEntry() {
  const t = useTranslations('home.symptom');
  const router = useRouter();
  const [value, setValue] = useState('');

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    router.push(`/get-care?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <section aria-labelledby="symptom-heading" className="bg-white pt-6 pb-8 sm:pt-10">
      <div className="container-site">
        <h1
          className="text-[1.75rem] leading-tight font-bold text-balance text-ink sm:text-4xl"
          id="symptom-heading"
        >
          {t('heading')}
        </h1>
        <p className="mt-2 text-[0.9375rem] text-ink-soft sm:text-lg">{t('body')}</p>

        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit(value);
          }}
        >
          <div className="flex items-center gap-2 rounded-2xl bg-sand p-2 ring-1 ring-line focus-within:ring-2 focus-within:ring-indigo-600">
            <Search aria-hidden className="ms-2 size-5 shrink-0 text-ink-soft" />
            <input
              aria-label={t('inputLabel')}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-3 text-base text-ink outline-none placeholder:text-ink-soft"
              enterKeyHint="search"
              name="q"
              onChange={(event) => {
                setValue(event.target.value);
              }}
              placeholder={t('placeholder')}
              type="search"
              value={value}
            />
            {/*
              48px minimum on both controls: the WCAG target size, and the
              practical floor for a thumb on a phone held one-handed.
            */}
            <button
              aria-label={t('voiceLabel')}
              className="grid size-12 shrink-0 place-items-center rounded-xl text-ink-soft hover:bg-white"
              onClick={() => {
                router.push('/get-care?mode=voice');
              }}
              type="button"
            >
              <Mic aria-hidden className="size-5" />
            </button>
            <button
              aria-label={t('submitLabel')}
              className="grid size-12 shrink-0 place-items-center rounded-xl bg-indigo-800 text-white transition-colors hover:bg-indigo-700"
              type="submit"
            >
              <ArrowRight aria-hidden className="size-5" />
            </button>
          </div>
        </form>

        {/*
          Horizontally scrollable rather than wrapped: on a 375px screen a
          wrapped chip list becomes three stacked rows and pushes everything
          below it off the first screen.
        */}
        <ul
          aria-label={t('quickLabel')}
          className="mt-3 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {QUICK_KEYS.map((key) => (
            <li key={key}>
              <button
                className="inline-flex min-h-11 items-center rounded-pill bg-white px-4 text-sm font-medium whitespace-nowrap text-ink ring-1 ring-line transition-colors hover:bg-indigo-50 hover:ring-indigo-200"
                onClick={() => {
                  submit(t(`quick.${key}`));
                }}
                type="button"
              >
                {t(`quick.${key}`)}
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs leading-relaxed text-ink-soft">{t('disclaimer')}</p>
      </div>
    </section>
  );
}

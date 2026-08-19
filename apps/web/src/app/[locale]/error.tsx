'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { Button, ButtonLink } from '@/components/ui/Button';

/**
 * Next's error-boundary convention for `[locale]` — must be a client
 * component (Next's requirement for `error.tsx`), so this uses the client
 * `useTranslations` hook rather than `getTranslations`. It reads the
 * ambient locale from `NextIntlClientProvider`, which the parent layout
 * already set up correctly before this boundary could ever mount (a render
 * error only fires after the layout itself rendered successfully), so no
 * explicit locale plumbing is needed here either — same reasoning as
 * `NotFoundView`, different mechanism because this file runs client-side.
 *
 * No error-reporting call here: this repo has no error-tracking service
 * wired in yet, and inventing one would be scope creep on an unstyled-page
 * fix. `reset()` is the one native affordance — it tries the failed
 * segment's render again in place, e.g. after a flaky fetch.
 */
export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errorBoundary');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="bg-paper py-16">
      <div className="container-site max-w-xl text-center">
        <h1 className="text-2xl font-bold text-ink">{t('heading')}</h1>
        <p className="mt-2 text-sm text-ink-soft">{t('body')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={reset} variant="primary">
            {t('retry')}
          </Button>
          <ButtonLink href="/" variant="secondary">
            {t('cta')}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

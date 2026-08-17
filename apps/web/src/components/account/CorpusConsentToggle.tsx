'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { hasCorpusConsent, type CorpusConsentGrant } from '@swasthya/language-corpus';

import { FormError } from '@/components/ui/FormError';
import { cn } from '@/lib/cn';
import { grantCorpusConsent, revokeCorpusConsent } from '@/lib/corpus-consent-api';

const KIND = 'HEALTH_CONVERSATION_AUDIO';

/**
 * The account-page half of Round six §M — `docs/product/freemium-and-voice-corpus.md`
 * §4 stream B: "a clear toggle, off by default, ... shown in the account
 * page". Only `HEALTH_CONVERSATION_AUDIO` is offered here, not
 * `VOICE_CONTRIBUTION` (stream A) — that flow is a separate, non-health
 * `/contribute` page with its own consent gate; `AccountView` links to it
 * directly rather than duplicating a second toggle for it here.
 *
 * A single native `<input type="checkbox">` switch, the same accessibility
 * shape `DataConsentView.tsx` already established for the same reason: a
 * custom ARIA role is unnecessary when a real checkbox already does the job.
 * Unlike `DataConsentView`, this one is backed by a real account
 * (`useCorpusConsent`, `apps/api`'s `LanguageCorpusController`), not
 * browser-tab-only state.
 */
export function CorpusConsentToggle({
  state,
  onChanged,
}: {
  state: 'loading' | { grants: readonly CorpusConsentGrant[] };
  onChanged: () => void;
}) {
  const t = useTranslations('account.corpusConsent');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grants = state === 'loading' ? [] : state.grants;
  const checked = hasCorpusConsent(grants, KIND, new Date().toISOString());
  const inputId = 'corpus-consent-health-conversation-audio';
  const descId = `${inputId}-description`;

  async function toggle(next: boolean) {
    setError(null);
    setPending(true);
    try {
      if (next) await grantCorpusConsent(KIND);
      else await revokeCorpusConsent(KIND);
      onChanged();
    } catch {
      setError(t('errors.GENERIC'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-sand/70 p-6 ring-1 ring-line">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="flex-1">
          <label className="text-xl font-bold text-ink" htmlFor={inputId}>
            {t('heading')}
          </label>
          <p className="mt-2 leading-relaxed text-ink-soft" id={descId}>
            {t('body')}
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-3 sm:pt-1" htmlFor={inputId}>
          <span aria-hidden className="text-sm font-semibold text-ink-soft">
            {checked ? t('onLabel') : t('offLabel')}
          </span>
          <span
            aria-hidden
            className={cn(
              'relative inline-flex h-7 w-12 items-center rounded-pill transition-colors',
              checked ? 'bg-indigo-700' : 'bg-line',
              pending || state === 'loading' ? 'opacity-60' : '',
            )}
          >
            <span
              className={cn('inline-block size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')}
            />
          </span>
          <input
            aria-describedby={descId}
            checked={checked}
            className="sr-only"
            disabled={pending || state === 'loading'}
            id={inputId}
            onChange={(event) => void toggle(event.target.checked)}
            type="checkbox"
          />
        </label>
      </div>
      <p className="text-sm text-ink-soft">{t('revocable')}</p>
      <FormError message={error} />
    </div>
  );
}

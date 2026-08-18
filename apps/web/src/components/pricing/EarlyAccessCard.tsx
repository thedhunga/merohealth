'use client';

import { CheckCircle2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import {
  flushEarlyAccess,
  getEarlyAccess,
  normaliseContact,
  registerEarlyAccess,
} from '@/lib/early-access';

/**
 * "Premium personalised features are coming soon — be the first to try."
 *
 * Registers interest on the device (see `lib/early-access.ts`) and hands it
 * to the API when one is configured. Contact is optional: a person who gives
 * nothing is still first in line on this device, which is all the copy
 * promises. Renders the same on every plan; the pricing grid links here.
 */
export function EarlyAccessCard({ source = 'pricing' }: { source?: 'pricing' | 'get-care' }) {
  const t = useTranslations('pricing.comingSoon');
  const inputId = useId();
  const [contact, setContact] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    setRegistered(getEarlyAccess() !== null);
    void flushEarlyAccess(process.env['NEXT_PUBLIC_API_URL']);
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = normaliseContact(contact);
    if (!parsed.ok) {
      setError(t('contactInvalid'));
      return;
    }
    setError(null);
    registerEarlyAccess({ contact: parsed.value, source });
    setRegistered(true);
    void flushEarlyAccess(process.env['NEXT_PUBLIC_API_URL']);
  }

  return (
    <section
      aria-labelledby="early-access-heading"
      className="mx-auto max-w-2xl scroll-mt-24 rounded-card border border-marigold-300 bg-marigold-100/50 p-6 sm:p-8"
      id="early-access"
    >
      <p className="flex items-center gap-2 text-sm font-bold tracking-wide text-marigold-800 uppercase">
        <Sparkles aria-hidden className="size-4" />
        {t('badge')}
      </p>
      <h2 className="mt-2 text-2xl font-black text-ink" id="early-access-heading">
        {t('heading')}
      </h2>
      <p className="mt-2 leading-relaxed text-ink-soft">{t('body')}</p>

      {registered ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-white/80 p-4" role="status">
          <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-indigo-700" />
          <div>
            <p className="font-bold text-ink">{t('success')}</p>
            <p className="mt-1 text-sm text-ink-soft">{t('successBody')}</p>
          </div>
        </div>
      ) : (
        <form className="mt-6 flex flex-col gap-3" noValidate onSubmit={submit}>
          <label className="text-sm font-semibold text-ink" htmlFor={inputId}>
            {t('contactLabel')}
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              autoComplete="tel"
              className="min-h-11 flex-1 rounded-xl border border-line bg-white px-4 text-base text-ink placeholder:text-ink-soft/70 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              id={inputId}
              inputMode="text"
              onChange={(e) => setContact(e.target.value)}
              placeholder={t('contactPlaceholder')}
              type="text"
              value={contact}
            />
            <Button className="justify-center" type="submit" variant="accent">
              {t('submit')}
            </Button>
          </div>
          <FormError message={error} />
          <p className="text-xs leading-relaxed text-ink-soft">{t('privacy')}</p>
        </form>
      )}
    </section>
  );
}

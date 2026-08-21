'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/cn';
import { useTheme } from '@/hooks/useTheme';

const INPUT_ID = 'account-theme-dark';

/**
 * Round seven, task T's one control: "toggle in the account/menu". Same
 * native-checkbox switch shape `CorpusConsentToggle` already established —
 * a custom ARIA role buys nothing a real checkbox doesn't already give for
 * free. Unlike that toggle, this one is synchronous and device-local
 * (`useTheme`, `localStorage`) rather than account-backed — there is no
 * server concept of a person's theme.
 */
export function ThemeToggle() {
  const t = useTranslations('account.theme');
  const { theme, toggle } = useTheme();
  const checked = theme === 'dark';
  const descId = `${INPUT_ID}-description`;

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-sand/70 p-6 ring-1 ring-line">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="flex-1">
          <label className="text-xl font-bold text-ink" htmlFor={INPUT_ID}>
            {t('heading')}
          </label>
          <p className="mt-2 leading-relaxed text-ink-soft" id={descId}>
            {t('body')}
          </p>
        </div>
        {/*
          `min-h-11` floors the label at 44px — it's the actual tap target
          (wraps the `sr-only` checkbox) but `items-center` otherwise caps its
          height at the `h-7` switch pill inside it. Same fix as `FaqList`'s
          `<summary>` row.
        */}
        <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-3 sm:pt-1" htmlFor={INPUT_ID}>
          <span aria-hidden className="text-sm font-semibold text-ink-soft">
            {checked ? t('darkLabel') : t('lightLabel')}
          </span>
          <span
            aria-hidden
            className={cn(
              'relative inline-flex h-7 w-12 items-center rounded-pill transition-colors',
              checked ? 'bg-indigo-700' : 'bg-line',
            )}
          >
            <span
              className={cn(
                'inline-block size-5 rounded-full bg-surface shadow transition-transform',
                checked ? 'translate-x-6' : 'translate-x-1',
              )}
            />
          </span>
          <input
            aria-describedby={descId}
            checked={checked}
            className="sr-only"
            id={INPUT_ID}
            onChange={toggle}
            type="checkbox"
          />
        </label>
      </div>
    </div>
  );
}

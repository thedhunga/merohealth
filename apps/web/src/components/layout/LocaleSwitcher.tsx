'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { Globe } from 'lucide-react';

import { usePathname, useRouter } from '@/i18n/navigation';
import { locales, type Locale } from '@/i18n/routing';
import { cn } from '@/lib/cn';

const labels: Record<Locale, string> = {
  ne: 'नेपाली',
  en: 'English',
};

export function LocaleSwitcher({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const t = useTranslations('nav.actions');
  const active = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const select = (next: Locale) => {
    if (next === active) return;
    startTransition(() => {
      // `usePathname` returns the locale-independent path, so switching keeps
      // the visitor on the same page rather than sending them home.
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <div
      aria-label={t('languageLabel')}
      className={cn(
        'flex items-center gap-1 rounded-pill p-1',
        tone === 'dark' ? 'bg-sand' : 'bg-white/10',
        pending && 'opacity-70',
      )}
      role="group"
    >
      <Globe
        aria-hidden
        className={cn('ms-2 size-4', tone === 'dark' ? 'text-ink-soft' : 'text-jade-100')}
      />
      {locales.map((locale) => (
        <button
          aria-current={locale === active ? 'true' : undefined}
          className={cn(
            'rounded-pill px-3 py-1.5 text-sm font-semibold transition-colors',
            locale === active
              ? tone === 'dark'
                ? 'bg-white text-forest-700 shadow-sm'
                : 'bg-white text-forest-700'
              : tone === 'dark'
                ? 'text-ink-soft hover:text-ink'
                : 'text-jade-100 hover:text-white',
          )}
          key={locale}
          onClick={() => {
            select(locale);
          }}
          type="button"
        >
          {labels[locale]}
        </button>
      ))}
    </div>
  );
}

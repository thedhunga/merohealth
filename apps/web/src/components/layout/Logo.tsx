import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

/**
 * Brand lockup. Mirrors the mark used in the Expo product surface so the
 * marketing site and the app read as one product.
 */
export function Logo({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const t = useTranslations('brand');

  return (
    <Link
      aria-label={t('name')}
      className="inline-flex items-center gap-3 rounded-xl"
      href="/"
    >
      <span
        aria-hidden
        className="grid size-11 place-items-center rounded-[0.875rem] bg-linear-to-br from-indigo-400 to-indigo-800 text-xl font-bold text-white shadow-sm"
      >
        म
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'text-[0.8125rem] font-bold tracking-[0.14em]',
            tone === 'dark' ? 'text-ink' : 'text-white',
          )}
        >
          {t('nameLatin')}
        </span>
        <span
          className={cn(
            'mt-1 text-sm font-medium',
            tone === 'dark' ? 'text-accent-text' : 'text-indigo-200',
          )}
        >
          मेरो स्वास्थ्य
        </span>
      </span>
    </Link>
  );
}

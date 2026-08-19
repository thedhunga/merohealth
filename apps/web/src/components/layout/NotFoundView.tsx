import { getTranslations } from 'next-intl/server';

import { ButtonLink } from '@/components/ui/Button';

/**
 * Rendered by `[locale]/not-found.tsx` when a page inside a valid locale
 * segment calls `notFound()` itself — a stale `/health-library/[slug]`
 * link is the one real caller today. See that file's own doc comment for
 * the broader "mistyped URL" case this does *not* reach and why. The App
 * Router's own default 404 is unstyled and English-only, which is exactly
 * wrong for a Nepali-first, mobile-first health app: this is the page a
 * confused visitor from a stale link actually lands on.
 *
 * No explicit `locale` prop, unlike `OfflineView`: Next's `not-found.tsx`
 * convention does not reliably hand a segment's dynamic params to the
 * component, so this uses `getTranslations`'s ambient-locale form instead —
 * it resolves from the same `requestLocale` (URL-derived, not params-derived)
 * that `src/i18n/request.ts` already reads, and is next-intl's documented
 * mechanism for exactly this case.
 */
export async function NotFoundView() {
  const t = await getTranslations('notFound');

  return (
    <section className="bg-paper py-16">
      <div className="container-site max-w-xl text-center">
        <h1 className="text-2xl font-bold text-ink">{t('heading')}</h1>
        <p className="mt-2 text-sm text-ink-soft">{t('body')}</p>
        <ButtonLink href="/" className="mt-6">
          {t('cta')}
        </ButtonLink>
      </div>
    </section>
  );
}

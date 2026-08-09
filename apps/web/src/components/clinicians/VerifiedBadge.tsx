import { useLocale, useTranslations } from 'next-intl';
import type { CredentialingBadge } from '@swasthya/shared-types';

import { cn } from '@/lib/cn';
import { councilName } from '@/lib/council-name';
import { formatDate } from '@/lib/format-date';
import { verifiedBadgeViewModel } from '@/lib/verified-badge';

/**
 * identity-and-credentialing.md §3 step 5's badge, rendered exactly as
 * specified: which council, which number, when it was last checked — never
 * "trusted doctor" (§3's "never claim more than was checked"). Takes an
 * already-issued `CredentialingBadge` as a prop rather than fetching or
 * re-deriving trust itself; per §5, a verified badge "must never be computed
 * live from a service that can fail," so this only ever reads the badge's
 * own persisted fields. `now` is passed in rather than read from `Date.now()`
 * here, matching this codebase's own "clock reads happen at the boundary"
 * convention for every domain package this ledger has built so far.
 *
 * Nothing in this repository calls `issueBadge` from `packages/credentialing`
 * yet — `apps/api`'s credentialing `approve` endpoint records an `APPROVED`
 * application but never issues or persists a badge from it (see
 * `agent-progress.md`) — so this component has no live caller today. It is
 * built and tested against the real `CredentialingBadge` shape so the next
 * run that wires badge issuance has something correct to render into.
 */
export function VerifiedBadge({ badge, now }: { badge: CredentialingBadge; now: string }) {
  const t = useTranslations('clinicians.verifiedBadge');
  const locale = useLocale();
  const view = verifiedBadgeViewModel(badge, now);
  const verified = view.status === 'VERIFIED';

  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-2xl p-4 ring-1',
        verified ? 'bg-jade-50 ring-jade-200' : 'bg-sand/70 ring-line',
      )}
      role="status"
    >
      <p
        className={cn(
          'text-sm font-semibold tracking-wide uppercase',
          verified ? 'text-jade-700' : 'text-ink-soft',
        )}
      >
        {verified ? t('statusVerified') : t('statusUnverified')}
      </p>
      <p className="font-semibold text-ink">{t('councilLine', { council: councilName(view.council, locale) })}</p>
      <p className="text-ink-soft">{t('numberLine', { number: view.registrationNumber })}</p>
      <p className="text-sm text-ink-soft">{t('lastCheckedLine', { date: formatDate(view.lastCheckedAt, locale) })}</p>
    </div>
  );
}

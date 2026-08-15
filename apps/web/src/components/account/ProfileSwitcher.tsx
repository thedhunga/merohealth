'use client';

import type { ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/cn';
import type { ActingSubject } from '@/lib/acting-subjects';

/**
 * family-and-proxy.md §1's web half of the switcher `apps/mobile`'s
 * `ProfileSwitcher.tsx` already proved: whose record is open must always be
 * visible, and acting for someone else must never look like acting for
 * yourself. A native `<select>` rather than mobile's custom sheet — the web
 * has an accessible built-in picker, so a hand-rolled disclosure would be
 * extra surface for no benefit — disabled to a plain, unclickable pill
 * whenever there is nothing to switch to (`subjects.length === 1`, the only
 * case reachable today; see `AccountView.tsx`'s own comment on why).
 */
export function ProfileSwitcher({
  subjects,
  active,
  onSwitch,
}: {
  subjects: readonly ActingSubject[];
  active: ActingSubject;
  onSwitch: (subjectId: string) => void;
}) {
  const t = useTranslations('account.switcher');
  const canSwitch = subjects.length > 1;

  function relationshipSuffix(subject: ActingSubject): string {
    if (subject.relationship === 'GUARDIAN') return ` · ${t('guardianSuffix')}`;
    if (subject.relationship === 'DELEGATE') return ` · ${t('delegateSuffix')}`;
    return '';
  }

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    onSwitch(event.target.value);
  }

  // Mirrors `apps/mobile`'s `ProfileSwitcher` exactly: SELF stays neutral,
  // anything else (guarding or delegating) gets the marigold-family
  // treatment mobile already uses for it (`saffronSoft`/`saffronDeep` in
  // `@swasthya/configuration`, the same #FDF0D8/#9A5C08 pair as
  // `marigold-100`/`marigold-700` here) — not the "one action per screen"
  // accent marigold, a status indicator that happens to share the palette.
  const pillClasses = cn(
    'inline-flex items-center gap-2 rounded-pill border px-4 py-2 text-sm font-semibold',
    active.relationship === 'SELF' ? 'border-line bg-white text-ink' : 'border-marigold-700/40 bg-marigold-100 text-marigold-700',
  );

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-ink-soft" id="acting-subject-label">
        {t('label')}
      </span>
      {canSwitch ? (
        <select
          aria-labelledby="acting-subject-label"
          className={cn(pillClasses, 'cursor-pointer appearance-none')}
          onChange={handleChange}
          value={active.id}
        >
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.displayName}
              {relationshipSuffix(subject)}
            </option>
          ))}
        </select>
      ) : (
        <span aria-labelledby="acting-subject-label" className={pillClasses} role="status">
          {active.displayName}
          {relationshipSuffix(active)}
        </span>
      )}
    </div>
  );
}

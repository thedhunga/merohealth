'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import {
  clearPendingProfileConfirmation,
  readPendingProfileConfirmation,
  type PendingProfileConfirmation,
} from '@/lib/anonymous-history';
import { confirmTwinProfile } from '@/lib/profile-api';

type Status = 'idle' | 'saving' | 'error';

/**
 * Round four F2. Shows back exactly what an anonymous chip tap already
 * offered — read once from the local stash `migrateAnonymousHistory` leaves
 * behind, never re-fetched from the server — and turns it into confirmed
 * twin facts only on an explicit tap. Mirrors `ProfilePromptCard`'s own
 * chip-plus-skip shape on the anonymous side of `GetCareFlow.tsx`, because
 * "a chip tap on the homepage is a hint, not a clinical fact" (the ledger's
 * own words for this task) applies just as much to the review step as it did
 * to the original tap.
 *
 * Renders nothing when there is nothing pending — true for most visits to
 * `/account`, including every one after the person has confirmed or
 * skipped once.
 */
export function ProfileConfirmationCard() {
  const t = useTranslations('account.profileConfirmation');
  const promptsT = useTranslations('getCare.profilePrompts');
  const [pending, setPending] = useState<PendingProfileConfirmation | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  // `localStorage` is unavailable during SSR, so this starts `null` (nothing
  // shown) and only ever populates after mount — the same pattern
  // `PhoneOtpFlow`'s `next` state already uses for the same reason.
  useEffect(() => {
    setPending(readPendingProfileConfirmation());
  }, []);

  if (!pending) return null;

  const items: string[] = [];
  if (pending.ageBand) items.push(promptsT(`ageBand.options.${pending.ageBand}`));
  if (pending.askingFor) items.push(promptsT(`askingFor.options.${pending.askingFor}`));
  for (const condition of pending.conditions ?? []) {
    items.push(promptsT(`chronicCondition.options.${condition}`));
  }

  // Arrow functions, not hoisted `function` declarations — TS only carries
  // the `if (!pending) return null;` narrowing above into a closure defined
  // after that check, not into a hoisted one.
  const handleSave = async () => {
    setStatus('saving');
    const ok = await confirmTwinProfile(pending);
    if (ok) {
      clearPendingProfileConfirmation();
      setPending(null);
    } else {
      setStatus('error');
    }
  };

  const handleSkip = () => {
    clearPendingProfileConfirmation();
    setPending(null);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-sand/70 p-6 ring-1 ring-line">
      <div>
        <h2 className="text-xl font-bold text-ink">{t('heading')}</h2>
        <p className="mt-1 text-ink-soft">{t('body')}</p>
      </div>

      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li className="inline-flex min-h-11 items-center rounded-pill bg-white px-4 text-sm font-medium text-ink ring-1 ring-line" key={item}>
            {item}
          </li>
        ))}
      </ul>

      {status === 'error' ? (
        <p className="text-sm font-semibold text-red-700" role="alert">
          {t('error')}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={status === 'saving'} onClick={() => void handleSave()} variant="secondary">
          {t('saveCta')}
        </Button>
        <button
          className="inline-flex min-h-11 items-center px-3 text-sm text-ink-soft underline-offset-4 hover:underline"
          onClick={handleSkip}
          type="button"
        >
          {t('skipCta')}
        </button>
      </div>
    </div>
  );
}

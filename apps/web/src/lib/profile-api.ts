/**
 * Web client for `apps/api`'s `POST /twin/confirm-profile` — Round four F2,
 * the only caller of the route that turns a confirmed anonymous-profile hint
 * into `PATIENT_REPORTED`/`PATIENT_CONFIRMED` twin facts. Shaped after
 * `history-api.ts`: `credentials: 'include'`, and a boolean success return
 * rather than a thrown error, because the caller's own contract
 * (`ProfileConfirmationCard`) only needs to know whether it is safe to clear
 * the pending stash — never blocking the person from continuing to use the
 * account page either way.
 */

import type { PendingProfileConfirmation } from './anonymous-history';

function twinUrl(path: string): string {
  const configured = process.env['NEXT_PUBLIC_API_URL']?.replace(/\/$/, '');
  return `${configured ?? 'http://localhost:4000'}/v1/twin${path}`;
}

/**
 * Posts exactly the fields the person chose to keep. Never throws: a failed
 * confirm must not disrupt `/account`, which has real, working content
 * regardless — the pending stash simply stays in `localStorage` so the card
 * can be tried again on a later visit, the same retry-safety
 * `migrateAnonymousHistory` already gives the migration step.
 */
export async function confirmTwinProfile(input: PendingProfileConfirmation): Promise<boolean> {
  try {
    const response = await fetch(twinUrl('/confirm-profile'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Web client for `apps/api`'s `POST /history/migrate` — Round four F1, the
 * server half of the anonymous → account history migration the doc comment
 * on `snapshotForMigration()` (`anonymous-history.ts`) has been waiting for.
 * Shaped after `family-api.ts`: same `credentials: 'include'`, same small
 * typed error carrying the machine-readable `code` back to the caller.
 *
 * Deliberately no retry loop here — the caller (`migrateAnonymousHistory`)
 * already gets that for free from the server's own idempotency: a second
 * call with the same `anonymousId` is a safe no-op, so the simplest correct
 * client is "try once, and only clear local state on success."
 */

import { clearAfterMigration, snapshotForMigration } from './anonymous-history';

export interface HistoryApiErrorBody {
  code?: string;
  message?: string;
}

export class HistoryApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'HistoryApiError';
    this.code = code;
  }
}

function historyUrl(path: string): string {
  const configured = process.env['NEXT_PUBLIC_API_URL']?.replace(/\/$/, '');
  return `${configured ?? 'http://localhost:4000'}/v1/history${path}`;
}

/**
 * Called once, right after `verifyOtp` (and later the Google credential
 * exchange) succeeds and a `mero_session` cookie exists — `POST
 * /history/migrate` is guarded and needs one. Never throws: a failed
 * migration must not block the sign-in the person is already mid-way
 * through, and per `snapshotForMigration`'s own contract, `clearAfterMigration`
 * only runs once the server has actually confirmed the exchanges landed, so
 * a 500 here leaves `localStorage` exactly as it was — safe to retry on the
 * next sign-in.
 */
export async function migrateAnonymousHistory(): Promise<void> {
  const snapshot = snapshotForMigration();
  if (snapshot.store.exchanges.length === 0 && !hasProfileData(snapshot.store.profile)) {
    return;
  }
  try {
    const response = await fetch(historyUrl('/migrate'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
    if (!response.ok) return;
    clearAfterMigration();
  } catch {
    // Network failure: leave localStorage in place, exactly like a 500 —
    // the next successful sign-in retries the same idempotent migration.
  }
}

function hasProfileData(profile: ReturnType<typeof snapshotForMigration>['store']['profile']): boolean {
  return Boolean(profile.ageBand || profile.askingFor || (profile.conditions && profile.conditions.length > 0));
}

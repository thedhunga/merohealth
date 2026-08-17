/**
 * Web client for `apps/api`'s `GET/POST /language-corpus/consent*` routes —
 * the account-page half of Round six §M's `Consent` record. Shaped after
 * `family-api.ts`: same `credentials: 'include'` so the `mero_session`
 * cookie rides along, same typed error carrying the machine-readable `code`
 * back to the caller, same base-URL fallback to `localhost:4000` for local
 * development against an undeployed `apps/api`.
 */

import type { CorpusConsentGrant, CorpusConsentKind } from '@swasthya/language-corpus';

export interface CorpusConsentApiErrorBody {
  code?: string;
  message?: string;
}

export class CorpusConsentApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'CorpusConsentApiError';
    this.code = code;
  }
}

function corpusConsentUrl(path: string): string {
  const configured = process.env['NEXT_PUBLIC_API_URL']?.replace(/\/$/, '');
  return `${configured ?? 'http://localhost:4000'}/v1/language-corpus/consent${path}`;
}

async function request(path: string, method: 'GET' | 'POST'): Promise<{ grants: readonly CorpusConsentGrant[] }> {
  const response = await fetch(corpusConsentUrl(path), { method, credentials: 'include' });
  const parsed = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const error = (parsed as CorpusConsentApiErrorBody | null) ?? {};
    throw new CorpusConsentApiError(error.message ?? `Request failed (${response.status})`, error.code ?? null);
  }
  return parsed as { grants: readonly CorpusConsentGrant[] };
}

/** Every corpus-consent grant for the signed-in user, including revoked ones — the account toggle's source of truth for its current on/off state. */
export async function getCorpusConsentGrants(): Promise<readonly CorpusConsentGrant[]> {
  const { grants } = await request('', 'GET');
  return grants;
}

export async function grantCorpusConsent(kind: CorpusConsentKind): Promise<CorpusConsentGrant> {
  const response = await fetch(corpusConsentUrl(`/${kind}/grant`), { method: 'POST', credentials: 'include' });
  const parsed = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const error = (parsed as CorpusConsentApiErrorBody | null) ?? {};
    throw new CorpusConsentApiError(error.message ?? `Request failed (${response.status})`, error.code ?? null);
  }
  return parsed as CorpusConsentGrant;
}

export async function revokeCorpusConsent(kind: CorpusConsentKind): Promise<readonly CorpusConsentGrant[]> {
  const { grants } = await request(`/${kind}/revoke`, 'POST');
  return grants;
}

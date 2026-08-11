/**
 * Web client for `apps/api`'s `GET /family/grants` — the endpoint
 * `AccountView.tsx`'s `buildActingSubjects` call has been passing `[]`/`[]`
 * to since Round two D2, honestly, because nothing exposed the real data.
 * Shaped after `auth-api.ts`: same `credentials: 'include'` so the
 * `mero_session` cookie rides along, same typed error carrying the
 * machine-readable `code` back to the caller. A separate small error class
 * rather than importing `AuthApiError` — this endpoint isn't part of the
 * auth surface, and the shape is small enough that duplicating it costs
 * less than the cross-module naming mismatch would.
 */

import type { DelegationGrant, GuardianshipGrant } from '@swasthya/family';

export interface FamilyApiErrorBody {
  code?: string;
  message?: string;
}

export class FamilyApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'FamilyApiError';
    this.code = code;
  }
}

function familyUrl(path: string): string {
  const configured = process.env['NEXT_PUBLIC_API_URL']?.replace(/\/$/, '');
  return `${configured ?? 'http://localhost:4000'}/v1/family${path}`;
}

export interface SubjectGrantsResponse {
  guardianships: readonly GuardianshipGrant[];
  delegations: readonly DelegationGrant[];
}

/**
 * Every guardianship/delegation grant where the signed-in subject is the
 * guardian or the delegate — not yet filtered to active-at-`now`, the same
 * contract `FamilyGrantsService` documents server-side.
 * `buildActingSubjects` (`acting-subjects.ts`) applies that filter, via
 * `listActiveGuardianshipsFor`/`listActiveDelegationsFor`, on the result.
 */
export async function getFamilyGrants(): Promise<SubjectGrantsResponse> {
  const response = await fetch(familyUrl('/grants'), { method: 'GET', credentials: 'include' });
  const parsed = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const error = (parsed as FamilyApiErrorBody | null) ?? {};
    throw new FamilyApiError(error.message ?? `Request failed (${response.status})`, error.code ?? null);
  }
  return parsed as SubjectGrantsResponse;
}

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

import type { DelegationGrant, DelegationScope, GuardianshipGrant } from '@swasthya/family';

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
  /** Delegations the signed-in subject granted to someone else — the read side `revokeDelegation` needs. */
  delegationsGranted: readonly DelegationGrant[];
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

export interface CreateDelegationInput {
  delegatePhone: string;
  scopes: readonly DelegationScope[];
  expiresAt: string;
}

/**
 * Client for `POST /family/grants/delegations` — self-service delegation
 * only, the same restriction `FamilyGrantsService.createDelegation`
 * documents server-side. The signed-in visitor is always the granter; there
 * is no field for one here, the same reason `RecordsController`'s capture
 * endpoint has no client-supplied owner id.
 */
export async function createDelegation(input: CreateDelegationInput): Promise<DelegationGrant> {
  const response = await fetch(familyUrl('/grants/delegations'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const parsed = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const error = (parsed as FamilyApiErrorBody | null) ?? {};
    throw new FamilyApiError(error.message ?? `Request failed (${response.status})`, error.code ?? null);
  }
  return parsed as DelegationGrant;
}

/**
 * Client for `DELETE /family/grants/delegations/:id` — revokes a delegation
 * the signed-in visitor granted as granter. The server checks ownership
 * itself (`FamilyGrantsService.revokeDelegation`) and 404s a grant that
 * exists but belongs to someone else, so this carries no `granterId` — the
 * same reason `createDelegation` above carries no `delegatePhone`-adjacent
 * caller id.
 */
export async function revokeDelegation(delegationId: string): Promise<DelegationGrant> {
  const response = await fetch(familyUrl(`/grants/delegations/${delegationId}`), { method: 'DELETE', credentials: 'include' });
  const parsed = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const error = (parsed as FamilyApiErrorBody | null) ?? {};
    throw new FamilyApiError(error.message ?? `Request failed (${response.status})`, error.code ?? null);
  }
  return parsed as DelegationGrant;
}

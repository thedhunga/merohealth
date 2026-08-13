/**
 * Web client for `apps/api`'s `/identity/verification/*` self-service routes
 * — `GET verification/me` and `POST verification/evidence`, the two the
 * 2026-08-13 `apps/api/src/identity/` build shipped but never wired a caller
 * to. Shaped after `credentialing-api.ts`: same `credentials: 'include'` so
 * the `mero_session` cookie rides along, same typed error carrying the
 * machine-readable `code` back to the caller.
 */

import type { IdentityDocumentType, VerificationRequest } from '@swasthya/shared-types';

export interface IdentityApiErrorBody {
  code?: string;
  message?: string;
}

export class IdentityApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'IdentityApiError';
    this.code = code;
  }
}

function identityUrl(path: string): string {
  const configured = process.env['NEXT_PUBLIC_API_URL']?.replace(/\/$/, '');
  return `${configured ?? 'http://localhost:4000'}/v1/identity${path}`;
}

async function parseOrThrow(response: Response): Promise<unknown> {
  const parsed = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const error = (parsed as IdentityApiErrorBody | null) ?? {};
    throw new IdentityApiError(error.message ?? `Request failed (${response.status})`, error.code ?? null);
  }
  return parsed;
}

/** The signed-in caller's own verification status — `NOT_STARTED` for a first-time visitor. */
export async function getMyVerification(): Promise<VerificationRequest> {
  const response = await fetch(identityUrl('/verification/me'), { method: 'GET', credentials: 'include' });
  return (await parseOrThrow(response)) as VerificationRequest;
}

export interface SubmitIdentityEvidenceInput {
  documentType: IdentityDocumentType;
  evidenceImageRef: string;
}

/**
 * The signed-in visitor is always the owner — `IdentityController.submit`
 * derives `ownerId` from the session, the same reason
 * `submitCredentialingApplication` carries no caller-supplied applicant id.
 */
export async function submitIdentityEvidence(input: SubmitIdentityEvidenceInput): Promise<VerificationRequest> {
  const response = await fetch(identityUrl('/verification/evidence'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return (await parseOrThrow(response)) as VerificationRequest;
}

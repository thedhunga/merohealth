/**
 * Web client for `apps/api`'s `POST /credentialing/applications` — replaces
 * `clinician-application.ts`'s purely client-side `submitApplication` call,
 * which had nowhere to send the result because the route had no
 * `SessionAuthGuard` yet and `apps/web` had no session mechanism to attach to
 * one. Both are true now (see `credentialing.controller.ts`'s own history
 * note on `submit()` and `auth-api.ts`), so a submission here is a real row a
 * reviewer's queue will actually see. Shaped after `family-api.ts`: same
 * `credentials: 'include'` so the `mero_session` cookie rides along, same
 * typed error carrying the machine-readable `code` back to the caller.
 */

import type { CouncilKey, CredentialingApplication } from '@swasthya/shared-types';

export interface CredentialingApiErrorBody {
  code?: string;
  message?: string;
}

export class CredentialingApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'CredentialingApiError';
    this.code = code;
  }
}

function credentialingUrl(path: string): string {
  const configured = process.env['NEXT_PUBLIC_API_URL']?.replace(/\/$/, '');
  return `${configured ?? 'http://localhost:4000'}/v1/credentialing${path}`;
}

export interface SubmitCredentialingApplicationInput {
  council: CouncilKey;
  registrationNumber: string;
  certificateImageRef: string;
  identityImageRef: string;
}

/**
 * The signed-in visitor is always the applicant — `CredentialingController.submit`
 * derives `applicantId` from the session, the same reason `createDelegation`
 * carries no caller-supplied id of its own.
 */
export async function submitCredentialingApplication(
  input: SubmitCredentialingApplicationInput,
): Promise<CredentialingApplication> {
  const response = await fetch(credentialingUrl('/applications'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const parsed = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const error = (parsed as CredentialingApiErrorBody | null) ?? {};
    throw new CredentialingApiError(error.message ?? `Request failed (${response.status})`, error.code ?? null);
  }
  return parsed as CredentialingApplication;
}

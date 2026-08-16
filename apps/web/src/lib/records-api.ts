/**
 * Web client for `apps/api`'s records module — Round four F4, the first
 * `apps/web` caller of document capture and observation confirmation.
 * `apps/mobile`'s `records-api.ts` already talks to the same routes but
 * without a session (mobile has no sign-in flow yet); this file is shaped
 * after `profile-api.ts`/`history-api.ts` instead: `credentials: 'include'`
 * and a null-on-failure return rather than a thrown error, because a failed
 * read or write here must never break the rest of `/account`.
 */

import type { HealthDocument, HealthObservation } from '@swasthya/shared-types';

function recordsUrl(path: string): string {
  const configured = process.env['NEXT_PUBLIC_API_URL']?.replace(/\/$/, '');
  return `${configured ?? 'http://localhost:4000'}/v1/records${path}`;
}

/** Browser-only: no `Buffer` on the client, so bytes go through `btoa` by hand. */
async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export interface CaptureBloodPressurePhotoInput {
  file: File;
  title: string;
}

/**
 * Captures a photograph as an `OTHER`-kind document — there is no dedicated
 * document kind for a device-reading photo yet, and inventing one is outside
 * this round's scope — with no `documentDate`, so the server falls back to
 * the capture instant (`RecordsService`'s own rule). Returns the saved
 * document on success; its `status` already reflects whatever extraction
 * managed to do before this call returned, since capture runs it inline.
 * Never throws: a failed capture shows an error in the UI, but nothing about
 * the rest of `/account` depends on it.
 */
export async function captureBloodPressurePhoto(
  input: CaptureBloodPressurePhotoInput,
): Promise<HealthDocument | null> {
  try {
    const bytesBase64 = await fileToBase64(input.file);
    const response = await fetch(recordsUrl('/documents'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: input.file.name || 'blood-pressure.jpg',
        kind: 'OTHER',
        title: input.title,
        contentType: input.file.type || 'image/jpeg',
        bytesBase64,
      }),
    });
    if (!response.ok) return null;
    return (await response.json()) as HealthDocument;
  } catch {
    return null;
  }
}

async function fetchItems(path: string): Promise<HealthObservation[] | null> {
  try {
    const response = await fetch(recordsUrl(path), { credentials: 'include' });
    if (!response.ok) return null;
    const body = (await response.json()) as { items: HealthObservation[] };
    return body.items;
  } catch {
    return null;
  }
}

/** The DRAFT observations one just-captured document produced, for the confirmation card. */
export function fetchDocumentObservations(documentId: string): Promise<HealthObservation[] | null> {
  return fetchItems(`/documents/${encodeURIComponent(documentId)}/observations`);
}

/** Every observation the caller owns, draft included — `buildAnalyteTrend`'s own filtering keeps DRAFT points off the chart. */
export function fetchAllObservations(): Promise<HealthObservation[] | null> {
  return fetchItems('/observations');
}

async function postObservationAction(observationId: string, action: 'confirm' | 'correct' | 'reject'): Promise<boolean> {
  try {
    const response = await fetch(
      recordsUrl(`/observations/${encodeURIComponent(observationId)}/${action}`),
      { method: 'POST', credentials: 'include' },
    );
    return response.ok;
  } catch {
    return false;
  }
}

export function confirmObservation(observationId: string): Promise<boolean> {
  return postObservationAction(observationId, 'confirm');
}

export function rejectObservation(observationId: string): Promise<boolean> {
  return postObservationAction(observationId, 'reject');
}

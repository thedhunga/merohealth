import { pendingConfirmations } from '@swasthya/health-records';
import type { TimelineEntry } from '@swasthya/health-records';
import type { HealthDocument, HealthDocumentKind, HealthObservation } from '@swasthya/shared-types';

/**
 * `EXPO_PUBLIC_*` is the only env-var prefix Expo inlines into the client
 * bundle. Falls back to a same-origin `/api/records/...` path — the same
 * aspirational convention `(tabs)/companion.tsx` already established for a
 * future web deployment behind a reverse proxy; nothing serves that path yet,
 * so a bare `expo start` with no `EXPO_PUBLIC_API_URL` will 404 until one
 * does, exactly like the companion screen's own research call.
 */
function recordsUrl(path: string): string {
  const configured = process.env['EXPO_PUBLIC_API_URL']?.replace(/\/$/, '');
  return configured ? `${configured}/v1/records${path}` : `/api/records${path}`;
}

interface ApiErrorBody {
  code?: string;
  message?: string;
  upgradeTo?: string;
}

/**
 * Carries the entitlements guard's machine-readable `code` (e.g.
 * `QUOTA_EXCEEDED`) and `upgradeTo` forward, so a screen can offer an upgrade
 * instead of a flat failure — the same distinction
 * `apps/api/src/entitlements/entitlements.guard.ts` was built to preserve.
 */
export class RecordsApiError extends Error {
  readonly code: string | null;
  readonly upgradeTo: string | null;

  constructor(message: string, code: string | null, upgradeTo: string | null = null) {
    super(message);
    this.name = 'RecordsApiError';
    this.code = code;
    this.upgradeTo = upgradeTo;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: string;
}

async function requestJson<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await fetch(recordsUrl(path), {
    method: options?.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options?.body,
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const error = (body as ApiErrorBody | null) ?? {};
    throw new RecordsApiError(
      error.message ?? `Request failed (${response.status})`,
      error.code ?? null,
      error.upgradeTo ?? null,
    );
  }
  return body as T;
}

/**
 * No `ownerId` anywhere in this file: Round two A4 moved `POST /documents` to
 * owning the document by the caller's verified session identity rather than a
 * client-supplied field, and every other route on
 * `apps/api/src/records/records.controller.ts` now does the same — a
 * cross-owner read/write gap the 2026-08-13 ledger entry found and closed
 * (the six routes below took a bare, unauthenticated `ownerId` string with no
 * guard at all). This screen has no session to send yet — `apps/mobile` still
 * has no sign-in flow (see `acting-subjects.ts`'s and `local-id.ts`'s own doc
 * comments) — so every call below will 401 against a real server until one
 * exists, the same accepted gap `captureDocument` has been in since A4. Left
 * as-is rather than papering over it, since a records screen that quietly
 * worked would misrepresent that gap as closed.
 */
export interface CaptureDocumentInput {
  filename: string;
  kind: HealthDocumentKind;
  title: string;
  contentType: string;
  bytesBase64: string;
}

export function captureDocument(input: CaptureDocumentInput): Promise<HealthDocument> {
  return requestJson<HealthDocument>('/documents', { method: 'POST', body: JSON.stringify(input) });
}

export async function listDocuments(): Promise<readonly HealthDocument[]> {
  const { items } = await requestJson<{ items: HealthDocument[] }>('/documents');
  return items;
}

export async function listDocumentObservations(
  documentId: string,
): Promise<readonly HealthObservation[]> {
  const { items } = await requestJson<{ items: HealthObservation[] }>(
    `/documents/${encodeURIComponent(documentId)}/observations`,
  );
  return items;
}

export async function listTimeline(): Promise<readonly TimelineEntry[]> {
  const { items } = await requestJson<{ items: TimelineEntry[] }>('/timeline');
  return items;
}

/**
 * Every DRAFT observation across the caller's documents, worst-confidence
 * first — the confirmation queue this screen exists to drive. There is no
 * bulk "all observations" endpoint yet, only one document at a time, so this
 * is a real N+1 against the API: acceptable for a first pass on the same
 * "reference implementation, revisit if it matters" basis
 * `MinioDocumentStore.list()`'s own per-key `statObject` N+1 already set.
 */
export async function listPendingConfirmations(): Promise<readonly HealthObservation[]> {
  const documents = await listDocuments();
  const perDocument = await Promise.all(
    documents.map((document) => listDocumentObservations(document.id)),
  );
  return pendingConfirmations(perDocument.flat());
}

export function confirmObservation(observationId: string): Promise<HealthObservation> {
  return requestJson<HealthObservation>(`/observations/${encodeURIComponent(observationId)}/confirm`, {
    method: 'POST',
  });
}

export function correctObservation(
  observationId: string,
  value: string,
  unit: string | null,
): Promise<HealthObservation> {
  return requestJson<HealthObservation>(`/observations/${encodeURIComponent(observationId)}/correct`, {
    method: 'POST',
    body: JSON.stringify({ value, unit }),
  });
}

export function rejectObservation(observationId: string): Promise<HealthObservation> {
  return requestJson<HealthObservation>(`/observations/${encodeURIComponent(observationId)}/reject`, {
    method: 'POST',
  });
}

/** Re-runs extraction on a document stuck in EXTRACTION_FAILED, from its already-stored bytes. */
export function retryDocumentExtraction(documentId: string): Promise<HealthDocument> {
  return requestJson<HealthDocument>(
    `/documents/${encodeURIComponent(documentId)}/retry-extraction`,
    { method: 'POST' },
  );
}

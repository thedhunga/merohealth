/**
 * Web client for `apps/api`'s `POST /language-corpus/voice-contribution/clips`
 * route — Round six §M's third box. Shaped after `records-api.ts`'s
 * `captureBloodPressurePhoto`: browser bytes go through `btoa` by hand (no
 * `Buffer` on the client) and ride to the server as base64 inside a JSON
 * body, the same shape `captureSchema.bytesBase64` established. Unlike
 * `records-api.ts`'s null-on-failure calls, this throws a typed error
 * carrying the server's machine-readable `code` — `corpus-consent-api.ts`'s
 * own shape — because the recorder view needs to tell "consent required"
 * apart from "too short" apart from "duplicate" to show the right message,
 * not just "something failed".
 */

import type { VoiceClip, VoiceClipSelfReport, VoiceContributionTaskKind } from '@swasthya/language-corpus';

export interface VoiceContributionApiErrorBody {
  code?: string;
  message?: string;
}

export class VoiceContributionApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'VoiceContributionApiError';
    this.code = code;
  }
}

function voiceContributionUrl(path: string): string {
  const configured = process.env['NEXT_PUBLIC_API_URL']?.replace(/\/$/, '');
  return `${configured ?? 'http://localhost:4000'}/v1/language-corpus/voice-contribution${path}`;
}

/** Browser-only: no `Buffer` on the client, so bytes go through `btoa` by hand — same helper `records-api.ts`'s `fileToBase64` uses for a `File`. */
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export interface SubmitVoiceClipParams {
  id: string;
  taskId: string;
  taskKind: VoiceContributionTaskKind;
  selfReport: VoiceClipSelfReport;
  /** `navigator.userAgent` — the caller reads it, this module never touches `navigator` itself so it stays trivially testable without a DOM. */
  device: string;
  durationMs: number;
  blob: Blob;
}

export async function submitVoiceClip(params: SubmitVoiceClipParams): Promise<VoiceClip> {
  const bytesBase64 = await blobToBase64(params.blob);
  const response = await fetch(voiceContributionUrl('/clips'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: params.id,
      taskId: params.taskId,
      taskKind: params.taskKind,
      selfReport: params.selfReport,
      device: params.device,
      durationMs: params.durationMs,
      contentType: params.blob.type || 'audio/webm',
      bytesBase64,
    }),
  });

  const parsed = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const error = (parsed as VoiceContributionApiErrorBody | null) ?? {};
    throw new VoiceContributionApiError(error.message ?? `Request failed (${response.status})`, error.code ?? null);
  }
  return parsed as VoiceClip;
}

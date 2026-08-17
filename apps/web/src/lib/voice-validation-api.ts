/**
 * Web client for `apps/api`'s `voice-contribution/validation/next`,
 * `voice-contribution/clips/:clipId/audio`, and
 * `voice-contribution/clips/:clipId/validations` routes — Round six §M's
 * Validation flow box. Shaped after `voice-contribution-api.ts`: same base
 * URL helper, same typed-error-with-`code` shape (the validator view needs
 * to tell "this clip was just resolved by someone else" apart from "you
 * already voted on this" apart from generic failure).
 */

import type { ClipValidation, ClipValidationVerdict, ClipVerificationStatus, VoiceClip } from '@swasthya/language-corpus';

export interface VoiceValidationApiErrorBody {
  code?: string;
  message?: string;
}

export class VoiceValidationApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'VoiceValidationApiError';
    this.code = code;
  }
}

function voiceContributionUrl(path: string): string {
  const configured = process.env['NEXT_PUBLIC_API_URL']?.replace(/\/$/, '');
  return `${configured ?? 'http://localhost:4000'}/v1/language-corpus/voice-contribution${path}`;
}

async function parseJsonOrThrow(response: Response): Promise<unknown> {
  const parsed = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const error = (parsed as VoiceValidationApiErrorBody | null) ?? {};
    throw new VoiceValidationApiError(error.message ?? `Request failed (${response.status})`, error.code ?? null);
  }
  return parsed;
}

/** The next clip this signed-in caller is eligible to validate, or `null` when none remain. */
export async function fetchNextClipToValidate(): Promise<VoiceClip | null> {
  const response = await fetch(voiceContributionUrl('/validation/next'), { credentials: 'include' });
  const parsed = (await parseJsonOrThrow(response)) as { clip: VoiceClip | null };
  return parsed.clip;
}

/** `bytesBase64` → a `Blob` the caller can hand to an `<audio>` element via `URL.createObjectURL`. */
export async function fetchClipAudio(clipId: string): Promise<Blob> {
  const response = await fetch(voiceContributionUrl(`/clips/${clipId}/audio`), { credentials: 'include' });
  const parsed = (await parseJsonOrThrow(response)) as { contentType: string | null; bytesBase64: string };
  const binary = atob(parsed.bytesBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: parsed.contentType ?? 'audio/webm' });
}

export async function submitClipValidation(
  clipId: string,
  verdict: ClipValidationVerdict,
): Promise<{ validation: ClipValidation; status: ClipVerificationStatus }> {
  const response = await fetch(voiceContributionUrl(`/clips/${clipId}/validations`), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verdict }),
  });
  return parseJsonOrThrow(response) as Promise<{ validation: ClipValidation; status: ClipVerificationStatus }>;
}

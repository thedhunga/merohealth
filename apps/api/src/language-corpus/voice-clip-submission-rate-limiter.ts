import { Injectable } from '@nestjs/common';
import { SlidingWindowRateLimiter } from '../common/sliding-window-rate-limiter.js';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 20;

/**
 * Guards `POST /language-corpus/voice-contribution/clips`. Every accepted
 * call is a real `HealthDocumentStore.put()` write — a MinIO object-storage
 * write plus a SHA-256 checksum in production, per `LanguageCorpusService.
 * submitVoiceClip` — and nothing upstream of it consumes a quota the way
 * `RecordsController.capture` spends `DOCUMENTS_STORED`. The duplicate check
 * only rejects byte-identical clips, trivially bypassed by re-recording, so
 * consent alone does not bound how many distinct clips one caller can write
 * in a loop.
 *
 * Keyed by the session's `subjectId`, same reasoning as
 * `RecordExtractionRetryRateLimiter`: `submitVoiceClip` sits behind
 * `SessionAuthGuard`, so a stable per-caller identity already exists.
 * Twenty in ten minutes is looser than that limiter's ten — this route is a
 * legitimate bulk-entry flow (a contributor reading several prompts in one
 * sitting), not a retry-on-failure path — while still bounding a scripted
 * loop to a small, finite number of storage writes per window.
 */
@Injectable()
export class VoiceClipSubmissionRateLimiter extends SlidingWindowRateLimiter {
  constructor() {
    super(MAX_PER_WINDOW, WINDOW_MS);
  }
}

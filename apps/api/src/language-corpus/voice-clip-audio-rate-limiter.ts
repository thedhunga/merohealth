import { Injectable } from '@nestjs/common';
import { SlidingWindowRateLimiter } from '../common/sliding-window-rate-limiter.js';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 40;

/**
 * Guards `GET /language-corpus/voice-contribution/clips/:clipId/audio`. Every
 * accepted call is a real `HealthDocumentStore.get()` — a MinIO
 * object-storage read in production, per `LanguageCorpusService.clipAudio` —
 * base64-encoded into the response body. `VoiceClipSubmissionRateLimiter`
 * already bounds the write side of this same storage; the read side was
 * unmetered, the exact "GET route fans out to a per-call external service,
 * not just a local DB read" shape task HH's own log entry left as the
 * remaining unverified lead.
 *
 * Keyed by the session's `subjectId`, same reasoning as
 * `VoiceClipSubmissionRateLimiter`: `clipAudio` sits behind
 * `SessionAuthGuard`, so a stable per-caller identity already exists. Forty
 * in ten minutes is double the submission ceiling — a validator legitimately
 * listens to more clips than they record in one sitting — while still
 * bounding a scripted download loop to a small, finite number of storage
 * reads per window.
 */
@Injectable()
export class VoiceClipAudioRateLimiter extends SlidingWindowRateLimiter {
  constructor() {
    super(MAX_PER_WINDOW, WINDOW_MS);
  }
}

import { Injectable } from '@nestjs/common';
import { SlidingWindowRateLimiter } from '../common/sliding-window-rate-limiter.js';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 10;

/**
 * Guards `POST /records/documents/:documentId/retry-extraction`. Unlike
 * `capture()`, which spends `EntitlementsGuard`'s `DOCUMENTS_STORED` quota
 * on every accepted call, a retry creates no new document and consumes no
 * quota — `#runExtraction` (records.service.ts) still calls the same paid
 * Gemini `extract()` every time, but nothing bounded how often a caller
 * could re-trigger it. The transition table only accepts a retry from
 * `EXTRACTION_FAILED`, so this is not open to arbitrary documents, but nothing
 * stops a caller from retrying the same failed (or provider-outage-flaky)
 * document in a tight loop, each call a real charge.
 *
 * Keyed by the session's `subjectId`, not IP — `retry-extraction` sits behind
 * `SessionAuthGuard`, so a stable per-caller identity already exists and is
 * the more precise key (no shared-IP/CGNAT collision risk `OtpRequestRateLimiter`
 * and `CompanionResearchRateLimiter` have to accept on their unauthenticated
 * routes). Ten in ten minutes matches `OtpRequestRateLimiter`'s ceiling:
 * generous for a real person retrying a genuinely bad photo a few times,
 * tight enough to bound a scripted loop against one account.
 */
@Injectable()
export class RecordExtractionRetryRateLimiter extends SlidingWindowRateLimiter {
  constructor() {
    super(MAX_PER_WINDOW, WINDOW_MS);
  }
}

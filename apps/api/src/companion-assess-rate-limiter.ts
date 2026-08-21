import { Injectable } from '@nestjs/common';
import { SlidingWindowRateLimiter } from './common/sliding-window-rate-limiter.js';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 60;

/**
 * Guards `POST /companion/assess`. Unlike its sibling `POST
 * /companion/research`, `assess()` never reaches a paid model —
 * `assessSafety`/`getSafetyTemplate` are pure, deterministic, in-process
 * lookups, which is exactly why `CompanionResearchRateLimiter` was never
 * extended to cover it: its own doc comment ties it specifically to the one
 * route that spends money, and reusing it here would make that comment
 * false. But a sweep of every controller (the same shape task WW's own
 * `AnalyticsController` fix used) found `assess()` is the last public POST
 * route in this API with no rate limiter of any kind — not `SessionAuthGuard`
 * (it is genuinely meant to be callable pre-sign-in, matching `research`),
 * not a ceiling. Zero external cost is not zero risk: nothing bounds how
 * often one caller can loop this endpoint, and every other unauthenticated
 * mutation route in this API (`research`, OTP request, retry-extraction,
 * engagement messages, voice-clip submission/read) already accepts that
 * "unbounded, unauthenticated, POST" alone is worth closing regardless of
 * per-call cost.
 *
 * Sixty in ten minutes — double `CompanionResearchRateLimiter`'s ceiling —
 * reflects that difference: generous enough that no real client (today,
 * none calls this route at all; `apps/mobile` and `apps/web` both run
 * `assessSafety` themselves rather than over HTTP) could plausibly hit it,
 * while still bounding a scripted loop against an otherwise free endpoint.
 * Keyed by IP, the same reasoning `CompanionResearchRateLimiter` documents:
 * this route has no session, so IP is the only signal available.
 */
@Injectable()
export class CompanionAssessRateLimiter extends SlidingWindowRateLimiter {
  constructor() {
    super(MAX_PER_WINDOW, WINDOW_MS);
  }
}

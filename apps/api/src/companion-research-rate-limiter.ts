import { Injectable } from '@nestjs/common';
import { SlidingWindowRateLimiter } from './common/sliding-window-rate-limiter.js';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;

/**
 * Guards `POST /companion/research`, the only unauthenticated route on this
 * API that reaches a paid model on every accepted call —
 * `PerplexityHealthService` hits `sonar-pro` with `search_context_size:
 * 'high'`, the priciest search tier, and nothing upstream of the safety gate
 * bounds how often a caller can trigger that. `apps/web`'s own
 * `/api/companion/research` route handler already carries this exact limit
 * (same number, same window) for the Next.js side of the same product
 * surface; this closes the sibling gap on the NestJS side, which has no
 * limiter at all today.
 *
 * Thirty in ten minutes matches the web-side reasoning: generous enough for
 * a real multi-turn conversation, since Nepali mobile networks put many
 * subscribers behind one shared carrier-grade-NAT address and a tight
 * per-IP ceiling would throttle real neighbours together, while still
 * bounding a scripted loop that would otherwise run unmetered.
 */
@Injectable()
export class CompanionResearchRateLimiter extends SlidingWindowRateLimiter {
  constructor() {
    super(MAX_PER_WINDOW, WINDOW_MS);
  }
}

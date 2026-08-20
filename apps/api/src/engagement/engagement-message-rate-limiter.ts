import { Injectable } from '@nestjs/common';
import { SlidingWindowRateLimiter } from '../common/sliding-window-rate-limiter.js';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;

/**
 * Guards `POST engagement/patients/:patientId/messages` and `POST
 * engagement/messages/:messageId/retry` — the two routes that reach
 * `EngagementService.attemptDelivery`, a real SMS/WhatsApp send via
 * `EngagementDeliveryProvider`. `MockEngagementDeliveryProvider` is the only
 * adapter wired up today, but `createEngagementDeliveryProvider`'s own doc
 * comment makes clear a real gateway drops in behind the same interface
 * later, at which point every accepted call here starts costing real money
 * — the identical shape `OtpRequestRateLimiter`/`CompanionResearchRateLimiter`
 * already guard for elsewhere in this API. Bounding it now, before a real
 * provider exists, means the limiter is already load-bearing on day one of
 * that swap instead of one more thing to remember.
 *
 * Neither route carries any auth guard at all — `EngagementController` is
 * clinic-staff-facing with no clinician-session model yet (see the ledger's
 * `engagement`/`scheduling`/`patient-registry` owner-gated entry), so unlike
 * `RecordExtractionRetryRateLimiter`'s per-subject key, there is no stable
 * caller identity to key on here; IP is the only signal available, same
 * reasoning `OtpRequestRateLimiter` documents. Thirty in ten minutes is
 * generous enough for a clinic sending a real batch of reminders from one
 * shared office connection, while still bounding a script that would
 * otherwise queue unlimited messages against any patient in the registry.
 */
@Injectable()
export class EngagementMessageRateLimiter extends SlidingWindowRateLimiter {
  constructor() {
    super(MAX_PER_WINDOW, WINDOW_MS);
  }
}

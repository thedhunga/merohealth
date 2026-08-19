import { Injectable } from '@nestjs/common';
import { SlidingWindowRateLimiter } from '../common/sliding-window-rate-limiter.js';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 10;

/**
 * Guards `POST /auth/otp/request`, the only unauthenticated route in this
 * API that spends real money: every accepted call hands a message to
 * `SmsProvider`. `AuthService`'s existing `isOtpResendAllowed` check is a
 * cooldown per *phone number*, which stops someone hammering their own
 * number but does nothing about the actual abuse shape — a script walking
 * through Nepali mobile numbers, each one a first request that no cooldown
 * has ever seen, sending an unbounded number of real SMS at our expense.
 *
 * Ten per ten minutes is deliberately loose for a route a real person uses
 * once or twice. The reason is carrier-grade NAT: Nepali mobile networks
 * put many subscribers behind one public address, so a tight per-IP limit
 * would lock real people out of sign-in altogether — a far worse failure
 * than a slower attacker. Bounding the spend at all is the win here; the
 * ceiling can come down once real traffic shows what normal looks like.
 */
@Injectable()
export class OtpRequestRateLimiter extends SlidingWindowRateLimiter {
  constructor() {
    super(MAX_PER_WINDOW, WINDOW_MS);
  }
}

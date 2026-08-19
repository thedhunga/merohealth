import { Injectable } from '@nestjs/common';
import { SlidingWindowRateLimiter } from '../common/sliding-window-rate-limiter.js';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

/**
 * Guards the anonymous `POST /early-access` route, the one unauthenticated
 * write in this module — `contact`'s unique constraint already makes a
 * repeated *same* contact a no-op, but nothing stops a script from posting
 * many distinct contacts (or none at all) from one caller. Tight numbers
 * are affordable here in a way they are not on sign-in: registering
 * interest is a once-ever action, so five in ten minutes is far above any
 * genuine use.
 */
@Injectable()
export class EarlyAccessRateLimiter extends SlidingWindowRateLimiter {
  constructor() {
    super(MAX_PER_WINDOW, WINDOW_MS);
  }
}

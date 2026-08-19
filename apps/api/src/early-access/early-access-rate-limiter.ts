import { Injectable } from '@nestjs/common';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

/**
 * Guards the anonymous `POST /early-access` route, the one unauthenticated
 * write in this module — `contact`'s unique constraint already makes a
 * repeated *same* contact a no-op, but nothing stops a script from posting
 * many distinct contacts (or none at all) from one caller. Keyed by IP
 * rather than a `HistoryStore`-style DB row: there is no session, device id,
 * or other stable identity available pre-sign-in to key a persisted
 * cooldown on (`anonymousId` is deliberately never sent this early — see
 * `EarlyAccess`'s schema comment), so this trades durability for the only
 * signal actually on hand. In-memory and per-instance is a known, accepted
 * gap for a "register interest" feature, not a security-critical one; a
 * durable, IP-hashed limiter is the natural upgrade if abuse is observed.
 */
@Injectable()
export class EarlyAccessRateLimiter {
  private readonly hits = new Map<string, number[]>();

  allow(key: string, now: Date = new Date()): boolean {
    const cutoff = now.getTime() - WINDOW_MS;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= MAX_PER_WINDOW) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now.getTime());
    this.hits.set(key, recent);
    return true;
  }
}

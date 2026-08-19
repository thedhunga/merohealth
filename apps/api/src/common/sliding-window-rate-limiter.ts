/**
 * Counts calls per caller key inside a rolling window. Extracted from
 * `EarlyAccessRateLimiter`, which was the only limiter in this API until
 * `OtpRequestRateLimiter` needed the same shape with different numbers.
 *
 * In-memory and per-instance, deliberately: there is no session, device id
 * or other stable identity on the unauthenticated routes this guards
 * (`anonymousId` is never sent pre-sign-in — see `EarlyAccess`'s schema
 * comment), so the caller IP is the only signal on hand, and the API runs
 * as a single container today. A durable, IP-hashed limiter is the natural
 * upgrade the moment the API runs more than one replica, since each replica
 * would otherwise enforce its own separate allowance.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly maxPerWindow: number,
    private readonly windowMs: number,
  ) {}

  allow(key: string, now: Date = new Date()): boolean {
    const cutoff = now.getTime() - this.windowMs;
    this.evictExpired(cutoff);
    const recent = (this.hits.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
    if (recent.length >= this.maxPerWindow) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now.getTime());
    this.hits.set(key, recent);
    return true;
  }

  /**
   * A key is only pruned when that same key calls again, so a caller
   * rotating IPs would otherwise grow this map without bound — the reason
   * for a ceiling rather than trusting the per-key filter above. Sweeping
   * only once the map is large keeps the common path O(1); the sweep itself
   * can drop every expired key because an absent key and a key with no
   * unexpired hits mean exactly the same thing to `allow`.
   */
  private evictExpired(cutoff: number): void {
    if (this.hits.size <= MAX_TRACKED_KEYS) return;
    for (const [key, timestamps] of this.hits) {
      if (timestamps.every((timestamp) => timestamp <= cutoff)) this.hits.delete(key);
    }
  }
}

const MAX_TRACKED_KEYS = 10_000;

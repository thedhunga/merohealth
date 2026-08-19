/**
 * Counts calls per caller key inside a rolling window. Mirrors
 * `SlidingWindowRateLimiter` in `apps/api/src/common/` — colocated here
 * rather than shared, because `apps/web` and `apps/api` deploy
 * independently (Vercel vs. the dedicated server) and neither imports the
 * other.
 *
 * In-memory and per-instance, deliberately, same reasoning as the API's
 * copy: there is no session or device id on an unauthenticated route, so
 * the caller IP is the only signal on hand. The one honest difference from
 * the API's version is the deployment target — Vercel can run more than one
 * instance of this function under load, and each gets its own empty map, so
 * this bounds a single sequential script rather than guaranteeing a hard
 * ceiling against a caller spread across many concurrent invocations. Still
 * a real improvement over no limit at all, and upgrading to a shared store
 * (e.g. Vercel KV) is the natural next step if abuse is ever seen in
 * practice.
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

/**
 * The rate-limiting key for an unauthenticated caller of a Route Handler.
 * Vercel sets `x-forwarded-for` to the real client first, proxies it added
 * after (its own edge network) appended afterward — the first entry is the
 * one to trust. `'unknown'` is a real shared bucket rather than a bypass: a
 * caller we cannot identify shares one allowance with every other such
 * caller, which fails closed.
 */
export function requestIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || 'unknown';
}

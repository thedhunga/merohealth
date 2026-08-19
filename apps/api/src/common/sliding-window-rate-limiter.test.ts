import { describe, expect, it } from 'vitest';
import { SlidingWindowRateLimiter } from './sliding-window-rate-limiter.js';

const NOW = new Date('2026-08-19T10:00:00.000Z');

describe('SlidingWindowRateLimiter', () => {
  it('allows exactly the configured number of calls, then refuses', () => {
    const limiter = new SlidingWindowRateLimiter(3, 60_000);
    expect(limiter.allow('a', NOW)).toBe(true);
    expect(limiter.allow('a', NOW)).toBe(true);
    expect(limiter.allow('a', NOW)).toBe(true);
    expect(limiter.allow('a', NOW)).toBe(false);
  });

  it('keeps each key on its own allowance', () => {
    const limiter = new SlidingWindowRateLimiter(1, 60_000);
    limiter.allow('a', NOW);
    expect(limiter.allow('a', NOW)).toBe(false);
    expect(limiter.allow('b', NOW)).toBe(true);
  });

  it('slides rather than resetting on a fixed boundary — one expired call frees exactly one slot', () => {
    const limiter = new SlidingWindowRateLimiter(2, 60_000);
    limiter.allow('a', NOW);
    limiter.allow('a', new Date(NOW.getTime() + 30_000));
    const justPastTheFirst = new Date(NOW.getTime() + 60_001);

    expect(limiter.allow('a', justPastTheFirst)).toBe(true);
    expect(limiter.allow('a', justPastTheFirst)).toBe(false);
  });

  it('refuses a caller whose window is full even while a different key is idle', () => {
    const limiter = new SlidingWindowRateLimiter(1, 60_000);
    limiter.allow('a', NOW);
    limiter.allow('b', NOW);
    expect(limiter.allow('a', NOW)).toBe(false);
  });

  it('forgets keys whose hits have all expired rather than growing without bound', () => {
    const limiter = new SlidingWindowRateLimiter(1, 60_000);
    // Past the eviction ceiling, so the sweep runs. Every one of these keys
    // is expired by `later`, so a caller rotating IPs cannot pin them in
    // memory indefinitely.
    for (let i = 0; i < 10_002; i++) limiter.allow(`ip-${i}`, NOW);
    const later = new Date(NOW.getTime() + 120_000);
    limiter.allow('trigger-the-sweep', later);

    expect(trackedKeyCount(limiter)).toBeLessThan(10);
  });
});

/** Reaches the private map on purpose — eviction has no other observable effect. */
function trackedKeyCount(limiter: SlidingWindowRateLimiter): number {
  return (limiter as unknown as { hits: Map<string, number[]> }).hits.size;
}

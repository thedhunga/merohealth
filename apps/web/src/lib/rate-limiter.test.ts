import { describe, expect, it } from 'vitest';

import { requestIp, SlidingWindowRateLimiter } from './rate-limiter';

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

  it('forgets keys whose hits have all expired rather than growing without bound', () => {
    const limiter = new SlidingWindowRateLimiter(1, 60_000);
    for (let i = 0; i < 10_002; i++) limiter.allow(`ip-${i}`, NOW);
    const later = new Date(NOW.getTime() + 120_000);
    limiter.allow('trigger-the-sweep', later);

    expect(trackedKeyCount(limiter)).toBeLessThan(10);
  });
});

describe('requestIp', () => {
  it('reads the first address from x-forwarded-for', () => {
    const request = new Request('https://merohealth.example/api/companion/research', {
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    });
    expect(requestIp(request)).toBe('203.0.113.5');
  });

  it('trims whitespace around the first address', () => {
    const request = new Request('https://merohealth.example/api/companion/research', {
      headers: { 'x-forwarded-for': '  203.0.113.5  , 10.0.0.1' },
    });
    expect(requestIp(request)).toBe('203.0.113.5');
  });

  it('falls back to a shared "unknown" bucket when the header is absent', () => {
    const request = new Request('https://merohealth.example/api/companion/research');
    expect(requestIp(request)).toBe('unknown');
  });

  it('falls back to "unknown" rather than an empty string when the header is blank', () => {
    const request = new Request('https://merohealth.example/api/companion/research', {
      headers: { 'x-forwarded-for': '' },
    });
    expect(requestIp(request)).toBe('unknown');
  });
});

/** Reaches the private map on purpose — eviction has no other observable effect. */
function trackedKeyCount(limiter: SlidingWindowRateLimiter): number {
  return (limiter as unknown as { hits: Map<string, number[]> }).hits.size;
}

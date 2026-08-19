import { describe, expect, it } from 'vitest';
import { EarlyAccessRateLimiter } from './early-access-rate-limiter.js';

describe('EarlyAccessRateLimiter', () => {
  it('allows requests from the same key up to the limit', () => {
    const limiter = new EarlyAccessRateLimiter();
    const now = new Date('2026-08-19T10:00:00.000Z');
    for (let i = 0; i < 5; i++) {
      expect(limiter.allow('1.2.3.4', now)).toBe(true);
    }
  });

  it('rejects the request past the limit within the window', () => {
    const limiter = new EarlyAccessRateLimiter();
    const now = new Date('2026-08-19T10:00:00.000Z');
    for (let i = 0; i < 5; i++) limiter.allow('1.2.3.4', now);

    expect(limiter.allow('1.2.3.4', now)).toBe(false);
  });

  it('does not let one key exhaust another', () => {
    const limiter = new EarlyAccessRateLimiter();
    const now = new Date('2026-08-19T10:00:00.000Z');
    for (let i = 0; i < 5; i++) limiter.allow('1.2.3.4', now);

    expect(limiter.allow('5.6.7.8', now)).toBe(true);
  });

  it('allows again once the window has passed', () => {
    const limiter = new EarlyAccessRateLimiter();
    const now = new Date('2026-08-19T10:00:00.000Z');
    for (let i = 0; i < 5; i++) limiter.allow('1.2.3.4', now);
    expect(limiter.allow('1.2.3.4', now)).toBe(false);

    const later = new Date(now.getTime() + 10 * 60 * 1000 + 1);
    expect(limiter.allow('1.2.3.4', later)).toBe(true);
  });
});

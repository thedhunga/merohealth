import { describe, expect, it } from 'vitest';

import { earliestSelectableExpiryDate } from '@/lib/delegation-expiry';

describe('earliestSelectableExpiryDate', () => {
  it('returns the day after `now`, not `now`\'s own day', () => {
    expect(earliestSelectableExpiryDate(new Date('2026-08-13T10:00:00.000Z'))).toBe('2026-08-14');
  });

  it('rolls over correctly when `now` sits right at UTC midnight — the case that broke `expiresAt <= grantedAt`', () => {
    expect(earliestSelectableExpiryDate(new Date('2026-08-13T00:00:00.000Z'))).toBe('2026-08-14');
  });

  it('rolls over correctly when `now` sits just before UTC midnight', () => {
    expect(earliestSelectableExpiryDate(new Date('2026-08-13T23:59:59.999Z'))).toBe('2026-08-14');
  });

  it('always parses back to a UTC instant strictly after `now`, for any hour of day', () => {
    for (let hour = 0; hour < 24; hour += 3) {
      const now = new Date(Date.UTC(2026, 7, 13, hour, 0, 0));
      const earliest = new Date(`${earliestSelectableExpiryDate(now)}T00:00:00.000Z`);
      expect(earliest.getTime()).toBeGreaterThan(now.getTime());
    }
  });
});

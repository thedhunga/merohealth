import { describe, expect, it } from 'vitest';
import type { CredentialingBadge } from '@swasthya/shared-types';

import { verifiedBadgeViewModel } from '@/lib/verified-badge';

const badge: CredentialingBadge = {
  council: 'NMC',
  registrationNumber: '12345',
  reviewerId: 'reviewer-1',
  verifiedAt: '2026-01-01T00:00:00.000Z',
  lastCheckedAt: '2026-01-01T00:00:00.000Z',
  recheckDueAt: '2027-01-01T00:00:00.000Z',
};

describe('verifiedBadgeViewModel', () => {
  it('reports VERIFIED before the recheck date', () => {
    expect(verifiedBadgeViewModel(badge, '2026-06-01T00:00:00.000Z').status).toBe('VERIFIED');
  });

  it('reports UNVERIFIED once the recheck date has passed', () => {
    expect(verifiedBadgeViewModel(badge, '2027-06-01T00:00:00.000Z').status).toBe('UNVERIFIED');
  });

  it('passes through the council, registration number and last-checked date unchanged', () => {
    const view = verifiedBadgeViewModel(badge, '2026-06-01T00:00:00.000Z');
    expect(view.council).toBe('NMC');
    expect(view.registrationNumber).toBe('12345');
    expect(view.lastCheckedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

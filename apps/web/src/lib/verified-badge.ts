import { badgeRenderStatus } from '@swasthya/credentialing';
import type { CouncilKey, CredentialingBadge } from '@swasthya/shared-types';

export interface VerifiedBadgeViewModel {
  status: 'VERIFIED' | 'UNVERIFIED';
  council: CouncilKey;
  registrationNumber: string;
  lastCheckedAt: string;
}

/**
 * The one place `VerifiedBadge.tsx` reaches into `packages/credentialing`.
 * `badgeRenderStatus` already applies identity-and-credentialing.md §3's "a
 * stale verification degrades to unverified rather than silently persisting"
 * rule, purely from the badge's own `recheckDueAt` — never a live call to
 * anything that can be down, per §5's "must never be computed live from a
 * service that can fail." This just narrows the result to the fields the
 * component renders, so the component itself stays a template with no
 * branching logic of its own left to test separately.
 */
export function verifiedBadgeViewModel(badge: CredentialingBadge, now: string): VerifiedBadgeViewModel {
  return {
    status: badgeRenderStatus(badge, now),
    council: badge.council,
    registrationNumber: badge.registrationNumber,
    lastCheckedAt: badge.lastCheckedAt,
  };
}

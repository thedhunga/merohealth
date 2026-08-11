import type { DelegationGrant, GuardianshipGrant } from '@swasthya/family';
import type { FamilyGrantsStore } from './family-grants.store.js';

/**
 * A hand-rolled `FamilyGrantsStore` fake, test-only — mirrors
 * `InMemoryAuthStore`'s reason for existing: `FamilyGrantsService` and
 * `FamilyGrantsController` can be exercised without a live Postgres.
 * Seeded directly with whatever grants a test needs, since there is no
 * "create" method on the real port to seed through (see
 * `family-grants.store.ts`'s doc comment on why this port is read-only).
 */
export class InMemoryFamilyGrantsStore implements FamilyGrantsStore {
  constructor(
    private readonly guardianships: readonly GuardianshipGrant[] = [],
    private readonly delegations: readonly DelegationGrant[] = [],
  ) {}

  guardianshipsFor(guardianId: string): Promise<readonly GuardianshipGrant[]> {
    return Promise.resolve(this.guardianships.filter((grant) => grant.guardianId === guardianId));
  }

  delegationsFor(delegateId: string): Promise<readonly DelegationGrant[]> {
    return Promise.resolve(this.delegations.filter((grant) => grant.delegateId === delegateId));
  }
}

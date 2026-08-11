import type { DelegationGrant, GuardianshipGrant } from '@swasthya/family';
import type { FamilyGrantsStore } from './family-grants.store.js';

/**
 * A hand-rolled `FamilyGrantsStore` fake, test-only — mirrors
 * `InMemoryAuthStore`'s reason for existing: `FamilyGrantsService` and
 * `FamilyGrantsController` can be exercised without a live Postgres. Can
 * still be seeded directly with whatever grants a test needs, but
 * `delegations` is now also a real write target for `createDelegation` —
 * copied into a private mutable array in the constructor so a seeded
 * `readonly` array passed in by a test is never mutated out from under it.
 */
export class InMemoryFamilyGrantsStore implements FamilyGrantsStore {
  private readonly delegations: DelegationGrant[];

  constructor(
    private readonly guardianships: readonly GuardianshipGrant[] = [],
    delegations: readonly DelegationGrant[] = [],
  ) {
    this.delegations = [...delegations];
  }

  guardianshipsFor(guardianId: string): Promise<readonly GuardianshipGrant[]> {
    return Promise.resolve(this.guardianships.filter((grant) => grant.guardianId === guardianId));
  }

  delegationsFor(delegateId: string): Promise<readonly DelegationGrant[]> {
    return Promise.resolve(this.delegations.filter((grant) => grant.delegateId === delegateId));
  }

  createDelegation(grant: DelegationGrant): Promise<DelegationGrant> {
    this.delegations.push(grant);
    return Promise.resolve(grant);
  }
}

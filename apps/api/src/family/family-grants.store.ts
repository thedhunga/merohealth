import type { DelegationGrant, GuardianshipGrant } from '@swasthya/family';

export const FAMILY_GRANTS_STORE = 'FAMILY_GRANTS_STORE';

/**
 * Everything the family-grants endpoint needs to read, behind one port —
 * same "port here, `Prisma*` adapter plus an in-memory test fake" shape as
 * `AuthStore` (`../auth/auth-store.ts`). Read-only: `packages/family`'s own
 * doc comment on `hasScope` notes there is deliberately no route or UI that
 * writes a grant yet — nothing in this repo creates a `GuardianshipGrant` or
 * `DelegationGrant` today, so a write path here would have no real caller.
 *
 * Each method is scoped by subject id in the query itself, not filtered
 * client-side after fetching every grant in the table — the same
 * scoped-retrieval rule Round two B's cross-subject leakage test exists to
 * enforce applies to this port too. `FamilyGrantsService` still runs the
 * result through `listActiveGuardianshipsFor`/`listActiveDelegationsFor` for
 * the active-at-`now` liveness filter; this port only narrows by subject.
 */
export interface FamilyGrantsStore {
  /** Every guardianship grant — active, expired or revoked — where this subject is the guardian. */
  guardianshipsFor(guardianId: string): Promise<readonly GuardianshipGrant[]>;
  /** Every delegation grant — active, expired or revoked — where this subject is the delegate. */
  delegationsFor(delegateId: string): Promise<readonly DelegationGrant[]>;
}

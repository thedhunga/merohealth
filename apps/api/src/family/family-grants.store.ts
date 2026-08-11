import type { DelegationGrant, GuardianshipGrant } from '@swasthya/family';

export const FAMILY_GRANTS_STORE = 'FAMILY_GRANTS_STORE';

/**
 * Everything the family-grants endpoint needs, behind one port — same
 * "port here, `Prisma*` adapter plus an in-memory test fake" shape as
 * `AuthStore` (`../auth/auth-store.ts`).
 *
 * Each read method is scoped by subject id in the query itself, not
 * filtered client-side after fetching every grant in the table — the same
 * scoped-retrieval rule Round two B's cross-subject leakage test exists to
 * enforce applies to this port too. `FamilyGrantsService` still runs the
 * result through `listActiveGuardianshipsFor`/`listActiveDelegationsFor` for
 * the active-at-`now` liveness filter; this port only narrows by subject.
 *
 * `createDelegation` is the first write this port has ever had — until now
 * `packages/family`'s own doc comment on `hasScope` noted there was
 * "deliberately no route or UI" writing a grant, because nothing called it.
 * `FamilyGrantsController`'s new `POST /family/grants/delegations` is that
 * real caller. Guardianship creation is not added here yet: a minor's date
 * of birth is not a field this app captures anywhere (`PatientProfile`
 * keeps demographics as an untyped `Json?` blob), so wiring one up now would
 * mean inventing a source for `guardianshipExpiryForMinor`'s input.
 */
export interface FamilyGrantsStore {
  /** Every guardianship grant — active, expired or revoked — where this subject is the guardian. */
  guardianshipsFor(guardianId: string): Promise<readonly GuardianshipGrant[]>;
  /** Every delegation grant — active, expired or revoked — where this subject is the delegate. */
  delegationsFor(delegateId: string): Promise<readonly DelegationGrant[]>;
  /** Persists an already-validated `DelegationGrant` (see `grantDelegation`/`grantDelegationByAssistedEnrolment`) and returns it back. */
  createDelegation(grant: DelegationGrant): Promise<DelegationGrant>;
}

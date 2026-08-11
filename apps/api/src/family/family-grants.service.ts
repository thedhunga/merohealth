import { Inject, Injectable } from '@nestjs/common';
import type { DelegationGrant, GuardianshipGrant } from '@swasthya/family';
import { FAMILY_GRANTS_STORE, type FamilyGrantsStore } from './family-grants.store.js';

export interface SubjectGrants {
  guardianships: readonly GuardianshipGrant[];
  delegations: readonly DelegationGrant[];
}

/**
 * Deliberately thin: the active-at-`now` liveness filter already lives in
 * `packages/family`'s `listActiveGuardianshipsFor`/`listActiveDelegationsFor`
 * and in `apps/web`'s `buildActingSubjects`, which calls them. Re-applying
 * that filter here too would give the same rule two places to drift out of
 * sync — this service's only job is the part that actually belongs at the
 * API boundary: resolving "which grants" down to "this subject's own",
 * never a caller-supplied id (see `FamilyGrantsController`).
 */
@Injectable()
export class FamilyGrantsService {
  constructor(@Inject(FAMILY_GRANTS_STORE) private readonly store: FamilyGrantsStore) {}

  async grantsFor(subjectId: string): Promise<SubjectGrants> {
    const [guardianships, delegations] = await Promise.all([
      this.store.guardianshipsFor(subjectId),
      this.store.delegationsFor(subjectId),
    ]);
    return { guardianships, delegations };
  }
}

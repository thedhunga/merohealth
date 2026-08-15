import type { DelegationGrant, GuardianshipGrant } from '@swasthya/family';
import { listActiveDelegationsFor, listActiveGuardianshipsFor } from '@swasthya/family';

/**
 * family-and-proxy.md §1's client-side switcher, mirroring the shape
 * `apps/mobile/src/lib/acting-subjects.ts` proved out first: the bounded
 * list of subjects one signed-in account may currently open, and the one
 * rule a switcher exists to enforce. Duplicated rather than imported —
 * `apps/mobile` and `apps/web` are separate apps with no shared UI package
 * drawn between them, and this file is small enough that the duplication
 * cost is lower than the coupling cost of inventing one.
 */
export type SubjectRelationship = 'SELF' | 'GUARDIAN' | 'DELEGATE';

export interface ActingSubject {
  readonly id: string;
  readonly displayName: string;
  readonly relationship: SubjectRelationship;
}

export class UnknownActingSubjectError extends Error {
  constructor(subjectId: string) {
    super(`${subjectId} is not in the current list of subjects this account may act as`);
    this.name = 'UnknownActingSubjectError';
  }
}

/**
 * The one rule the switcher exists to enforce: switching is never a
 * free-form id typed or deep-linked in, only ever a landing on a subject
 * already present in this account's own authorised list. Throws rather than
 * silently keeping the previous subject — a caller that swallows this error
 * and carries on showing the old subject while believing it switched is
 * exactly the "acting for someone else looks like acting for yourself"
 * failure §1 exists to prevent, so this must not be a quiet no-op.
 */
export function resolveActingSubject(
  subjects: readonly ActingSubject[],
  requestedId: string,
): ActingSubject {
  const found = subjects.find((subject) => subject.id === requestedId);
  if (!found) throw new UnknownActingSubjectError(requestedId);
  return found;
}

/**
 * Composes the real `self` identity with every guardianship/delegation
 * grant currently active for that person — via `@swasthya/family`'s own
 * `listActiveGuardianshipsFor`/`listActiveDelegationsFor`, the two
 * `now`-aware liveness filters, rather than re-deriving that logic here —
 * into one authorised list. `allGuardianships`/`allDelegations` are the
 * full grant sets; nothing in `apps/api` exposes them to a web client yet
 * (see `AccountView.tsx`'s own comment), so every caller today passes `[]`
 * and gets exactly the single-SELF list `apps/mobile`'s equivalent renders.
 * The call sites are real so the day that endpoint exists, only the two
 * arguments below change, not this composition.
 *
 * `wardId`/`granterId` fall back as the displayed name because nothing in
 * this repository resolves a subject id to a human name yet — neither grant
 * type carries one (family-and-proxy.md §1: "a subject is just whichever
 * plain string id the rest of the platform already uses"), and inventing
 * one here would be exactly the fabrication the standing constraints rule
 * out. An id shown honestly beats a name made up to look finished.
 */
export function buildActingSubjects(
  self: { id: string; displayName: string },
  allGuardianships: readonly GuardianshipGrant[],
  allDelegations: readonly DelegationGrant[],
  now: string,
): readonly ActingSubject[] {
  const guardianships = listActiveGuardianshipsFor(allGuardianships, self.id, now);
  const delegations = listActiveDelegationsFor(allDelegations, self.id, now);
  return [
    { id: self.id, displayName: self.displayName, relationship: 'SELF' },
    ...guardianships.map((grant) => ({
      id: grant.wardId,
      displayName: grant.wardId,
      relationship: 'GUARDIAN' as const,
    })),
    ...delegations.map((grant) => ({
      id: grant.granterId,
      displayName: grant.granterId,
      relationship: 'DELEGATE' as const,
    })),
  ];
}

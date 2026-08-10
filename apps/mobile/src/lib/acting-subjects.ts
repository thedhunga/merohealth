/**
 * family-and-proxy.md §1: "the convenience of the streaming-profile model is
 * preserved by the client — a profile switcher in the app — without the
 * ownership being wrong underneath." This is the client-side half of that:
 * the bounded list of subjects one signed-in account may currently open,
 * and the one rule a switcher exists to enforce.
 *
 * `GUARDIAN` and `DELEGATE` are modelled now even though nothing in this app
 * can populate them yet — there is still no identity/auth layer here (see
 * `local-id.ts`'s own doc comment) and therefore no channel for a real
 * `GuardianshipGrant`/`DelegationGrant` from `@swasthya/family` to reach a
 * device. Modelling the relationship now means the safety property below is
 * already correct once that wiring exists, rather than retrofitted under
 * pressure later.
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

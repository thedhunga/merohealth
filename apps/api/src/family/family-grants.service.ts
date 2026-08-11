import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  EmptyDelegationScopeError,
  grantDelegation,
  InvalidDelegationExpiryError,
  SelfDelegationError,
  type DelegationGrant,
  type DelegationScope,
  type GuardianshipGrant,
} from '@swasthya/family';
import { AUTH_STORE, type AuthStore } from '../auth/auth-store.js';
import { parsePhone } from '../auth/auth.service.js';
import { FAMILY_GRANTS_STORE, type FamilyGrantsStore } from './family-grants.store.js';

export interface SubjectGrants {
  guardianships: readonly GuardianshipGrant[];
  delegations: readonly DelegationGrant[];
}

/**
 * `grantsFor` is deliberately thin: the active-at-`now` liveness filter
 * already lives in `packages/family`'s
 * `listActiveGuardianshipsFor`/`listActiveDelegationsFor` and in
 * `apps/web`'s `buildActingSubjects`, which calls them. Re-applying that
 * filter here too would give the same rule two places to drift out of sync
 * — this method's only job is the part that actually belongs at the API
 * boundary: resolving "which grants" down to "this subject's own", never a
 * caller-supplied id (see `FamilyGrantsController`).
 *
 * `createDelegation` carries real logic, unlike `grantsFor`: it resolves a
 * phone number to a delegate id (`AuthStore`, the same store `AuthService`
 * itself is built on) and maps `packages/family`'s domain errors to the
 * `{code, message}` `BadRequestException` shape `AuthService.parsePhone`
 * already established for the same phone-validation failure.
 */
@Injectable()
export class FamilyGrantsService {
  constructor(
    @Inject(FAMILY_GRANTS_STORE) private readonly store: FamilyGrantsStore,
    @Inject(AUTH_STORE) private readonly authStore: AuthStore,
  ) {}

  async grantsFor(subjectId: string): Promise<SubjectGrants> {
    const [guardianships, delegations] = await Promise.all([
      this.store.guardianshipsFor(subjectId),
      this.store.delegationsFor(subjectId),
    ]);
    return { guardianships, delegations };
  }

  /**
   * Self-service only — the granter is the caller, so `enrolment` is always
   * `null` (see `grantDelegation`'s own doc comment on why that's correct
   * for this path). Assisted enrolment needs a witness/consent-method UI
   * this task does not build; wiring `grantDelegationByAssistedEnrolment` in
   * stays a separate task rather than being half-built here.
   */
  async createDelegation(
    granterId: string,
    delegatePhone: string,
    scopes: readonly DelegationScope[],
    expiresAt: string,
  ): Promise<DelegationGrant> {
    const phone = parsePhone(delegatePhone);
    const delegate = await this.authStore.findUserByPhone(phone);
    if (!delegate) {
      throw new NotFoundException({ code: 'DELEGATE_NOT_FOUND', message: `No registered person with phone ${phone}` });
    }

    const grantedAt = new Date().toISOString();
    let grant: DelegationGrant;
    try {
      grant = grantDelegation(randomUUID(), granterId, delegate.id, scopes, grantedAt, expiresAt);
    } catch (error) {
      if (error instanceof SelfDelegationError || error instanceof EmptyDelegationScopeError || error instanceof InvalidDelegationExpiryError) {
        throw new BadRequestException({ code: error.name, message: error.message });
      }
      throw error;
    }
    return this.store.createDelegation(grant);
  }
}

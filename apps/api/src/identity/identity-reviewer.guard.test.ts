import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { IDENTITY_REVIEWER_ROLE, IdentityReviewerGuard } from './identity-reviewer.guard.js';

function makeContext(authUser: CurrentUserResult | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: {}, authUser }), getResponse: () => ({}), getNext: () => undefined }),
  } as unknown as ExecutionContext;
}

function buildUser(role: CurrentUserResult['user']['role']): CurrentUserResult {
  return {
    subjectId: 'reviewer-1',
    user: { id: 'reviewer-1', phone: '9812345678', role, locale: 'ne', assuranceLevel: 'REGISTERED' },
    patientProfileId: null,
    assuranceLevel: 'REGISTERED',
  };
}

describe('IdentityReviewerGuard', () => {
  it('allows a verified session whose role is IDENTITY_REVIEWER', () => {
    const guard = new IdentityReviewerGuard();
    const context = makeContext(buildUser(IDENTITY_REVIEWER_ROLE));

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a request with no session at all', () => {
    const guard = new IdentityReviewerGuard();
    const context = makeContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects a verified session whose role is not IDENTITY_REVIEWER — no general admin power', () => {
    const guard = new IdentityReviewerGuard();
    const context = makeContext(buildUser('SUPER_ADMIN'));

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects a CLINICAL_REVIEWER session — a distinct trust boundary, not a shared reviewer power', () => {
    const guard = new IdentityReviewerGuard();
    const context = makeContext(buildUser('CLINICAL_REVIEWER'));

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects a patient session, the common case an attacker actually has', () => {
    const guard = new IdentityReviewerGuard();
    const context = makeContext(buildUser('PATIENT'));

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from './auth.service.js';
import { OWNER_ROLE, OwnerGuard } from './owner.guard.js';

function makeContext(authUser: CurrentUserResult | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: {}, authUser }), getResponse: () => ({}), getNext: () => undefined }),
  } as unknown as ExecutionContext;
}

function buildUser(role: CurrentUserResult['user']['role']): CurrentUserResult {
  return {
    subjectId: 'owner-1',
    user: { id: 'owner-1', phone: '9812345678', role, locale: 'ne', assuranceLevel: 'REGISTERED' },
    patientProfileId: null,
    assuranceLevel: 'REGISTERED',
  };
}

describe('OwnerGuard', () => {
  it('allows a verified session whose role is SUPER_ADMIN', () => {
    const guard = new OwnerGuard();
    const context = makeContext(buildUser(OWNER_ROLE));

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a request with no session at all', () => {
    const guard = new OwnerGuard();
    const context = makeContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects a verified session with an unrelated role, including a narrower reviewer role', () => {
    const guard = new OwnerGuard();

    expect(() => guard.canActivate(makeContext(buildUser('PATIENT')))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(makeContext(buildUser('CLINICAL_REVIEWER')))).toThrow(ForbiddenException);
  });
});

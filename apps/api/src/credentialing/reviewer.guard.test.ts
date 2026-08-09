import { BadRequestException, ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { REVIEWER_ID_HEADER, REVIEWER_ROLE_HEADER, ReviewerGuard } from './reviewer.guard.js';

function makeContext(headers: Record<string, string | string[] | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }), getResponse: () => ({}), getNext: () => undefined }),
  } as unknown as ExecutionContext;
}

describe('ReviewerGuard', () => {
  it('allows a request declaring the CLINICAL_REVIEWER role with a reviewer id', () => {
    const guard = new ReviewerGuard();
    const context = makeContext({ [REVIEWER_ROLE_HEADER]: 'CLINICAL_REVIEWER', [REVIEWER_ID_HEADER]: 'reviewer-1' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a request with no declared role', () => {
    const guard = new ReviewerGuard();
    const context = makeContext({ [REVIEWER_ID_HEADER]: 'reviewer-1' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects a role other than CLINICAL_REVIEWER — no general admin power', () => {
    const guard = new ReviewerGuard();
    const context = makeContext({ [REVIEWER_ROLE_HEADER]: 'SUPER_ADMIN', [REVIEWER_ID_HEADER]: 'reviewer-1' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects a declared reviewer role with no reviewer id to attribute actions to', () => {
    const guard = new ReviewerGuard();
    const context = makeContext({ [REVIEWER_ROLE_HEADER]: 'CLINICAL_REVIEWER' });

    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('reads the first value when a header repeats, the same array shape Node HTTP headers can produce', () => {
    const guard = new ReviewerGuard();
    const context = makeContext({
      [REVIEWER_ROLE_HEADER]: ['CLINICAL_REVIEWER', 'SUPER_ADMIN'],
      [REVIEWER_ID_HEADER]: ['reviewer-1'],
    });

    expect(guard.canActivate(context)).toBe(true);
  });
});

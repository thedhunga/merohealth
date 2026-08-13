import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CORPUS_REVIEWER_ROLE, CorpusReviewerGuard } from './corpus-reviewer.guard.js';

function makeContext(authUser: CurrentUserResult | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: {}, authUser }), getResponse: () => ({}), getNext: () => undefined }),
  } as unknown as ExecutionContext;
}

function buildUser(role: CurrentUserResult['user']['role']): CurrentUserResult {
  return {
    subjectId: 'reviewer-1',
    user: { id: 'reviewer-1', phone: '9812345678', role, locale: 'ne' },
    patientProfileId: null,
    assuranceLevel: 'REGISTERED',
  };
}

describe('CorpusReviewerGuard', () => {
  it('allows a verified session whose role is CORPUS_REVIEWER', () => {
    const guard = new CorpusReviewerGuard();
    const context = makeContext(buildUser(CORPUS_REVIEWER_ROLE));

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a request with no session at all', () => {
    const guard = new CorpusReviewerGuard();
    const context = makeContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects the credentialing role — a distinct queue needs its own declared role, not a borrowed one', () => {
    const guard = new CorpusReviewerGuard();
    const context = makeContext(buildUser('CLINICAL_REVIEWER'));

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects a role other than CORPUS_REVIEWER — no general admin power', () => {
    const guard = new CorpusReviewerGuard();
    const context = makeContext(buildUser('SUPER_ADMIN'));

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects a patient session, the common case an attacker actually has', () => {
    const guard = new CorpusReviewerGuard();
    const context = makeContext(buildUser('PATIENT'));

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

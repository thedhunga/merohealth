import { BadRequestException, ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CorpusReviewerGuard, REVIEWER_ID_HEADER, REVIEWER_ROLE_HEADER } from './corpus-reviewer.guard.js';

function makeContext(headers: Record<string, string | string[] | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }), getResponse: () => ({}), getNext: () => undefined }),
  } as unknown as ExecutionContext;
}

describe('CorpusReviewerGuard', () => {
  it('allows a request declaring the CORPUS_REVIEWER role with a reviewer id', () => {
    const guard = new CorpusReviewerGuard();
    const context = makeContext({ [REVIEWER_ROLE_HEADER]: 'CORPUS_REVIEWER', [REVIEWER_ID_HEADER]: 'reviewer-1' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a request with no declared role', () => {
    const guard = new CorpusReviewerGuard();
    const context = makeContext({ [REVIEWER_ID_HEADER]: 'reviewer-1' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects the credentialing role — a distinct queue needs its own declared role, not a borrowed one', () => {
    const guard = new CorpusReviewerGuard();
    const context = makeContext({ [REVIEWER_ROLE_HEADER]: 'CLINICAL_REVIEWER', [REVIEWER_ID_HEADER]: 'reviewer-1' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects a role other than CORPUS_REVIEWER — no general admin power', () => {
    const guard = new CorpusReviewerGuard();
    const context = makeContext({ [REVIEWER_ROLE_HEADER]: 'SUPER_ADMIN', [REVIEWER_ID_HEADER]: 'reviewer-1' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects a declared reviewer role with no reviewer id to attribute actions to', () => {
    const guard = new CorpusReviewerGuard();
    const context = makeContext({ [REVIEWER_ROLE_HEADER]: 'CORPUS_REVIEWER' });

    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('reads the first value when a header repeats, the same array shape Node HTTP headers can produce', () => {
    const guard = new CorpusReviewerGuard();
    const context = makeContext({
      [REVIEWER_ROLE_HEADER]: ['CORPUS_REVIEWER', 'SUPER_ADMIN'],
      [REVIEWER_ID_HEADER]: ['reviewer-1'],
    });

    expect(guard.canActivate(context)).toBe(true);
  });
});

import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/session-auth.guard.js';

/** The one role this guard accepts — `packages/database`'s own `UserRole.CORPUS_REVIEWER`, added by the `20260813000000_add_corpus_reviewer_role` migration, not an invented label. */
export const CORPUS_REVIEWER_ROLE = 'CORPUS_REVIEWER';

/**
 * Gates every corpus-review route behind a distinct, declared role —
 * language-corpus.md §5's mitigations rely on human review actually being
 * scoped to people trusted with de-identified conversational text, not a
 * general admin power. Deliberately a distinct role from
 * `credentialing/reviewer.guard.ts`'s `CLINICAL_REVIEWER`: reading Nepali
 * conversational text for a leaked name or address is a different
 * competency and a different trust boundary from reading a council
 * register, and language-corpus.md never names credentialing review as a
 * prerequisite for this queue.
 *
 * Originally this authorized off two client-supplied headers
 * (`x-reviewer-role`/`x-reviewer-id`) with a doc comment excusing it because
 * `packages/database` was "not wired into `apps/api` by anything today."
 * That excuse is stale in the identical way `credentialing/reviewer.guard.ts`'s
 * was fixed on 2026-08-13: `SessionAuthGuard`/`CurrentUserResult` have since
 * shipped and every route below now runs behind
 * `@UseGuards(SessionAuthGuard, CorpusReviewerGuard)`. This guard reads
 * `request.authUser`, the verified identity `SessionAuthGuard` resolved from
 * a real session token, instead of trusting anything the client typed into a
 * header — closing the same class of gap where anyone could send
 * `x-reviewer-role: CORPUS_REVIEWER` and read or decide on de-identified
 * conversational text, with the audit trail itself falsifiable.
 */
@Injectable()
export class CorpusReviewerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.authUser?.user.role !== CORPUS_REVIEWER_ROLE) {
      throw new ForbiddenException({
        code: 'REVIEWER_ROLE_REQUIRED',
        message: `Requires the ${CORPUS_REVIEWER_ROLE} role`,
      });
    }

    return true;
  }
}

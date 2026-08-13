import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/session-auth.guard.js';

/** The one role this guard accepts — `packages/database`'s `UserRole.IDENTITY_REVIEWER`, added by the `20260813010000_add_identity_reviewer_role` migration, not an invented label. */
export const IDENTITY_REVIEWER_ROLE = 'IDENTITY_REVIEWER';

/**
 * Gates every identity-verification-review route behind a distinct, declared
 * role — identity-and-credentialing.md §4: "access to the review queue is a
 * distinct role, not a general admin power." Deliberately its own role
 * rather than reusing `CLINICAL_REVIEWER` or `CORPUS_REVIEWER`: checking a
 * national ID/citizenship/passport photograph against a person's stated name
 * is a different competency and a different trust boundary from reading a
 * council register or de-identified conversational text, and neither
 * sibling document names this queue as a prerequisite. Mirrors
 * `credentialing/reviewer.guard.ts` and
 * `language-corpus/corpus-reviewer.guard.ts` exactly: reads
 * `request.authUser`, the verified identity `SessionAuthGuard` resolved from
 * a real session token, never a client-supplied header.
 */
@Injectable()
export class IdentityReviewerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.authUser?.user.role !== IDENTITY_REVIEWER_ROLE) {
      throw new ForbiddenException({
        code: 'REVIEWER_ROLE_REQUIRED',
        message: `Requires the ${IDENTITY_REVIEWER_ROLE} role`,
      });
    }

    return true;
  }
}

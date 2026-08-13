import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/session-auth.guard.js';

/** The one role this guard accepts — `packages/database`'s own `UserRole.CLINICAL_REVIEWER`, not an invented label. */
export const CLINICAL_REVIEWER_ROLE = 'CLINICAL_REVIEWER';

/**
 * Gates every credentialing-review route behind a distinct, declared role —
 * identity-and-credentialing.md §4: "access to the review queue is a
 * distinct role, not a general admin power."
 *
 * Originally this authorized off two client-supplied headers
 * (`x-reviewer-role`/`x-reviewer-id`) with a doc comment excusing it because
 * "there is still no identity/auth layer anywhere in this repo." That excuse
 * is stale: `SessionAuthGuard` has since shipped and every route below now
 * runs behind it first (`@UseGuards(SessionAuthGuard, ReviewerGuard)`,
 * mirroring `EntitlementsGuard`'s own guard-order convention). This guard now
 * reads `request.authUser`, the verified identity `SessionAuthGuard`
 * resolved from a real session token, instead of trusting anything the
 * client typed into a header — closing a real gap where anyone could send
 * `x-reviewer-role: CLINICAL_REVIEWER` and approve applications or read
 * applicants' government-ID photographs with no session at all.
 */
@Injectable()
export class ReviewerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.authUser?.user.role !== CLINICAL_REVIEWER_ROLE) {
      throw new ForbiddenException({
        code: 'REVIEWER_ROLE_REQUIRED',
        message: `Requires the ${CLINICAL_REVIEWER_ROLE} role`,
      });
    }

    return true;
  }
}

import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './session-auth.guard.js';

/** `packages/database`'s `UserRole.SUPER_ADMIN` — the one role every narrower reviewer guard in this codebase (`ReviewerGuard`, `IdentityReviewerGuard`, `CorpusReviewerGuard`) deliberately excludes as "general admin power", so it is the correct role for a route that *is* general admin power. */
export const OWNER_ROLE = 'SUPER_ADMIN';

/**
 * Gates the owner-only surfaces (today: the early-access CSV export) behind
 * a real, verified session — mirrors `IdentityReviewerGuard`/
 * `CorpusReviewerGuard`/`ReviewerGuard` exactly: reads `request.authUser`,
 * the identity `SessionAuthGuard` resolved from a session token, never a
 * client-supplied header. There is no admin-provisioning tooling in this
 * codebase yet (no seed row carries `SUPER_ADMIN`); granting it to the
 * owner's own account is a manual, owner-side step, same category as the
 * store-developer accounts under "Owner-gated" in the build ledger.
 */
@Injectable()
export class OwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.authUser?.user.role !== OWNER_ROLE) {
      throw new ForbiddenException({ code: 'OWNER_ROLE_REQUIRED', message: `Requires the ${OWNER_ROLE} role` });
    }

    return true;
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';

export const REVIEWER_ROLE_HEADER = 'x-reviewer-role';
export const REVIEWER_ID_HEADER = 'x-reviewer-id';

/** The one role this guard accepts — `packages/database`'s own `UserRole.CLINICAL_REVIEWER`, not an invented label. */
export const CLINICAL_REVIEWER_ROLE = 'CLINICAL_REVIEWER';

/**
 * Gates every credentialing-review route behind a distinct, declared role —
 * identity-and-credentialing.md §4: "access to the review queue is a
 * distinct role, not a general admin power." There is still no identity/auth
 * layer anywhere in this repo (the same gap every prior `apps/api` run in
 * `agent-progress.md` has named), so this cannot verify the caller actually
 * holds `CLINICAL_REVIEWER` the way a real session would — it can only
 * require the caller to explicitly declare it, the same honesty limit
 * `ownerId` already accepts everywhere else in this API (see
 * `EntitlementsGuard`'s own `extractOwnerId` comment). What this genuinely
 * buys even without real authentication: nobody lands on a review route by
 * accident the way an undifferentiated "is logged in" check would allow, and
 * the declared reviewer id is what `CredentialingService` attaches to every
 * audit entry and decision it records. Replace this with a real role check
 * the moment an identity/auth layer exists — do not read its presence today
 * as actual authorization.
 */
@Injectable()
export class ReviewerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();

    const role = firstHeader(request.headers[REVIEWER_ROLE_HEADER]);
    if (role !== CLINICAL_REVIEWER_ROLE) {
      throw new ForbiddenException({
        code: 'REVIEWER_ROLE_REQUIRED',
        message: `Requires the ${CLINICAL_REVIEWER_ROLE} role`,
      });
    }

    const reviewerId = firstHeader(request.headers[REVIEWER_ID_HEADER]);
    if (!reviewerId || reviewerId.trim().length === 0) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: `${REVIEWER_ID_HEADER} is required` });
    }

    return true;
  }
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

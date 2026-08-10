import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';

export const REVIEWER_ROLE_HEADER = 'x-reviewer-role';
export const REVIEWER_ID_HEADER = 'x-reviewer-id';

/**
 * The one role this guard accepts. Deliberately distinct from
 * `credentialing/reviewer.guard.ts`'s `CLINICAL_REVIEWER` — reading Nepali
 * conversational text for a leaked name or address is a different
 * competency and a different trust boundary from reading a council register,
 * and language-corpus.md never names credentialing review as a prerequisite
 * for this queue. Not yet in `packages/database`'s `UserRole` enum (that
 * package is not wired into `apps/api` by anything today — confirmed by
 * `grep -rn "@swasthya/database" apps/api/src` returning nothing — so there
 * is no live registry this could import from); add it there the day an
 * identity/auth layer makes that enum load-bearing.
 */
export const CORPUS_REVIEWER_ROLE = 'CORPUS_REVIEWER';

/**
 * Gates every corpus-review route behind a distinct, declared role —
 * language-corpus.md §5's mitigations rely on human review actually being
 * scoped to people trusted with de-identified conversational text, not a
 * general admin power. Structurally the same guard as
 * `credentialing/reviewer.guard.ts`: this repo still has no identity/auth
 * layer, so this cannot verify the caller actually holds
 * `CORPUS_REVIEWER` the way a real session would — it can only require the
 * caller to explicitly declare it, and the declared reviewer id is what
 * `LanguageCorpusService` attaches to every audit entry and decision it
 * records. Replace with a real role check the moment an identity/auth layer
 * exists — do not read its presence today as actual authorization.
 */
@Injectable()
export class CorpusReviewerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();

    const role = firstHeader(request.headers[REVIEWER_ROLE_HEADER]);
    if (role !== CORPUS_REVIEWER_ROLE) {
      throw new ForbiddenException({
        code: 'REVIEWER_ROLE_REQUIRED',
        message: `Requires the ${CORPUS_REVIEWER_ROLE} role`,
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

import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { FamilyGrantsService } from './family-grants.service.js';

/**
 * The real endpoint `apps/web`'s `AccountView.tsx` has been calling with
 * `[]`/`[]` since Round two D2, and the item the 2026-08-10/11 ledger
 * entries left as the next honest step. Guarded by `SessionAuthGuard`, the
 * same guard `AuthController`'s own `/auth/me` uses, and the subject id
 * comes from `@CurrentUser()` — never a query/path param — for the same
 * reason the records module's cross-owner fix moved ownership checks off a
 * client-supplied id: a grants list is exactly the kind of thing a forged
 * id could otherwise read for someone else.
 */
@ApiTags('family')
@Controller('family')
export class FamilyGrantsController {
  constructor(private readonly grants: FamilyGrantsService) {}

  @Get('grants')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Every guardianship/delegation grant where the signed-in subject is the guardian or the delegate' })
  grantsForCurrentUser(@CurrentUser() user: CurrentUserResult) {
    return this.grants.grantsFor(user.subjectId);
  }
}

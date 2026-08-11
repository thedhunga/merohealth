import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { FamilyGrantsService } from './family-grants.service.js';

// Mirrors `packages/family`'s `DelegationScope` union exactly — the
// controller boundary is where an out-of-range value from the client
// becomes a 400 rather than reaching `grantDelegation` at all.
const createDelegationSchema = z.object({
  delegatePhone: z.string().trim().min(1),
  scopes: z.array(z.enum(['VIEW_RECORD', 'ASK_ASSISTANT', 'MANAGE_APPOINTMENTS', 'UPLOAD_DOCUMENTS'])).min(1),
  expiresAt: z.string().trim().min(1),
});

function parseOrThrow<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Invalid request', details: parsed.error.flatten() });
  }
  return parsed.data;
}

/**
 * `GET /grants` is the real endpoint `apps/web`'s `AccountView.tsx` has
 * been calling with `[]`/`[]` since Round two D2, and the item the
 * 2026-08-10/11 ledger entries left as the next honest step. `POST
 * /grants/delegations` is this run's addition — the first real caller of
 * `packages/family`'s `grantDelegation`. Both are guarded by
 * `SessionAuthGuard`, the same guard `AuthController`'s own `/auth/me`
 * uses, and both take the acting subject id from `@CurrentUser()` — never a
 * query/path param or a request-body field — for the same reason the
 * records module's cross-owner fix moved ownership checks off a
 * client-supplied id: a forged `granterId` would let anyone hand out access
 * to someone else's record.
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

  @Post('grants/delegations')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Self-service: the signed-in subject delegates scoped access to another registered person, found by phone number' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['delegatePhone', 'scopes', 'expiresAt'],
      properties: {
        delegatePhone: { type: 'string' },
        scopes: { type: 'array', items: { type: 'string', enum: ['VIEW_RECORD', 'ASK_ASSISTANT', 'MANAGE_APPOINTMENTS', 'UPLOAD_DOCUMENTS'] } },
        expiresAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  createDelegation(@CurrentUser() user: CurrentUserResult, @Body() body: unknown) {
    const input = parseOrThrow(createDelegationSchema, body);
    return this.grants.createDelegation(user.subjectId, input.delegatePhone, input.scopes, input.expiresAt);
  }
}

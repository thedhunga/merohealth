import { BadRequestException, Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { FamilyGrantsService } from './family-grants.service.js';

// Same "explicit over a library validator" regex `scheduling` and
// `population-health` already apply to their own instant fields — matched
// here too so a malformed `expiresAt` (e.g. `"forever"`) 400s at the
// boundary instead of reaching `grantDelegation`, whose own guard
// (`expiresAt <= grantedAt`) is a string comparison that a non-ISO value can
// silently dodge, producing a delegation that never lapses.
const isoInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

// Mirrors `packages/family`'s `DelegationScope` union exactly — the
// controller boundary is where an out-of-range value from the client
// becomes a 400 rather than reaching `grantDelegation` at all.
const createDelegationSchema = z.object({
  delegatePhone: z.string().trim().min(1).max(20),
  scopes: z.array(z.enum(['VIEW_RECORD', 'ASK_ASSISTANT', 'MANAGE_APPOINTMENTS', 'UPLOAD_DOCUMENTS'])).min(1),
  expiresAt: z.string().regex(isoInstant, 'expiresAt must be an ISO 8601 UTC instant'),
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
 * /grants/delegations` was the first real caller of `packages/family`'s
 * `grantDelegation`. `DELETE /grants/delegations/:id` is this run's
 * addition — the granter's own way to see (`GET /grants`'s
 * `delegationsGranted`) and take back (this route) access she granted,
 * the "next natural piece" the 2026-08-11 delegation-creation ledger entry
 * named. All three are guarded by `SessionAuthGuard`, the same guard
 * `AuthController`'s own `/auth/me` uses, and all three take the acting
 * subject id from `@CurrentUser()` — never a query/path param or a
 * request-body field — for the same reason the records module's cross-owner
 * fix moved ownership checks off a client-supplied id: a forged `granterId`
 * would let anyone hand out, or take back, access to someone else's record.
 * The delegation id itself *is* a path param on the revoke route — that is
 * fine, because `FamilyGrantsService.revokeDelegation` still checks it
 * against `@CurrentUser()`'s id before touching anything, 404ing a mismatch
 * exactly like the records module's `ownerId` check does.
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

  @Delete('grants/delegations/:id')
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Revokes a delegation grant the signed-in subject made as granter' })
  revokeDelegation(@CurrentUser() user: CurrentUserResult, @Param('id') id: string) {
    return this.grants.revokeDelegation(user.subjectId, id);
  }
}

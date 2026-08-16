import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { TwinProfileService } from './twin-profile.service.js';

// The exact code sets `apps/web/src/lib/profile-prompts.ts` offers as chip
// options — `.enum`, not a free `.string()`, deliberately: these values
// become structured `TwinFact`s, not free-text like `history`'s
// question/answer, so this boundary is the one place to refuse anything
// outside the known set rather than persisting an invented condition or age
// band. `'none'` is not in the conditions enum on purpose — the client's own
// `answerPrompt` already turns a "none" chip tap into an empty array before
// this is ever called (see `GetCareFlow.tsx`), so a caller sending it here
// would be malformed input, correctly rejected.
const confirmProfileSchema = z
  .object({
    ageBand: z.enum(['under18', '18to40', '40to60', 'over60']).optional(),
    askingFor: z.enum(['self', 'child', 'parent', 'other']).optional(),
    conditions: z.array(z.enum(['diabetes', 'bloodPressure', 'thyroid'])).max(3).optional(),
  })
  .refine((v) => Boolean(v.ageBand) || Boolean(v.askingFor) || (v.conditions?.length ?? 0) > 0, {
    message: 'At least one field is required',
  });

function parseOrThrow<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Invalid request', details: parsed.error.flatten() });
  }
  return parsed.data;
}

/**
 * Round four F2, the server half. `apps/web`'s `ProfileConfirmationCard`
 * (rendered on `/account` once) is the only caller: it shows back exactly
 * what the anonymous session captured — `HistoryMigration.profileSnapshot`,
 * via a local stash carried across the sign-in redirect, not re-read from
 * this API — and only reaches this route once the person taps "save to my
 * profile" over "not now". The subject comes from `@CurrentUser()`, never
 * the request body, the same cross-owner protection `HistoryController` and
 * `FamilyGrantsController` already apply.
 */
@ApiTags('twin')
@Controller('twin')
export class TwinProfileController {
  constructor(private readonly twinProfile: TwinProfileService) {}

  @Post('confirm-profile')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Turns a confirmed subset of the anonymous profile hint into PATIENT_REPORTED/PATIENT_CONFIRMED twin facts on the signed-in subject' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ageBand: { type: 'string', enum: ['under18', '18to40', '40to60', 'over60'] },
        askingFor: { type: 'string', enum: ['self', 'child', 'parent', 'other'] },
        conditions: { type: 'array', items: { type: 'string', enum: ['diabetes', 'bloodPressure', 'thyroid'] } },
      },
    },
  })
  async confirmProfile(@CurrentUser() user: CurrentUserResult, @Body() body: unknown) {
    const input = parseOrThrow(confirmProfileSchema, body);
    const result = await this.twinProfile.confirmProfile(user.subjectId, input);
    return { ok: true, created: result.created };
  }
}

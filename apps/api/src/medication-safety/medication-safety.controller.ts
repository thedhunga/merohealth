import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { MedicationSafetyService } from './medication-safety.service.js';

// No `patientId` field: the earlier body-supplied value let any caller read
// any patient's active allergies and medications back out through
// `findings` — the same client-supplied-owner gap `records.controller.ts`'s
// `captureSchema` comment describes, and the same fix (§3 there): the
// subject is always the session identity, never a client-supplied value.
const checkSchema = z.object({
  proposedLabel: z.string().trim().min(1).max(500),
});

function parseOrThrow<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details: parsed.error.flatten(),
    });
  }
  return parsed.data;
}

/** Row 5 of clinical-suite.md's capability map: drug interaction / allergy checking. */
@ApiTags('medication-safety')
@Controller('medication-safety')
export class MedicationSafetyController {
  constructor(private readonly medicationSafety: MedicationSafetyService) {}

  @Get('health')
  @ApiOperation({ summary: "clinical-suite.md §2's ModuleDescriptor.health(), exposed over HTTP" })
  health() {
    return this.medicationSafety.health();
  }

  @Post('check')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary:
      "Check a proposed medication against the caller's own active allergies, active medications, and the interaction ruleset. Returns checked:false, not an error, while clinical-summary is unavailable.",
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['proposedLabel'],
      properties: {
        proposedLabel: { type: 'string' },
      },
    },
  })
  check(@CurrentUser() user: CurrentUserResult, @Body() body: unknown) {
    const { proposedLabel } = parseOrThrow(checkSchema, body);
    return this.medicationSafety.checkMedication(user.subjectId, proposedLabel);
  }
}

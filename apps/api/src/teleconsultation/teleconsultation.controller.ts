import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { EntitlementsGuard } from '../entitlements/entitlements.guard.js';
import { RequireModule } from '../entitlements/require-entitlement.decorator.js';
import { TeleconsultationService } from './teleconsultation.service.js';

const cancelSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
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

/**
 * Row 9 of clinical-suite.md's capability map: telehealth.
 *
 * `TELECONSULTATION` is a `ModuleKey` in `packages/entitlements` too (PRO
 * tier only), unlike most rows in this suite — so unlike its siblings it is
 * not excused from the "modules ship without entitlement wiring" pattern.
 * `schedule` is the one route additionally gated behind `EntitlementsGuard`,
 * the same precedent `RecordsController` set for `capture`: the module
 * boundary belongs on the action that starts something new. But every route
 * below — including reading or transitioning a session that already exists
 * — still requires `SessionAuthGuard`. A prior version of this file left
 * `listSessions`/`getSession`/`start`/`complete`/`cancel`/`noShow` fully
 * unauthenticated, reasoning by a misreading of that same
 * `RecordsController` precedent: every one of its read/mutate routes
 * (`list`/`observationsForDocument`/`timeline`/`confirm`/`correct`/`reject`)
 * *does* carry `SessionAuthGuard`, only `EntitlementsGuard` is reserved for
 * `capture`. That let any unauthenticated caller list or read every
 * patient's teleconsultation sessions system-wide, and cancel or mark
 * no-show on a session that was not theirs. `TeleconsultationService` now
 * 404s a session id whose `patientId` does not match the caller, the same
 * "belongs to someone else 404s like it doesn't exist" rule
 * `RecordsService.#requireObservation` already uses.
 */
@ApiTags('teleconsultation')
@Controller('teleconsultation')
export class TeleconsultationController {
  constructor(private readonly teleconsultation: TeleconsultationService) {}

  @Get('health')
  @ApiOperation({ summary: "clinical-suite.md §2's ModuleDescriptor.health(), exposed over HTTP" })
  health() {
    return this.teleconsultation.health();
  }

  @Post('appointments/:appointmentId/sessions')
  @UseGuards(SessionAuthGuard, EntitlementsGuard)
  @RequireModule('TELECONSULTATION')
  @ApiParam({ name: 'appointmentId' })
  @ApiOperation({
    summary:
      'Book a teleconsultation session against an appointment. Refused (503) while scheduling is unavailable, ' +
      '(401) with no session, (403) without the TELECONSULTATION module.',
  })
  schedule(@Param('appointmentId') appointmentId: string) {
    return this.teleconsultation.scheduleSession(appointmentId);
  }

  @Get('sessions')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: "List the signed-in caller's own teleconsultation sessions" })
  listSessions(@CurrentUser() user: CurrentUserResult) {
    const sessions = this.teleconsultation.listSessions(user.subjectId);
    return { sessions, total: sessions.length };
  }

  @Get('sessions/:sessionId')
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({ summary: "Read one of the caller's own teleconsultation sessions by opaque id" })
  getSession(@CurrentUser() user: CurrentUserResult, @Param('sessionId') sessionId: string) {
    return this.teleconsultation.getSession(sessionId, user.subjectId);
  }

  @Post('sessions/:sessionId/start')
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({ summary: 'Start a SCHEDULED session. Rejected on a session already started, ended or cancelled.' })
  start(@CurrentUser() user: CurrentUserResult, @Param('sessionId') sessionId: string) {
    return this.teleconsultation.startSession(sessionId, user.subjectId);
  }

  @Post('sessions/:sessionId/complete')
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({ summary: 'Complete an ACTIVE session. Rejected on a session that was never started.' })
  complete(@CurrentUser() user: CurrentUserResult, @Param('sessionId') sessionId: string) {
    return this.teleconsultation.completeSession(sessionId, user.subjectId);
  }

  @Post('sessions/:sessionId/cancel')
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({ summary: 'Cancel a SCHEDULED session. Rejected once it has started, ended or is already cancelled.' })
  @ApiBody({ schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } } })
  cancel(@CurrentUser() user: CurrentUserResult, @Param('sessionId') sessionId: string, @Body() body: unknown) {
    return this.teleconsultation.cancelSession(sessionId, user.subjectId, parseOrThrow(cancelSchema, body).reason);
  }

  @Post('sessions/:sessionId/no-show')
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({ summary: 'Mark a SCHEDULED session no-show. Rejected once it has started, ended or is cancelled.' })
  noShow(@CurrentUser() user: CurrentUserResult, @Param('sessionId') sessionId: string) {
    return this.teleconsultation.markNoShow(sessionId, user.subjectId);
  }
}

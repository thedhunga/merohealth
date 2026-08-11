import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { TeleconsultationService } from './teleconsultation.service.js';

const cancelSchema = z.object({
  reason: z.string().trim().min(1),
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

/** Row 9 of clinical-suite.md's capability map: telehealth. */
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
  @ApiParam({ name: 'appointmentId' })
  @ApiOperation({
    summary: 'Book a teleconsultation session against an appointment. Refused (503) while scheduling is unavailable.',
  })
  schedule(@Param('appointmentId') appointmentId: string) {
    return this.teleconsultation.scheduleSession(appointmentId);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List teleconsultation sessions, optionally filtered by patientId' })
  @ApiQuery({ name: 'patientId', required: false })
  listSessions(@Query('patientId') patientId?: string) {
    const sessions = this.teleconsultation.listSessions(patientId);
    return { sessions, total: sessions.length };
  }

  @Get('sessions/:sessionId')
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({ summary: 'Read one teleconsultation session by opaque id' })
  getSession(@Param('sessionId') sessionId: string) {
    return this.teleconsultation.getSession(sessionId);
  }

  @Post('sessions/:sessionId/start')
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({ summary: 'Start a SCHEDULED session. Rejected on a session already started, ended or cancelled.' })
  start(@Param('sessionId') sessionId: string) {
    return this.teleconsultation.startSession(sessionId);
  }

  @Post('sessions/:sessionId/complete')
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({ summary: 'Complete an ACTIVE session. Rejected on a session that was never started.' })
  complete(@Param('sessionId') sessionId: string) {
    return this.teleconsultation.completeSession(sessionId);
  }

  @Post('sessions/:sessionId/cancel')
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({ summary: 'Cancel a SCHEDULED session. Rejected once it has started, ended or is already cancelled.' })
  @ApiBody({ schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } } })
  cancel(@Param('sessionId') sessionId: string, @Body() body: unknown) {
    return this.teleconsultation.cancelSession(sessionId, parseOrThrow(cancelSchema, body).reason);
  }

  @Post('sessions/:sessionId/no-show')
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({ summary: 'Mark a SCHEDULED session no-show. Rejected once it has started, ended or is cancelled.' })
  noShow(@Param('sessionId') sessionId: string) {
    return this.teleconsultation.markNoShow(sessionId);
  }
}

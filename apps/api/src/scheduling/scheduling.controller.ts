import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { SchedulingService } from './scheduling.service.js';

// `createdAt`/`updatedAt` throughout this API come from `new Date().toISOString()`,
// which always emits this exact `.SSSZ` shape — matched by regex, not zod's
// built-in `.datetime()`, for the same "explicit over a library validator"
// reason `patient-registry`'s `dateOfBirth` regex already set.
const isoInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

const scheduleSchema = z.object({
  patientId: z.string().trim().min(1).max(200),
  clinicianId: z.string().trim().min(1).max(200),
  scheduledStart: z.string().regex(isoInstant, 'scheduledStart must be an ISO 8601 UTC instant'),
  scheduledEnd: z.string().regex(isoInstant, 'scheduledEnd must be an ISO 8601 UTC instant'),
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
 * Row 2 of clinical-suite.md's capability map. No list-all route, matching
 * `PatientRegistryController`'s own precedent — every caller here already
 * holds the appointment id it wants, from having just scheduled it.
 */
@ApiTags('scheduling')
@Controller('appointments')
export class SchedulingController {
  constructor(private readonly appointments: SchedulingService) {}

  @Get('health')
  @ApiOperation({ summary: "clinical-suite.md §2's ModuleDescriptor.health(), exposed over HTTP" })
  health() {
    return this.appointments.health();
  }

  @Post()
  @ApiOperation({ summary: 'Schedule an appointment. Refused (503) while patient-registry is unavailable.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['patientId', 'clinicianId', 'scheduledStart', 'scheduledEnd'],
      properties: {
        patientId: { type: 'string' },
        clinicianId: { type: 'string' },
        scheduledStart: { type: 'string', example: '2026-08-10T09:00:00.000Z' },
        scheduledEnd: { type: 'string', example: '2026-08-10T09:30:00.000Z' },
      },
    },
  })
  schedule(@Body() body: unknown) {
    return this.appointments.schedule(parseOrThrow(scheduleSchema, body));
  }

  @Get(':appointmentId')
  @ApiParam({ name: 'appointmentId' })
  @ApiOperation({ summary: 'Read one appointment by opaque id — served from persisted data regardless of dependencies' })
  get(@Param('appointmentId') appointmentId: string) {
    return this.appointments.get(appointmentId);
  }

  @Post(':appointmentId/cancel')
  @ApiParam({ name: 'appointmentId' })
  @ApiOperation({ summary: 'Cancel an appointment. Refused (503) while patient-registry is unavailable.' })
  cancel(@Param('appointmentId') appointmentId: string) {
    return this.appointments.cancel(appointmentId);
  }
}

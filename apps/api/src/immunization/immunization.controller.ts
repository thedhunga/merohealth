import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { ImmunizationService } from './immunization.service.js';

const doseNumberSchema = z.number().int().min(1);
// Matches patient-registry's dateOfBirth convention, not the isoInstant one records/scheduling/
// family-grants/language-corpus use: every administeredOn example and seed row here is a bare
// YYYY-MM-DD, and the ApiBody schemas below already document it as `format: 'date'`.
const administeredOnSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'administeredOn must be YYYY-MM-DD');

// No `patientId` field: a client-supplied value here let any caller plant a
// fake immunization under someone else's id and, through `listRecords`/
// `getRecord` below, read back any patient's own — the same gap
// `clinical-summary.controller.ts`'s `recordPatientReportedSchema` comment
// describes, and the same fix: the subject is always the session identity.
const recordPatientReportedSchema = z.object({
  vaccineName: z.string().trim().min(1).max(300),
  doseNumber: doseNumberSchema,
  administeredOn: administeredOnSchema,
});

const recordClinicianAdministeredSchema = z.object({
  clinicianId: z.string().trim().min(1).max(200),
  vaccineName: z.string().trim().min(1).max(300),
  doseNumber: doseNumberSchema,
  administeredOn: administeredOnSchema,
});

const voidRecordSchema = z.object({ reason: z.string().trim().min(1).max(2000) });

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
 * Row 18 of clinical-suite.md's capability map: immunization records.
 * `recordPatientReported`/`listRecords`/`getRecord` are the patient-facing
 * routes — gated behind `SessionAuthGuard`, the subject always the caller's
 * own session id, same shape `clinical-summary.controller.ts` and
 * `diagnostics-orders.controller.ts` established. `recordClinicianAdministered`/
 * `voidRecord` stay ungated on purpose: they are clinician-workflow actions
 * (`clinicianId`/void `reason` are free text, no patient identity in the
 * picture at all for `voidRecord`) and this app has no clinician-side
 * session to check them against yet — the same documented exception
 * `clinical-charting.controller.ts` and `diagnostics-orders.controller.ts`'s
 * `recordResult`/`release`/`cancel` carry.
 */
@ApiTags('immunization')
@Controller('immunization')
export class ImmunizationController {
  constructor(private readonly immunization: ImmunizationService) {}

  @Get('health')
  @ApiOperation({ summary: "clinical-suite.md §2's ModuleDescriptor.health(), exposed over HTTP" })
  health() {
    return this.immunization.health();
  }

  @Post('records')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Record an immunization the signed-in caller reports about themselves' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['vaccineName', 'doseNumber', 'administeredOn'],
      properties: {
        vaccineName: { type: 'string', example: 'Tetanus toxoid' },
        doseNumber: { type: 'integer', minimum: 1 },
        administeredOn: { type: 'string', format: 'date' },
      },
    },
  })
  recordPatientReported(@CurrentUser() user: CurrentUserResult, @Body() body: unknown) {
    const input = parseOrThrow(recordPatientReportedSchema, body);
    return this.immunization.recordPatientReported({ ...input, patientId: user.subjectId });
  }

  @Post('encounters/:encounterId/records')
  @ApiParam({ name: 'encounterId' })
  @ApiOperation({
    summary:
      'Record a clinician-administered immunization against an encounter. Refused (503) while clinical-charting is unavailable.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['clinicianId', 'vaccineName', 'doseNumber', 'administeredOn'],
      properties: {
        clinicianId: { type: 'string' },
        vaccineName: { type: 'string', example: 'Hepatitis B' },
        doseNumber: { type: 'integer', minimum: 1 },
        administeredOn: { type: 'string', format: 'date' },
      },
    },
  })
  recordClinicianAdministered(@Param('encounterId') encounterId: string, @Body() body: unknown) {
    return this.immunization.recordClinicianAdministered(
      encounterId,
      parseOrThrow(recordClinicianAdministeredSchema, body),
    );
  }

  @Get('records')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: "List the signed-in caller's own immunization records" })
  listRecords(@CurrentUser() user: CurrentUserResult) {
    const records = this.immunization.listRecords(user.subjectId);
    return { records, total: records.length };
  }

  @Get('records/:recordId')
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'recordId' })
  @ApiOperation({ summary: "Read one of the signed-in caller's own immunization records by opaque id" })
  getRecord(@CurrentUser() user: CurrentUserResult, @Param('recordId') recordId: string) {
    return this.immunization.getOwnRecord(recordId, user.subjectId);
  }

  @Post('records/:recordId/void')
  @ApiParam({ name: 'recordId' })
  @ApiOperation({ summary: 'Void a mis-entered immunization record with a reason. Rejected if already voided.' })
  @ApiBody({ schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } } })
  voidRecord(@Param('recordId') recordId: string, @Body() body: unknown) {
    const { reason } = parseOrThrow(voidRecordSchema, body);
    return this.immunization.voidRecord(recordId, reason);
  }
}

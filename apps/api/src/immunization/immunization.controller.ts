import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ImmunizationService } from './immunization.service.js';

const doseNumberSchema = z.number().int().min(1);
const administeredOnSchema = z.string().trim().min(1);

const recordPatientReportedSchema = z.object({
  patientId: z.string().trim().min(1),
  vaccineName: z.string().trim().min(1),
  doseNumber: doseNumberSchema,
  administeredOn: administeredOnSchema,
});

const recordClinicianAdministeredSchema = z.object({
  clinicianId: z.string().trim().min(1),
  vaccineName: z.string().trim().min(1),
  doseNumber: doseNumberSchema,
  administeredOn: administeredOnSchema,
});

const voidRecordSchema = z.object({ reason: z.string().trim().min(1) });

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

/** Row 18 of clinical-suite.md's capability map: immunization records. */
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
  @ApiOperation({ summary: 'Record a patient-reported immunization' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['patientId', 'vaccineName', 'doseNumber', 'administeredOn'],
      properties: {
        patientId: { type: 'string' },
        vaccineName: { type: 'string', example: 'Tetanus toxoid' },
        doseNumber: { type: 'integer', minimum: 1 },
        administeredOn: { type: 'string', format: 'date' },
      },
    },
  })
  recordPatientReported(@Body() body: unknown) {
    return this.immunization.recordPatientReported(parseOrThrow(recordPatientReportedSchema, body));
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
  @ApiOperation({ summary: 'List immunization records, optionally filtered by patientId' })
  @ApiQuery({ name: 'patientId', required: false })
  listRecords(@Query('patientId') patientId?: string) {
    const records = this.immunization.listRecords(patientId);
    return { records, total: records.length };
  }

  @Get('records/:recordId')
  @ApiParam({ name: 'recordId' })
  @ApiOperation({ summary: 'Read one immunization record by opaque id' })
  getRecord(@Param('recordId') recordId: string) {
    return this.immunization.getRecord(recordId);
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

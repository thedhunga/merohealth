import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ClinicalSummaryService } from './clinical-summary.service.js';

const summaryKindSchema = z.enum(['CONDITION', 'ALLERGY', 'MEDICATION']);

const recordPatientReportedSchema = z.object({
  patientId: z.string().trim().min(1),
  kind: summaryKindSchema,
  label: z.string().trim().min(1),
  value: z.string().trim().min(1),
});

const recordClinicianAuthoredSchema = z.object({
  clinicianId: z.string().trim().min(1),
  kind: summaryKindSchema,
  label: z.string().trim().min(1),
  value: z.string().trim().min(1),
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

/** Row 4 of clinical-suite.md's capability map: problem list, allergies, medications. */
@ApiTags('clinical-summary')
@Controller('clinical-summary')
export class ClinicalSummaryController {
  constructor(private readonly summary: ClinicalSummaryService) {}

  @Get('health')
  @ApiOperation({ summary: "clinical-suite.md §2's ModuleDescriptor.health(), exposed over HTTP" })
  health() {
    return this.summary.health();
  }

  @Post('items')
  @ApiOperation({ summary: 'Record a patient-reported condition, allergy or medication' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['patientId', 'kind', 'label', 'value'],
      properties: {
        patientId: { type: 'string' },
        kind: { enum: ['CONDITION', 'ALLERGY', 'MEDICATION'] },
        label: { type: 'string' },
        value: { type: 'string' },
      },
    },
  })
  recordPatientReported(@Body() body: unknown) {
    return this.summary.recordPatientReported(parseOrThrow(recordPatientReportedSchema, body));
  }

  @Post('encounters/:encounterId/items')
  @ApiParam({ name: 'encounterId' })
  @ApiOperation({
    summary:
      'Record a clinician-authored condition, allergy or medication against an encounter. Refused (503) while clinical-charting is unavailable.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['clinicianId', 'kind', 'label', 'value'],
      properties: {
        clinicianId: { type: 'string' },
        kind: { enum: ['CONDITION', 'ALLERGY', 'MEDICATION'] },
        label: { type: 'string' },
        value: { type: 'string' },
      },
    },
  })
  recordClinicianAuthored(@Param('encounterId') encounterId: string, @Body() body: unknown) {
    return this.summary.recordClinicianAuthored(encounterId, parseOrThrow(recordClinicianAuthoredSchema, body));
  }

  @Get('items')
  @ApiOperation({ summary: 'List summary items, optionally filtered by patientId and/or kind' })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'kind', required: false, enum: ['CONDITION', 'ALLERGY', 'MEDICATION'] })
  listItems(@Query('patientId') patientId?: string, @Query('kind') kind?: string) {
    const items = this.summary.listItems(patientId, kind === undefined ? undefined : parseOrThrow(summaryKindSchema, kind));
    return { items, total: items.length };
  }

  @Get('items/:itemId')
  @ApiParam({ name: 'itemId' })
  @ApiOperation({ summary: 'Read one summary item by opaque id' })
  getItem(@Param('itemId') itemId: string) {
    return this.summary.getItem(itemId);
  }

  @Post('items/:itemId/resolve')
  @ApiParam({ name: 'itemId' })
  @ApiOperation({ summary: 'Mark a summary item resolved. Rejected if already resolved.' })
  resolveItem(@Param('itemId') itemId: string) {
    return this.summary.resolveItem(itemId);
  }
}

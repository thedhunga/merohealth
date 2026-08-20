import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { ClinicalSummaryService } from './clinical-summary.service.js';

const summaryKindSchema = z.enum(['CONDITION', 'ALLERGY', 'MEDICATION']);

// No `patientId` field: a client-supplied value here let any caller plant a
// fake condition/allergy/medication under someone else's id and, through
// `listItems`/`getItem` below, read back any patient's own — the same gap
// `medication-safety.controller.ts`'s `checkSchema` comment describes, and
// the same fix: the subject is always the session identity.
const recordPatientReportedSchema = z.object({
  kind: summaryKindSchema,
  label: z.string().trim().min(1).max(200),
  value: z.string().trim().min(1).max(1000),
});

const recordClinicianAuthoredSchema = z.object({
  clinicianId: z.string().trim().min(1).max(200),
  kind: summaryKindSchema,
  label: z.string().trim().min(1).max(200),
  value: z.string().trim().min(1).max(1000),
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
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: "Record a condition, allergy or medication the signed-in caller reports about themselves" })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['kind', 'label', 'value'],
      properties: {
        kind: { enum: ['CONDITION', 'ALLERGY', 'MEDICATION'] },
        label: { type: 'string' },
        value: { type: 'string' },
      },
    },
  })
  recordPatientReported(@CurrentUser() user: CurrentUserResult, @Body() body: unknown) {
    const input = parseOrThrow(recordPatientReportedSchema, body);
    return this.summary.recordPatientReported({ ...input, patientId: user.subjectId });
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
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: "List the signed-in caller's own summary items, optionally filtered by kind" })
  @ApiQuery({ name: 'kind', required: false, enum: ['CONDITION', 'ALLERGY', 'MEDICATION'] })
  listItems(@CurrentUser() user: CurrentUserResult, @Query('kind') kind?: string) {
    const items = this.summary.listItems(user.subjectId, kind === undefined ? undefined : parseOrThrow(summaryKindSchema, kind));
    return { items, total: items.length };
  }

  @Get('items/:itemId')
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'itemId' })
  @ApiOperation({ summary: "Read one of the signed-in caller's own summary items by opaque id" })
  getItem(@CurrentUser() user: CurrentUserResult, @Param('itemId') itemId: string) {
    return this.summary.getItem(itemId, user.subjectId);
  }

  @Post('items/:itemId/resolve')
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'itemId' })
  @ApiOperation({ summary: "Mark one of the signed-in caller's own summary items resolved. Rejected if already resolved." })
  resolveItem(@CurrentUser() user: CurrentUserResult, @Param('itemId') itemId: string) {
    return this.summary.resolveItem(itemId, user.subjectId);
  }
}

import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { EntitlementsGuard } from '../entitlements/entitlements.guard.js';
import { RequireModule, RequireQuota } from '../entitlements/require-entitlement.decorator.js';
import { RecordsService } from './records.service.js';

// Same regex `SchedulingController`/`FamilyGrantsController`/
// `LanguageCorpusController` each define for their own instant fields.
// `documentDate` is stored and compared against `capturedAt`
// (`new Date().toISOString()`, records.service.ts) as the same shape — the
// seed data (`packages/database/src/seed-data.ts`) already writes it as a
// full instant like `2026-05-18T00:00:00Z`, not a bare date.
const isoInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

const documentKindSchema = z.enum([
  'LAB_REPORT',
  'PRESCRIPTION',
  'IMAGING_REPORT',
  'DISCHARGE_SUMMARY',
  'VACCINATION_RECORD',
  'CLINICAL_NOTE',
  'BILL',
  'OTHER',
]);

// No `ownerId` field: Round two A4 moved capture's owner from a
// client-supplied body value to the caller's verified `subjectId` (see
// `capture()` below), so the body has nothing left to say about who owns
// the document.
const captureSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  kind: documentKindSchema,
  title: z.string().trim().min(1).max(200),
  // `buildTimeline` (packages/health-records) sorts on `Date.parse(documentDate
  // ?? capturedAt)` and `toFhirDocumentReference` (packages/interop) writes it
  // straight into a FHIR `DocumentReference.date` — an unvalidated string lets
  // a malformed value silently break timeline ordering and corrupt an export.
  documentDate: z.string().regex(isoInstant, 'documentDate must be an ISO 8601 UTC instant').nullable().default(null),
  sensitivity: z.enum(['STANDARD', 'SENSITIVE', 'RESTRICTED']).default('STANDARD'),
  clientEncrypted: z.boolean().default(false),
  contentType: z.string().trim().min(1).nullable().default(null),
  // JSON has no binary type; the mobile/web capture flow base64-encodes the
  // file before this reaches the API.
  bytesBase64: z.string().trim().min(1),
  pageCount: z.number().int().positive().default(1),
});

// No `ownerId` field, same reason `captureSchema` above has none: the owner
// is always the session identity, never a client-supplied value.
const correctSchema = z.object({
  value: z.string().trim().min(1),
  // Omitted keeps the observation's existing unit; explicit null clears it.
  unit: z.string().trim().min(1).nullable().optional(),
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

@ApiTags('records')
@Controller('records')
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Get('health')
  @ApiOperation({ summary: "clinical-suite.md §2's ModuleDescriptor.health(), exposed over HTTP" })
  health() {
    return this.records.health();
  }

  @Post('documents')
  @UseGuards(SessionAuthGuard, EntitlementsGuard)
  @RequireModule('HEALTH_RECORD')
  @RequireQuota('DOCUMENTS_STORED')
  @ApiOperation({ summary: 'Capture a document: upload bytes through the storage port and record it, owned by the signed-in caller' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['filename', 'kind', 'title', 'bytesBase64'],
      properties: {
        filename: { type: 'string' },
        kind: { enum: documentKindSchema.options },
        title: { type: 'string' },
        documentDate: { type: 'string', nullable: true },
        sensitivity: { enum: ['STANDARD', 'SENSITIVE', 'RESTRICTED'] },
        clientEncrypted: { type: 'boolean' },
        contentType: { type: 'string', nullable: true },
        bytesBase64: { type: 'string' },
        pageCount: { type: 'integer' },
      },
    },
  })
  async capture(@CurrentUser() user: CurrentUserResult, @Body() body: unknown) {
    const input = parseOrThrow(captureSchema, body);
    return this.records.captureDocument({
      ...input,
      ownerId: user.subjectId,
      bytes: Buffer.from(input.bytesBase64, 'base64'),
    });
  }

  @Get('documents')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: "List the signed-in caller's own captured documents" })
  list(@CurrentUser() user: CurrentUserResult) {
    const items = this.records.listDocuments(user.subjectId);
    return { items, total: items.length };
  }

  @Get('documents/:documentId/observations')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'List every observation extracted from one of the caller\'s own documents, draft included' })
  @ApiParam({ name: 'documentId' })
  observationsForDocument(
    @CurrentUser() user: CurrentUserResult,
    @Param('documentId') documentId: string,
  ) {
    const items = this.records.listDocumentObservations(documentId, user.subjectId);
    return { items, total: items.length };
  }

  @Get('timeline')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: "Reverse-chronological record view for the signed-in caller" })
  timeline(@CurrentUser() user: CurrentUserResult) {
    const items = this.records.timeline(user.subjectId);
    return { items, total: items.length };
  }

  @Post('observations/:observationId/confirm')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: "Confirm one of the caller's own observations as-extracted" })
  @ApiParam({ name: 'observationId' })
  confirm(@CurrentUser() user: CurrentUserResult, @Param('observationId') observationId: string) {
    return this.records.confirm(observationId, user.subjectId);
  }

  @Post('observations/:observationId/correct')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: "Replace one of the caller's own observations with the person's own value" })
  @ApiParam({ name: 'observationId' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['value'],
      properties: {
        value: { type: 'string' },
        unit: { type: 'string', nullable: true },
      },
    },
  })
  correct(
    @CurrentUser() user: CurrentUserResult,
    @Param('observationId') observationId: string,
    @Body() body: unknown,
  ) {
    const input = parseOrThrow(correctSchema, body);
    return this.records.correct(observationId, user.subjectId, input.value, input.unit);
  }

  @Post('observations/:observationId/reject')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: "Reject one of the caller's own observations, extracted in error" })
  @ApiParam({ name: 'observationId' })
  reject(@CurrentUser() user: CurrentUserResult, @Param('observationId') observationId: string) {
    return this.records.reject(observationId, user.subjectId);
  }
}

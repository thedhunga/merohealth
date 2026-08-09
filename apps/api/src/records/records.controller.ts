import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { RecordsService } from './records.service.js';

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

const captureSchema = z.object({
  ownerId: z.string().trim().min(1),
  filename: z.string().trim().min(1).max(255),
  kind: documentKindSchema,
  title: z.string().trim().min(1).max(200),
  documentDate: z.string().trim().min(1).nullable().default(null),
  sensitivity: z.enum(['STANDARD', 'SENSITIVE', 'RESTRICTED']).default('STANDARD'),
  clientEncrypted: z.boolean().default(false),
  contentType: z.string().trim().min(1).nullable().default(null),
  // JSON has no binary type; the mobile/web capture flow base64-encodes the
  // file before this reaches the API.
  bytesBase64: z.string().trim().min(1),
  pageCount: z.number().int().positive().default(1),
});

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

function requireOwnerId(ownerId: string | undefined): string {
  const parsed = z.string().trim().min(1).safeParse(ownerId);
  if (!parsed.success) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'ownerId is required' });
  }
  return parsed.data;
}

@ApiTags('records')
@Controller('records')
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Post('documents')
  @ApiOperation({ summary: 'Capture a document: upload bytes through the storage port and record it' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['ownerId', 'filename', 'kind', 'title', 'bytesBase64'],
      properties: {
        ownerId: { type: 'string' },
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
  async capture(@Body() body: unknown) {
    const input = parseOrThrow(captureSchema, body);
    return this.records.captureDocument({
      ...input,
      bytes: Buffer.from(input.bytesBase64, 'base64'),
    });
  }

  @Get('documents')
  @ApiOperation({ summary: "List an owner's captured documents" })
  @ApiQuery({ name: 'ownerId', required: true })
  list(@Query('ownerId') ownerId?: string) {
    const items = this.records.listDocuments(requireOwnerId(ownerId));
    return { items, total: items.length };
  }

  @Get('documents/:documentId/observations')
  @ApiOperation({ summary: 'List every observation extracted from one document, draft included' })
  @ApiParam({ name: 'documentId' })
  observationsForDocument(@Param('documentId') documentId: string) {
    const items = this.records.listDocumentObservations(documentId);
    return { items, total: items.length };
  }

  @Get('timeline')
  @ApiOperation({ summary: 'Reverse-chronological record view for one owner' })
  @ApiQuery({ name: 'ownerId', required: true })
  timeline(@Query('ownerId') ownerId?: string) {
    const items = this.records.timeline(requireOwnerId(ownerId));
    return { items, total: items.length };
  }

  @Post('observations/:observationId/confirm')
  @ApiOperation({ summary: 'Confirm an observation as-extracted' })
  @ApiParam({ name: 'observationId' })
  confirm(@Param('observationId') observationId: string) {
    return this.records.confirm(observationId);
  }

  @Post('observations/:observationId/correct')
  @ApiOperation({ summary: "Replace an observation's value with the person's own" })
  @ApiParam({ name: 'observationId' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['value'],
      properties: { value: { type: 'string' }, unit: { type: 'string', nullable: true } },
    },
  })
  correct(@Param('observationId') observationId: string, @Body() body: unknown) {
    const input = parseOrThrow(correctSchema, body);
    return this.records.correct(observationId, input.value, input.unit);
  }

  @Post('observations/:observationId/reject')
  @ApiOperation({ summary: 'Reject an observation extracted in error' })
  @ApiParam({ name: 'observationId' })
  reject(@Param('observationId') observationId: string) {
    return this.records.reject(observationId);
  }
}

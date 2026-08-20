import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { ClinicalChartingService } from './clinical-charting.service.js';

const openEncounterSchema = z.object({
  patientId: z.string().trim().min(1).max(200),
  clinicianId: z.string().trim().min(1).max(200),
});

const soapSectionsSchema = {
  subjective: z.string().trim().min(1).max(10000),
  objective: z.string().trim().min(1).max(10000),
  assessment: z.string().trim().min(1).max(10000),
  plan: z.string().trim().min(1).max(10000),
};

const recordNoteSchema = z.object({
  authorId: z.string().trim().min(1).max(200),
  ...soapSectionsSchema,
});

const reviseNoteSchema = z.object(soapSectionsSchema);

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  subjectivePrompt: z.string().trim().min(1).max(2000),
  objectivePrompt: z.string().trim().min(1).max(2000),
  assessmentPrompt: z.string().trim().min(1).max(2000),
  planPrompt: z.string().trim().min(1).max(2000),
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
 * Row 3 of clinical-suite.md's capability map. Encounters and notes are
 * nested under `encounters/`; templates are their own top-level resource
 * since they are not scoped to one encounter.
 *
 * `listEncounters`/`getEncounter`/`listNotes` carry `SessionAuthGuard` and
 * are scoped to the caller — a prior version of this file left every route
 * on this controller fully unauthenticated, including these three reads:
 * `GET /clinical-charting/encounters` with no session returned every
 * patient's encounters system-wide, `GET .../encounters/:id` read any
 * encounter by a guessed or leaked id, and `GET .../encounters/:id/notes`
 * did the same for the free-text SOAP narrative recorded against it — the
 * same shape `BillingController`/`TeleconsultationController` were each
 * fixed for. `openEncounter`/`closeEncounter`/`recordNote`/`reviseNote`/
 * `attachDocument` stay unguarded: they are clinician actions
 * (`clinicianId`/`authorId` are free-text fields trusted from the request
 * body, the same as across the rest of this clinical suite), and this app
 * has no clinician-side session to check them against yet. Gating them
 * behind a *patient* `SessionAuthGuard` would not make them correct, only
 * unusable. Templates are clinic-wide, not per-patient, so they carry no
 * owner check at all.
 */
@ApiTags('clinical-charting')
@Controller('clinical-charting')
export class ClinicalChartingController {
  constructor(private readonly charting: ClinicalChartingService) {}

  @Get('health')
  @ApiOperation({ summary: "clinical-suite.md §2's ModuleDescriptor.health(), exposed over HTTP" })
  health() {
    return this.charting.health();
  }

  @Post('encounters')
  @ApiOperation({ summary: 'Open a new encounter' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['patientId', 'clinicianId'],
      properties: { patientId: { type: 'string' }, clinicianId: { type: 'string' } },
    },
  })
  openEncounter(@Body() body: unknown) {
    return this.charting.openEncounter(parseOrThrow(openEncounterSchema, body));
  }

  @Get('encounters')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: "List the signed-in caller's own encounters" })
  listEncounters(@CurrentUser() user: CurrentUserResult) {
    const items = this.charting.listEncounters(user.subjectId);
    return { items, total: items.length };
  }

  @Get('encounters/:encounterId')
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'encounterId' })
  @ApiOperation({ summary: "Read one of the caller's own encounters by opaque id" })
  getEncounter(@CurrentUser() user: CurrentUserResult, @Param('encounterId') encounterId: string) {
    return this.charting.getEncounterForOwner(encounterId, user.subjectId);
  }

  @Post('encounters/:encounterId/close')
  @ApiParam({ name: 'encounterId' })
  @ApiOperation({ summary: 'Close an encounter. Notes and attachments are locked once closed.' })
  closeEncounter(@Param('encounterId') encounterId: string) {
    return this.charting.closeEncounter(encounterId);
  }

  @Post('encounters/:encounterId/notes')
  @ApiParam({ name: 'encounterId' })
  @ApiOperation({ summary: 'Record a SOAP note. Refused once the encounter is closed.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['authorId', 'subjective', 'objective', 'assessment', 'plan'],
      properties: {
        authorId: { type: 'string' },
        subjective: { type: 'string' },
        objective: { type: 'string' },
        assessment: { type: 'string' },
        plan: { type: 'string' },
      },
    },
  })
  recordNote(@Param('encounterId') encounterId: string, @Body() body: unknown) {
    return this.charting.recordNote(encounterId, parseOrThrow(recordNoteSchema, body));
  }

  @Get('encounters/:encounterId/notes')
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'encounterId' })
  @ApiOperation({ summary: "List every SOAP note recorded against one of the caller's own encounters" })
  listNotes(@CurrentUser() user: CurrentUserResult, @Param('encounterId') encounterId: string) {
    const items = this.charting.listNotesForOwner(encounterId, user.subjectId);
    return { items, total: items.length };
  }

  @Post('notes/:noteId/revise')
  @ApiParam({ name: 'noteId' })
  @ApiOperation({ summary: "Replace a note's sections. Refused once its encounter is closed." })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['subjective', 'objective', 'assessment', 'plan'],
      properties: {
        subjective: { type: 'string' },
        objective: { type: 'string' },
        assessment: { type: 'string' },
        plan: { type: 'string' },
      },
    },
  })
  reviseNote(@Param('noteId') noteId: string, @Body() body: unknown) {
    return this.charting.reviseNote(noteId, parseOrThrow(reviseNoteSchema, body));
  }

  @Post('encounters/:encounterId/documents/:documentId/attach')
  @ApiParam({ name: 'encounterId' })
  @ApiParam({ name: 'documentId' })
  @ApiOperation({ summary: 'Attach an existing health-records document to an encounter. Refused (503) while health-records is unavailable.' })
  attachDocument(@Param('encounterId') encounterId: string, @Param('documentId') documentId: string) {
    return this.charting.attachDocument(encounterId, documentId);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create a reusable note template' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'subjectivePrompt', 'objectivePrompt', 'assessmentPrompt', 'planPrompt'],
      properties: {
        name: { type: 'string' },
        subjectivePrompt: { type: 'string' },
        objectivePrompt: { type: 'string' },
        assessmentPrompt: { type: 'string' },
        planPrompt: { type: 'string' },
      },
    },
  })
  createTemplate(@Body() body: unknown) {
    return this.charting.createTemplate(parseOrThrow(createTemplateSchema, body));
  }

  @Get('templates')
  @ApiOperation({ summary: 'List every defined note template' })
  listTemplates() {
    const items = this.charting.listTemplates();
    return { items, total: items.length };
  }
}

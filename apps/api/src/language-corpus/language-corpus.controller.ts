import { BadRequestException, Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { CorpusReviewerGuard } from './corpus-reviewer.guard.js';
import { LanguageCorpusService } from './language-corpus.service.js';

const utteranceKindSchema = z.enum(['USER_MESSAGE', 'CORRECTION', 'VOICE_TRANSCRIPT']);
const localeSchema = z.enum(['ne', 'en', 'ne-Latn']);

// Same regex `SchedulingController`/`FamilyGrantsController` each carry their
// own copy of, for the same "explicit over a library validator" reason
// `patient-registry`'s `dateOfBirth` regex sets. Review-queue ordering here
// sorts `capturedAt` with `localeCompare`, which silently misorders anything
// that isn't a real zero-padded ISO instant.
const isoInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

const ingestSchema = z.object({
  id: z.string().trim().min(1),
  ownerId: z.string().trim().min(1),
  kind: utteranceKindSchema,
  text: z.string().trim().min(1),
  locale: localeSchema,
  capturedAt: z.string().regex(isoInstant, 'capturedAt must be an ISO 8601 UTC instant'),
  precedingAssistantText: z.string().trim().min(1).nullable().default(null),
  redactionCount: z.number().int().min(0),
  awaitingHumanReview: z.boolean(),
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

@ApiTags('language-corpus')
@Controller('language-corpus')
export class LanguageCorpusController {
  constructor(private readonly corpus: LanguageCorpusService) {}

  @Post('utterances')
  @ApiOperation({ summary: 'Store an utterance already retained (consent-gated, de-identified) at capture time' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['id', 'ownerId', 'kind', 'text', 'locale', 'capturedAt', 'redactionCount', 'awaitingHumanReview'],
      properties: {
        id: { type: 'string' },
        ownerId: { type: 'string' },
        kind: { enum: utteranceKindSchema.options },
        text: { type: 'string' },
        locale: { enum: localeSchema.options },
        capturedAt: { type: 'string' },
        precedingAssistantText: { type: 'string', nullable: true },
        redactionCount: { type: 'integer' },
        awaitingHumanReview: { type: 'boolean' },
      },
    },
  })
  ingest(@Body() body: unknown) {
    return this.corpus.ingest(parseOrThrow(ingestSchema, body));
  }

  @Get('review-queue')
  @UseGuards(SessionAuthGuard, CorpusReviewerGuard)
  @ApiOperation({ summary: 'Utterances awaiting human review, oldest capture first' })
  queue() {
    const items = this.corpus.queue();
    return { items, total: items.length };
  }

  @Get('utterances/:utteranceId')
  @UseGuards(SessionAuthGuard, CorpusReviewerGuard)
  @ApiParam({ name: 'utteranceId' })
  @ApiOperation({ summary: "Open one utterance to read its de-identified text — logged per language-corpus.md §5" })
  read(@CurrentUser() user: CurrentUserResult, @Param('utteranceId') utteranceId: string) {
    return this.corpus.read(utteranceId, user.subjectId);
  }

  @Post('utterances/:utteranceId/clear')
  @UseGuards(SessionAuthGuard, CorpusReviewerGuard)
  @ApiParam({ name: 'utteranceId' })
  @ApiOperation({ summary: 'Record that no residual identifier was found — eligible for a future snapshot' })
  clear(@CurrentUser() user: CurrentUserResult, @Param('utteranceId') utteranceId: string) {
    return this.corpus.clear(utteranceId, user.subjectId);
  }

  @Post('utterances/:utteranceId/discard')
  @UseGuards(SessionAuthGuard, CorpusReviewerGuard)
  @ApiParam({ name: 'utteranceId' })
  @ApiOperation({ summary: 'Record that a residual identifier was found — this utterance must never train a model' })
  discard(@CurrentUser() user: CurrentUserResult, @Param('utteranceId') utteranceId: string) {
    return this.corpus.discard(utteranceId, user.subjectId);
  }

  @Delete('owners/:ownerId')
  @ApiParam({ name: 'ownerId' })
  @ApiOperation({
    summary:
      'A right-to-erasure request: removes every utterance belonging to this owner from the corpus and the review queue',
  })
  erase(@Param('ownerId') ownerId: string) {
    const parsed = z.string().trim().min(1).safeParse(ownerId);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'ownerId is required' });
    }
    const { erasedUtteranceIds } = this.corpus.erase(parsed.data);
    return { erasedUtteranceIds, erasedCount: erasedUtteranceIds.length };
  }

  @Get('utterances/:utteranceId/audit-log')
  @UseGuards(SessionAuthGuard, CorpusReviewerGuard)
  @ApiParam({ name: 'utteranceId' })
  @ApiOperation({ summary: "Who read this utterance and who decided it, oldest first" })
  auditLog(@Param('utteranceId') utteranceId: string) {
    const items = this.corpus.auditLog(utteranceId);
    return { items, total: items.length };
  }
}

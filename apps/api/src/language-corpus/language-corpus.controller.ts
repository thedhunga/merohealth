import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CorpusReviewerGuard, REVIEWER_ID_HEADER } from './corpus-reviewer.guard.js';
import { LanguageCorpusService } from './language-corpus.service.js';

const utteranceKindSchema = z.enum(['USER_MESSAGE', 'CORRECTION', 'VOICE_TRANSCRIPT']);
const localeSchema = z.enum(['ne', 'en', 'ne-Latn']);

const ingestSchema = z.object({
  id: z.string().trim().min(1),
  ownerId: z.string().trim().min(1),
  kind: utteranceKindSchema,
  text: z.string().trim().min(1),
  locale: localeSchema,
  capturedAt: z.string().trim().min(1),
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

/**
 * `CorpusReviewerGuard` already rejects any request missing this header
 * before a handler runs; re-checked here only so a route that ever loses
 * its `@UseGuards(CorpusReviewerGuard)` fails loudly instead of passing
 * `undefined` through to an audit log entry.
 */
function requireReviewerId(reviewerId: string | undefined): string {
  const parsed = z.string().trim().min(1).safeParse(reviewerId);
  if (!parsed.success) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: `${REVIEWER_ID_HEADER} is required` });
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
  @UseGuards(CorpusReviewerGuard)
  @ApiHeader({ name: REVIEWER_ID_HEADER, required: true })
  @ApiOperation({ summary: 'Utterances awaiting human review, oldest capture first' })
  queue() {
    const items = this.corpus.queue();
    return { items, total: items.length };
  }

  @Get('utterances/:utteranceId')
  @UseGuards(CorpusReviewerGuard)
  @ApiHeader({ name: REVIEWER_ID_HEADER, required: true })
  @ApiParam({ name: 'utteranceId' })
  @ApiOperation({ summary: "Open one utterance to read its de-identified text — logged per language-corpus.md §5" })
  read(@Param('utteranceId') utteranceId: string, @Headers(REVIEWER_ID_HEADER) reviewerId?: string) {
    return this.corpus.read(utteranceId, requireReviewerId(reviewerId));
  }

  @Post('utterances/:utteranceId/clear')
  @UseGuards(CorpusReviewerGuard)
  @ApiHeader({ name: REVIEWER_ID_HEADER, required: true })
  @ApiParam({ name: 'utteranceId' })
  @ApiOperation({ summary: 'Record that no residual identifier was found — eligible for a future snapshot' })
  clear(@Param('utteranceId') utteranceId: string, @Headers(REVIEWER_ID_HEADER) reviewerId?: string) {
    return this.corpus.clear(utteranceId, requireReviewerId(reviewerId));
  }

  @Post('utterances/:utteranceId/discard')
  @UseGuards(CorpusReviewerGuard)
  @ApiHeader({ name: REVIEWER_ID_HEADER, required: true })
  @ApiParam({ name: 'utteranceId' })
  @ApiOperation({ summary: 'Record that a residual identifier was found — this utterance must never train a model' })
  discard(@Param('utteranceId') utteranceId: string, @Headers(REVIEWER_ID_HEADER) reviewerId?: string) {
    return this.corpus.discard(utteranceId, requireReviewerId(reviewerId));
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
  @UseGuards(CorpusReviewerGuard)
  @ApiHeader({ name: REVIEWER_ID_HEADER, required: true })
  @ApiParam({ name: 'utteranceId' })
  @ApiOperation({ summary: "Who read this utterance and who decided it, oldest first" })
  auditLog(@Param('utteranceId') utteranceId: string) {
    const items = this.corpus.auditLog(utteranceId);
    return { items, total: items.length };
  }
}

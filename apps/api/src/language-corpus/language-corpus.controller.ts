import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { CorpusReviewerGuard } from './corpus-reviewer.guard.js';
import { LanguageCorpusService } from './language-corpus.service.js';

const utteranceKindSchema = z.enum(['USER_MESSAGE', 'CORRECTION', 'VOICE_TRANSCRIPT']);
const localeSchema = z.enum(['ne', 'en', 'ne-Latn']);
const corpusConsentKindSchema = z.enum(['VOICE_CONTRIBUTION', 'HEALTH_CONVERSATION_AUDIO']);
const voiceContributionTaskKindSchema = z.enum(['READ_PROMPT', 'FREE_SPEECH']);
const motherTongueSchema = z.enum([
  'NEPALI', 'MAITHILI', 'BHOJPURI', 'THARU', 'TAMANG', 'NEWAR', 'GURUNG', 'MAGAR', 'OTHER',
]);
const ageBandSchema = z.enum(['13_17', '18_24', '25_34', '35_44', '45_59', '60_PLUS']);
const genderSchema = z.enum(['WOMAN', 'MAN', 'OTHER', 'PREFER_NOT_TO_SAY']);
const clipValidationVerdictSchema = z.enum(['RIGHT', 'WRONG', 'UNCLEAR']);

// Same regex `SchedulingController`/`FamilyGrantsController` each carry their
// own copy of, for the same "explicit over a library validator" reason
// `patient-registry`'s `dateOfBirth` regex sets. Review-queue ordering here
// sorts `capturedAt` with `localeCompare`, which silently misorders anything
// that isn't a real zero-padded ISO instant.
const isoInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

// No `ownerId` field: the owner is always the session identity, never a
// client-supplied value — the same fix `RecordsController.capture`'s own
// `captureSchema` comment describes, applied here now that `ingest` carries
// a `SessionAuthGuard` too.
const ingestSchema = z.object({
  id: z.string().trim().min(1),
  kind: utteranceKindSchema,
  text: z.string().trim().min(1),
  locale: localeSchema,
  capturedAt: z.string().regex(isoInstant, 'capturedAt must be an ISO 8601 UTC instant'),
  precedingAssistantText: z.string().trim().min(1).nullable().default(null),
  redactionCount: z.number().int().min(0),
  awaitingHumanReview: z.boolean(),
});

// No `contributorId` field, same reason `ingestSchema` above has none: the
// owner is always the session identity. `bytesBase64` mirrors
// `RecordsController`'s `captureSchema.bytesBase64` — JSON has no binary
// type, so the browser base64-encodes the recorded clip before this reaches
// the API.
const voiceClipSchema = z.object({
  id: z.string().trim().min(1),
  taskId: z.string().trim().min(1),
  taskKind: voiceContributionTaskKindSchema,
  selfReport: z.object({
    district: z.string().trim().min(1).max(100),
    motherTongue: motherTongueSchema,
    ageBand: ageBandSchema,
    gender: genderSchema.nullable().default(null),
  }),
  device: z.string().trim().min(1).max(500),
  durationMs: z.number().int().positive(),
  contentType: z.string().trim().min(1),
  bytesBase64: z.string().trim().min(1),
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
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Store an utterance already retained (consent-gated, de-identified) at capture time' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['id', 'kind', 'text', 'locale', 'capturedAt', 'redactionCount', 'awaitingHumanReview'],
      properties: {
        id: { type: 'string' },
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
  ingest(@CurrentUser() user: CurrentUserResult, @Body() body: unknown) {
    const input = parseOrThrow(ingestSchema, body);
    return this.corpus.ingest({ ...input, ownerId: user.subjectId });
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
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'ownerId' })
  @ApiOperation({
    summary:
      "A right-to-erasure request: removes every utterance belonging to the signed-in caller's own record from the corpus and the review queue",
  })
  erase(@CurrentUser() user: CurrentUserResult, @Param('ownerId') ownerId: string) {
    const parsed = z.string().trim().min(1).safeParse(ownerId);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'ownerId is required' });
    }
    // Right-to-erasure is data-subject-only — no delegation or guardianship
    // scope in packages/family grants "erase someone else's record" — so a
    // path ownerId that isn't the caller's own 404s exactly like
    // RecordsService's #requireObservation does for an opaque id belonging
    // to someone else: never confirm whose data exists to a caller who
    // isn't its owner.
    if (parsed.data !== user.subjectId) {
      throw new NotFoundException({ code: 'OWNER_NOT_FOUND', message: `No corpus data for owner ${parsed.data}` });
    }
    const { erasedUtteranceIds } = this.corpus.erase(user.subjectId);
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

  /**
   * Self-service only, unlike the reviewer routes above — a person's own
   * consent for the two audio streams `docs/product/freemium-and-voice-corpus.md`
   * §4 describes, so every route here takes only `SessionAuthGuard`, never
   * `CorpusReviewerGuard`, and the user id always comes from `@CurrentUser()`
   * — the same "never a client-supplied id" rule `erase` above already
   * follows. `grants` always includes revoked rows: that full history is the
   * audit trail (see `LanguageCorpusRepository.saveConsentGrant`'s own doc
   * comment for why no separate log exists).
   */
  @Get('consent')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Every corpus-consent grant for the signed-in user, including revoked ones' })
  consentGrants(@CurrentUser() user: CurrentUserResult) {
    const grants = this.corpus.consentGrantsFor(user.subjectId);
    return { grants, total: grants.length };
  }

  @Post('consent/:kind/grant')
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'kind', enum: corpusConsentKindSchema.options })
  @ApiOperation({ summary: 'Grants one corpus-consent kind for the signed-in user; idempotent if already live' })
  grantConsent(@CurrentUser() user: CurrentUserResult, @Param('kind') kind: string) {
    const parsed = parseOrThrow(corpusConsentKindSchema, kind);
    return this.corpus.grantConsent(user.subjectId, parsed);
  }

  @Post('consent/:kind/revoke')
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'kind', enum: corpusConsentKindSchema.options })
  @ApiOperation({ summary: 'Revokes one corpus-consent kind for the signed-in user; idempotent if already revoked or never granted' })
  revokeConsent(@CurrentUser() user: CurrentUserResult, @Param('kind') kind: string) {
    const parsed = parseOrThrow(corpusConsentKindSchema, kind);
    const grants = this.corpus.revokeConsent(user.subjectId, parsed);
    return { grants };
  }

  /**
   * Round six §M's third box — `/contribute`'s only write. Self-service like
   * the consent routes above (`SessionAuthGuard` only, `contributorId` always
   * from `@CurrentUser()`), not `CorpusReviewerGuard`: submitting one's own
   * recording is not a reviewer decision. `LanguageCorpusService.submitVoiceClip`
   * does the actual consent/duration/duplicate gating and throws the
   * `Forbidden`/`BadRequest` this route lets propagate as-is.
   */
  @Post('voice-contribution/clips')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Stores one Voice Contribution recording — consent-gated, quality-gated' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['id', 'taskId', 'taskKind', 'selfReport', 'device', 'durationMs', 'contentType', 'bytesBase64'],
      properties: {
        id: { type: 'string' },
        taskId: { type: 'string' },
        taskKind: { enum: voiceContributionTaskKindSchema.options },
        selfReport: {
          type: 'object',
          properties: {
            district: { type: 'string' },
            motherTongue: { enum: motherTongueSchema.options },
            ageBand: { enum: ageBandSchema.options },
            gender: { enum: genderSchema.options, nullable: true },
          },
        },
        device: { type: 'string' },
        durationMs: { type: 'integer' },
        contentType: { type: 'string' },
        bytesBase64: { type: 'string' },
      },
    },
  })
  submitVoiceClip(@CurrentUser() user: CurrentUserResult, @Body() body: unknown) {
    const { bytesBase64, ...input } = parseOrThrow(voiceClipSchema, body);
    return this.corpus.submitVoiceClip({
      ...input,
      contributorId: user.subjectId,
      bytes: Buffer.from(bytesBase64, 'base64'),
    });
  }

  /**
   * Round six §M's Validation flow box — "contributors validate others'
   * clips". Self-service like the consent and submission routes above
   * (`SessionAuthGuard` only, no `CorpusReviewerGuard`): judging a clip in
   * the crowd queue is not the same trust boundary as reading de-identified
   * health-conversation text, which is what `CorpusReviewerGuard` actually
   * guards.
   */
  @Get('voice-contribution/validation/next')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'The next clip this caller is eligible to validate, or null when none remain' })
  nextForValidation(@CurrentUser() user: CurrentUserResult) {
    return { clip: this.corpus.nextClipForValidation(user.subjectId) };
  }

  /**
   * Separate from `nextForValidation` so a clip's (potentially large) audio
   * payload is only fetched once a validator is actually about to listen,
   * not embedded in every `next` response — same "metadata now, bytes on
   * demand" split `RecordsController`'s document endpoints already use.
   * `bytesBase64` mirrors `submitVoiceClip`'s own request shape, mirrored
   * back for the response.
   */
  @Get('voice-contribution/clips/:clipId/audio')
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'clipId' })
  @ApiOperation({ summary: 'The clip audio, base64-encoded, for a validator to listen to before judging' })
  async clipAudio(@CurrentUser() user: CurrentUserResult, @Param('clipId') clipId: string) {
    const blob = await this.corpus.clipAudio(clipId, user.subjectId);
    return { contentType: blob.contentType, bytesBase64: Buffer.from(blob.bytes).toString('base64') };
  }

  @Post('voice-contribution/clips/:clipId/validations')
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'clipId' })
  @ApiOperation({ summary: "Records this caller's RIGHT/WRONG/UNCLEAR judgement of someone else's clip" })
  @ApiBody({ schema: { type: 'object', required: ['verdict'], properties: { verdict: { enum: clipValidationVerdictSchema.options } } } })
  validateClip(@CurrentUser() user: CurrentUserResult, @Param('clipId') clipId: string, @Body() body: unknown) {
    const { verdict } = parseOrThrow(z.object({ verdict: clipValidationVerdictSchema }), body);
    return this.corpus.validateClip(clipId, user.subjectId, verdict);
  }
}

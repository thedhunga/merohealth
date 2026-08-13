import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { IdentityReviewerGuard } from './identity-reviewer.guard.js';
import { IdentityService } from './identity.service.js';

const documentTypeSchema = z.enum(['NATIONAL_ID', 'CITIZENSHIP', 'PASSPORT', 'DRIVING_LICENCE']);

const submitSchema = z.object({
  documentType: documentTypeSchema,
  evidenceImageRef: z.string().trim().min(1),
});

const rejectSchema = z.object({
  reason: z.string().trim().min(1),
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

@ApiTags('identity')
@Controller('identity')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  // `ownerId` comes from the verified session, never the request body — the
  // same unguarded-owner-id shape closed on `RecordsController`/
  // `CredentialingController.submit` would let anyone submit or resubmit
  // identity evidence under a known/guessed subject id otherwise.
  @Post('verification/evidence')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Submit, or resubmit after rejection, identity verification evidence' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['documentType', 'evidenceImageRef'],
      properties: {
        documentType: { enum: documentTypeSchema.options },
        evidenceImageRef: { type: 'string' },
      },
    },
  })
  submit(@CurrentUser() user: CurrentUserResult, @Body() body: unknown) {
    const input = parseOrThrow(submitSchema, body);
    return this.identity.submit({ ...input, ownerId: user.subjectId });
  }

  @Get('verification/queue')
  @UseGuards(SessionAuthGuard, IdentityReviewerGuard)
  @ApiOperation({ summary: 'Verification requests awaiting review, oldest submission first' })
  queue() {
    const items = this.identity.queue();
    return { items, total: items.length };
  }

  @Get('verification/:verificationId')
  @UseGuards(SessionAuthGuard, IdentityReviewerGuard)
  @ApiParam({ name: 'verificationId' })
  @ApiOperation({ summary: "Open one verification request to read its evidence — logged per identity-and-credentialing.md §4" })
  read(@CurrentUser() user: CurrentUserResult, @Param('verificationId') verificationId: string) {
    return this.identity.read(verificationId, user.subjectId);
  }

  @Post('verification/:verificationId/begin-review')
  @UseGuards(SessionAuthGuard, IdentityReviewerGuard)
  @ApiParam({ name: 'verificationId' })
  @ApiOperation({ summary: 'A reviewer picks the request up off the queue' })
  beginReview(@CurrentUser() user: CurrentUserResult, @Param('verificationId') verificationId: string) {
    return this.identity.beginReview(verificationId, user.subjectId);
  }

  @Post('verification/:verificationId/approve')
  @UseGuards(SessionAuthGuard, IdentityReviewerGuard)
  @ApiParam({ name: 'verificationId' })
  @ApiOperation({ summary: "Record an approval — clears the evidence image per §4 and raises the owner to IDENTITY_VERIFIED" })
  approve(@CurrentUser() user: CurrentUserResult, @Param('verificationId') verificationId: string) {
    return this.identity.approve(verificationId, user.subjectId);
  }

  @Post('verification/:verificationId/reject')
  @UseGuards(SessionAuthGuard, IdentityReviewerGuard)
  @ApiParam({ name: 'verificationId' })
  @ApiBody({
    schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } },
  })
  @ApiOperation({ summary: 'Record a rejection with a reason the person can act on when resubmitting' })
  reject(
    @CurrentUser() user: CurrentUserResult,
    @Param('verificationId') verificationId: string,
    @Body() body: unknown,
  ) {
    const input = parseOrThrow(rejectSchema, body);
    return this.identity.reject(verificationId, user.subjectId, input.reason);
  }

  @Get('verification/:verificationId/audit-log')
  @UseGuards(SessionAuthGuard, IdentityReviewerGuard)
  @ApiParam({ name: 'verificationId' })
  @ApiOperation({ summary: "Who read this request's evidence and who decided it, oldest first" })
  auditLog(@Param('verificationId') verificationId: string) {
    const items = this.identity.auditLog(verificationId);
    return { items, total: items.length };
  }
}

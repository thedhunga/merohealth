import { BadRequestException, Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CredentialingService } from './credentialing.service.js';
import { REVIEWER_ID_HEADER, ReviewerGuard } from './reviewer.guard.js';

const councilKeySchema = z.enum(['NMC', 'NNC', 'NHPC', 'PHARMACY_COUNCIL', 'AYURVEDIC_COUNCIL']);

const submitSchema = z.object({
  applicantId: z.string().trim().min(1),
  council: councilKeySchema,
  registrationNumber: z.string().trim().min(1),
  certificateImageRef: z.string().trim().min(1),
  identityImageRef: z.string().trim().min(1),
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

/**
 * `ReviewerGuard` already rejects any request missing this header before a
 * handler runs; re-checked here only so a route that ever loses its
 * `@UseGuards(ReviewerGuard)` fails loudly instead of passing `undefined`
 * through to an audit log entry.
 */
function requireReviewerId(reviewerId: string | undefined): string {
  const parsed = z.string().trim().min(1).safeParse(reviewerId);
  if (!parsed.success) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: `${REVIEWER_ID_HEADER} is required` });
  }
  return parsed.data;
}

@ApiTags('credentialing')
@Controller('credentialing')
export class CredentialingController {
  constructor(private readonly credentialing: CredentialingService) {}

  @Post('applications')
  @ApiOperation({ summary: 'Submit, or resubmit after rejection, a council application' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['applicantId', 'council', 'registrationNumber', 'certificateImageRef', 'identityImageRef'],
      properties: {
        applicantId: { type: 'string' },
        council: { enum: councilKeySchema.options },
        registrationNumber: { type: 'string' },
        certificateImageRef: { type: 'string' },
        identityImageRef: { type: 'string' },
      },
    },
  })
  submit(@Body() body: unknown) {
    return this.credentialing.submit(parseOrThrow(submitSchema, body));
  }

  @Get('queue')
  @UseGuards(ReviewerGuard)
  @ApiHeader({ name: REVIEWER_ID_HEADER, required: true })
  @ApiOperation({ summary: 'Applications awaiting review, oldest submission first' })
  queue() {
    const items = this.credentialing.queue();
    return { items, total: items.length };
  }

  @Get('applications/:applicationId')
  @UseGuards(ReviewerGuard)
  @ApiHeader({ name: REVIEWER_ID_HEADER, required: true })
  @ApiParam({ name: 'applicationId' })
  @ApiOperation({ summary: "Open one application to read its evidence — logged per identity-and-credentialing.md §4" })
  read(@Param('applicationId') applicationId: string, @Headers(REVIEWER_ID_HEADER) reviewerId?: string) {
    return this.credentialing.read(applicationId, requireReviewerId(reviewerId));
  }

  @Post('applications/:applicationId/begin-review')
  @UseGuards(ReviewerGuard)
  @ApiHeader({ name: REVIEWER_ID_HEADER, required: true })
  @ApiParam({ name: 'applicationId' })
  @ApiOperation({ summary: 'A reviewer picks the application up off the queue' })
  beginReview(@Param('applicationId') applicationId: string, @Headers(REVIEWER_ID_HEADER) reviewerId?: string) {
    return this.credentialing.beginReview(applicationId, requireReviewerId(reviewerId));
  }

  @Post('applications/:applicationId/approve')
  @UseGuards(ReviewerGuard)
  @ApiHeader({ name: REVIEWER_ID_HEADER, required: true })
  @ApiParam({ name: 'applicationId' })
  @ApiOperation({ summary: 'Record an approval — clears the evidence images per §4' })
  approve(@Param('applicationId') applicationId: string, @Headers(REVIEWER_ID_HEADER) reviewerId?: string) {
    return this.credentialing.approve(applicationId, requireReviewerId(reviewerId));
  }

  @Post('applications/:applicationId/reject')
  @UseGuards(ReviewerGuard)
  @ApiHeader({ name: REVIEWER_ID_HEADER, required: true })
  @ApiParam({ name: 'applicationId' })
  @ApiBody({
    schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } },
  })
  @ApiOperation({ summary: 'Record a rejection with a reason the applicant can act on when resubmitting' })
  reject(
    @Param('applicationId') applicationId: string,
    @Body() body: unknown,
    @Headers(REVIEWER_ID_HEADER) reviewerId?: string,
  ) {
    const input = parseOrThrow(rejectSchema, body);
    return this.credentialing.reject(applicationId, requireReviewerId(reviewerId), input.reason);
  }

  @Get('applications/:applicationId/audit-log')
  @UseGuards(ReviewerGuard)
  @ApiHeader({ name: REVIEWER_ID_HEADER, required: true })
  @ApiParam({ name: 'applicationId' })
  @ApiOperation({ summary: "Who read this application's evidence and who decided it, oldest first" })
  auditLog(@Param('applicationId') applicationId: string) {
    const items = this.credentialing.auditLog(applicationId);
    return { items, total: items.length };
  }
}

import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { CredentialingService } from './credentialing.service.js';
import { ReviewerGuard } from './reviewer.guard.js';

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
  @UseGuards(SessionAuthGuard, ReviewerGuard)
  @ApiOperation({ summary: 'Applications awaiting review, oldest submission first' })
  queue() {
    const items = this.credentialing.queue();
    return { items, total: items.length };
  }

  @Get('applications/:applicationId')
  @UseGuards(SessionAuthGuard, ReviewerGuard)
  @ApiParam({ name: 'applicationId' })
  @ApiOperation({ summary: "Open one application to read its evidence — logged per identity-and-credentialing.md §4" })
  read(@CurrentUser() user: CurrentUserResult, @Param('applicationId') applicationId: string) {
    return this.credentialing.read(applicationId, user.subjectId);
  }

  @Post('applications/:applicationId/begin-review')
  @UseGuards(SessionAuthGuard, ReviewerGuard)
  @ApiParam({ name: 'applicationId' })
  @ApiOperation({ summary: 'A reviewer picks the application up off the queue' })
  beginReview(@CurrentUser() user: CurrentUserResult, @Param('applicationId') applicationId: string) {
    return this.credentialing.beginReview(applicationId, user.subjectId);
  }

  @Post('applications/:applicationId/approve')
  @UseGuards(SessionAuthGuard, ReviewerGuard)
  @ApiParam({ name: 'applicationId' })
  @ApiOperation({ summary: 'Record an approval — clears the evidence images per §4' })
  approve(@CurrentUser() user: CurrentUserResult, @Param('applicationId') applicationId: string) {
    return this.credentialing.approve(applicationId, user.subjectId);
  }

  @Post('applications/:applicationId/reject')
  @UseGuards(SessionAuthGuard, ReviewerGuard)
  @ApiParam({ name: 'applicationId' })
  @ApiBody({
    schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } },
  })
  @ApiOperation({ summary: 'Record a rejection with a reason the applicant can act on when resubmitting' })
  reject(
    @CurrentUser() user: CurrentUserResult,
    @Param('applicationId') applicationId: string,
    @Body() body: unknown,
  ) {
    const input = parseOrThrow(rejectSchema, body);
    return this.credentialing.reject(applicationId, user.subjectId, input.reason);
  }

  @Get('applications/:applicationId/audit-log')
  @UseGuards(SessionAuthGuard, ReviewerGuard)
  @ApiParam({ name: 'applicationId' })
  @ApiOperation({ summary: "Who read this application's evidence and who decided it, oldest first" })
  auditLog(@Param('applicationId') applicationId: string) {
    const items = this.credentialing.auditLog(applicationId);
    return { items, total: items.length };
  }
}

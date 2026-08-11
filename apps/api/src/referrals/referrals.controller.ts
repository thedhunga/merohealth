import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ReferralsService } from './referrals.service.js';

const requestReferralSchema = z.object({
  clinicianId: z.string().trim().min(1),
  referredToEntityId: z.string().trim().min(1),
  reason: z.string().trim().min(1),
});

const reasonSchema = z.object({
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

/** Row 12 of clinical-suite.md's capability map: referral management, pairing with care-directory. */
@ApiTags('referrals')
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('health')
  @ApiOperation({ summary: "clinical-suite.md §2's ModuleDescriptor.health(), exposed over HTTP" })
  health() {
    return this.referrals.health();
  }

  @Post('encounters/:encounterId/referrals')
  @ApiParam({ name: 'encounterId' })
  @ApiOperation({
    summary:
      'Request a referral against an encounter, to a care-directory entity. Refused (503) while ' +
      'clinical-charting is unavailable, and (404) if referredToEntityId names no directory entity.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['clinicianId', 'referredToEntityId', 'reason'],
      properties: {
        clinicianId: { type: 'string' },
        referredToEntityId: { type: 'string' },
        reason: { type: 'string' },
      },
    },
  })
  requestReferral(@Param('encounterId') encounterId: string, @Body() body: unknown) {
    return this.referrals.requestReferral(encounterId, parseOrThrow(requestReferralSchema, body));
  }

  @Get('referrals')
  @ApiOperation({ summary: 'List referrals, optionally filtered by patientId' })
  @ApiQuery({ name: 'patientId', required: false })
  listReferrals(@Query('patientId') patientId?: string) {
    const referrals = this.referrals.listReferrals(patientId);
    return { referrals, total: referrals.length };
  }

  @Get('referrals/:referralId')
  @ApiParam({ name: 'referralId' })
  @ApiOperation({ summary: 'Read one referral by opaque id' })
  getReferral(@Param('referralId') referralId: string) {
    return this.referrals.getReferral(referralId);
  }

  @Post('referrals/:referralId/accept')
  @ApiParam({ name: 'referralId' })
  @ApiOperation({
    summary:
      'Accept a REQUESTED referral. Recorded by the referring clinic\'s own staff, not a live response from ' +
      'the target provider — see packages/referrals for why.',
  })
  acceptReferral(@Param('referralId') referralId: string) {
    return this.referrals.acceptReferral(referralId);
  }

  @Post('referrals/:referralId/decline')
  @ApiParam({ name: 'referralId' })
  @ApiOperation({ summary: 'Decline a REQUESTED referral.' })
  @ApiBody({ schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } } })
  declineReferral(@Param('referralId') referralId: string, @Body() body: unknown) {
    return this.referrals.declineReferral(referralId, parseOrThrow(reasonSchema, body).reason);
  }

  @Post('referrals/:referralId/complete')
  @ApiParam({ name: 'referralId' })
  @ApiOperation({ summary: 'Complete an ACCEPTED referral. Rejected if it was never accepted.' })
  completeReferral(@Param('referralId') referralId: string) {
    return this.referrals.completeReferral(referralId);
  }

  @Post('referrals/:referralId/cancel')
  @ApiParam({ name: 'referralId' })
  @ApiOperation({
    summary: 'Cancel a REQUESTED referral. Rejected once it is ACCEPTED — there is no honest way to withdraw an agreement reached outside this system.',
  })
  @ApiBody({ schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } } })
  cancelReferral(@Param('referralId') referralId: string, @Body() body: unknown) {
    return this.referrals.cancelReferral(referralId, parseOrThrow(reasonSchema, body).reason);
  }
}

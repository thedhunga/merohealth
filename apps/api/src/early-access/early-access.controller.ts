import { BadRequestException, Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { OwnerGuard } from '../auth/owner.guard.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { normaliseContact } from './contact.js';
import { earlyAccessToCsv } from './early-access-csv.js';
import { EARLY_ACCESS_SOURCES } from './early-access-store.js';
import { EarlyAccessService } from './early-access.service.js';

interface IpRequest {
  ip?: string | undefined;
  socket?: { remoteAddress?: string | undefined } | undefined;
}

const registerSchema = z.object({
  contact: z.string().trim().max(254).optional(),
  source: z.enum(EARLY_ACCESS_SOURCES),
  registeredAt: z.string().trim().min(1),
});

function parseOrThrow<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Invalid request', details: parsed.error.flatten() });
  }
  return parsed.data;
}

function requestIp(request: IpRequest): string {
  return request.ip ?? request.socket?.remoteAddress ?? 'unknown';
}

/**
 * Round six L′ — "premium is not for sale yet" registers interest.
 * Deliberately unauthenticated: this is the pre-sign-in path
 * `flushEarlyAccess` (`apps/web/src/lib/early-access.ts`) calls the moment
 * someone taps "be the first to try", long before any account exists.
 * `HistoryController.migrate` covers the *other* half of this feature — the
 * same local record riding along at sign-in to link an anonymous row to the
 * new account.
 */
@ApiTags('early-access')
@Controller('early-access')
export class EarlyAccessController {
  constructor(private readonly earlyAccess: EarlyAccessService) {}

  @Post()
  @ApiOperation({ summary: 'Register interest in premium features that are not for sale yet' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['source', 'registeredAt'],
      properties: {
        contact: { type: 'string' },
        source: { type: 'string', enum: EARLY_ACCESS_SOURCES as unknown as string[] },
        registeredAt: { type: 'string' },
      },
    },
  })
  async register(@Body() body: unknown, @Req() request: IpRequest) {
    const input = parseOrThrow(registerSchema, body);
    const contact = normaliseContactOrThrow(input.contact);
    const result = await this.earlyAccess.register(
      { contact, source: input.source, registeredAt: new Date(input.registeredAt) },
      requestIp(request),
    );
    return { ok: true, alreadyRegistered: result.outcome === 'alreadyRegistered' };
  }

  /**
   * The launch-day contact list. Owner-only: `OwnerGuard` requires the
   * `SUPER_ADMIN` role behind a verified session, same shape as every other
   * role-gated route in this codebase (`IdentityReviewerGuard` et al.).
   */
  @Get('export')
  @UseGuards(SessionAuthGuard, OwnerGuard)
  @ApiOperation({ summary: 'Export the early-access contact list as CSV (owner-only)' })
  async export(@Res({ passthrough: true }) res: Response): Promise<string> {
    const rows = await this.earlyAccess.list();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="early-access.csv"');
    return earlyAccessToCsv(rows);
  }
}

function normaliseContactOrThrow(rawContact: string | undefined): string | null {
  if (!rawContact || !rawContact.trim()) return null;
  const normalised = normaliseContact(rawContact);
  if (!normalised) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Contact must be a Nepali mobile number or an email address' });
  }
  return normalised;
}

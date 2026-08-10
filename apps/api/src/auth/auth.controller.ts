import { BadRequestException, Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SESSION_TTL_MS } from '@swasthya/auth';
import type { Response } from 'express';
import { z } from 'zod';
import { SESSION_COOKIE_NAME } from './auth.constants.js';
import { AuthService, type CurrentUserResult } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { SessionAuthGuard, type AuthenticatedRequest } from './session-auth.guard.js';

const requestOtpSchema = z.object({ phone: z.string().trim().min(1) });

const verifyOtpSchema = z.object({
  challengeId: z.string().trim().min(1),
  code: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  intent: z.enum(['SIGN_IN', 'REGISTER']),
  displayName: z.string().trim().min(1).max(120).optional(),
  locale: z.enum(['ne', 'en']).optional(),
});

function parseOrThrow<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Invalid request', details: parsed.error.flatten() });
  }
  return parsed.data;
}

/**
 * `SameSite=Lax` in development works across `localhost` ports (same
 * registrable domain), so cross-origin cookies just work for a local
 * `apps/web` ↔ `apps/api` pair without extra configuration. Production
 * needs `SameSite=None; Secure` the instant the two live on different
 * origins — that combination requires HTTPS, which is also why `secure`
 * only turns on in production rather than always.
 */
function sessionCookieOptions(): { httpOnly: true; sameSite: 'lax' | 'none'; secure: boolean; path: string; maxAge: number } {
  const isProduction = process.env['NODE_ENV'] === 'production';
  return {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  @ApiOperation({ summary: 'Send a one-time code to a Nepali mobile number' })
  @ApiBody({ schema: { type: 'object', required: ['phone'], properties: { phone: { type: 'string' } } } })
  async requestOtp(@Body() body: unknown) {
    const input = parseOrThrow(requestOtpSchema, body);
    return this.auth.requestOtp(input.phone);
  }

  @Post('otp/verify')
  @ApiOperation({ summary: 'Verify a one-time code, reaching REGISTERED and issuing a session' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['challengeId', 'code', 'phone', 'intent'],
      properties: {
        challengeId: { type: 'string' },
        code: { type: 'string' },
        phone: { type: 'string' },
        intent: { enum: ['SIGN_IN', 'REGISTER'] },
        displayName: { type: 'string' },
        locale: { enum: ['ne', 'en'] },
      },
    },
  })
  async verifyOtp(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const input = parseOrThrow(verifyOtpSchema, body);
    const result = await this.auth.verifyOtp(input);
    res.cookie(SESSION_COOKIE_NAME, result.token, sessionCookieOptions());
    return {
      token: result.token,
      userId: result.user.id,
      phone: result.user.phone,
      role: result.user.role,
      locale: result.user.locale,
      patientProfileId: result.patientProfileId,
      assuranceLevel: result.assuranceLevel,
    };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'The identity behind the current session — the real subjectId Round two A3 exists to produce' })
  me(@CurrentUser() current: CurrentUserResult) {
    return {
      userId: current.user.id,
      phone: current.user.phone,
      role: current.user.role,
      locale: current.user.locale,
      patientProfileId: current.patientProfileId,
      assuranceLevel: current.assuranceLevel,
    };
  }

  @Post('logout')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    if (request.sessionToken) {
      await this.auth.logout(request.sessionToken);
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return { ok: true };
  }
}

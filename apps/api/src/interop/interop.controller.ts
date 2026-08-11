import { BadRequestException, Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { InteropService } from './interop.service.js';

const issueShareLinkSchema = z.object({
  documentIds: z.array(z.string().trim().min(1)).min(1),
  ttlSeconds: z.number().int().positive(),
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
 * Row 17 of clinical-suite.md's capability map: FHIR export bundles and
 * revocable, time-limited share links, per `platform-vision.md` §3.3's v1
 * scope ("a time-limited, revocable share link scoped to selected records").
 * `share-links/*` routes are owner-scoped and sit behind `SessionAuthGuard`,
 * the same pattern `FamilyGrantsController` uses for a module with no
 * `EntitlementsGuard` wiring yet — `INTEROP` is not in
 * `@swasthya/entitlements`' module catalogue, so this controller invents no
 * quota gate the catalogue does not already define. `share/:token` carries
 * no guard at all: it is the one route meant to be opened by someone with no
 * Mero Health account, the bearer token itself is the credential.
 */
@ApiTags('interop')
@Controller('interop')
export class InteropController {
  constructor(private readonly interop: InteropService) {}

  @Get('health')
  @ApiOperation({ summary: "clinical-suite.md §2's ModuleDescriptor.health(), exposed over HTTP" })
  health() {
    return this.interop.health();
  }

  @Post('share-links')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({
    summary:
      'Issue a revocable, time-limited share link scoped to the caller’s own documents. ' +
      'Refused (503) while health-records is unavailable.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['documentIds', 'ttlSeconds'],
      properties: {
        documentIds: { type: 'array', items: { type: 'string' } },
        ttlSeconds: { type: 'integer' },
      },
    },
  })
  async issueShareLink(@CurrentUser() user: CurrentUserResult, @Body() body: unknown) {
    const input = parseOrThrow(issueShareLinkSchema, body);
    return this.interop.issueShareLink(user.subjectId, input);
  }

  @Get('share-links')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'List every share link the caller has issued, active and expired/revoked alike' })
  listShareLinks(@CurrentUser() user: CurrentUserResult) {
    const items = this.interop.listShareLinks(user.subjectId);
    return { items, total: items.length };
  }

  @Delete('share-links/:id')
  @UseGuards(SessionAuthGuard)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Revoke a share link the caller issued. Permanent — there is no un-revoke.' })
  revokeShareLink(@CurrentUser() user: CurrentUserResult, @Param('id') id: string) {
    return this.interop.revokeShareLink(id, user.subjectId);
  }

  @Get('share/:token')
  @ApiParam({ name: 'token' })
  @ApiOperation({
    summary:
      'Resolve a share link’s bearer token to the FHIR bundle it grants. No session required — the token is ' +
      'the credential. 404 for an unknown token, 410 once expired or revoked.',
  })
  resolveSharedBundle(@Param('token') token: string) {
    return this.interop.resolveSharedBundle(token);
  }
}

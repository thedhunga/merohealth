import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { EARLY_ACCESS_SOURCES } from '../early-access/early-access-store.js';
import { EarlyAccessService } from '../early-access/early-access.service.js';
import { HistoryService } from './history.service.js';

// Mirrors `AnonymousExchange` in `apps/web/src/lib/anonymous-history.ts` —
// `id` is not declared here and is silently stripped by zod's default
// "strip unknown keys" behaviour: it is the client's own local-storage key,
// meaningless once the exchange has a `userId` to live under instead.
const exchangeSchema = z.object({
  askedAt: z.string().trim().min(1).max(200),
  question: z.string().trim().min(1).max(4000),
  answer: z.string().trim().max(20000).nullable(),
  language: z.string().trim().min(1).max(20),
  outcome: z.enum(['answered', 'emergency', 'offTopic', 'unavailable']),
  // Round five, task H. Optional so an exchange saved before this field
  // existed still validates — see `HistoryExchangeInput`'s own comment.
  conversationId: z.string().trim().min(1).max(200).optional(),
  spokenIn: z.boolean().optional(),
});

// Mirrors `AnonymousProfile` — `askedPrompts` (which prompt the person has
// already been shown) is a client-only de-duplication cache with no
// server-side meaning, and is stripped the same way `exchangeSchema` strips
// `id`.
const profileSchema = z.object({
  ageBand: z.string().trim().max(40).optional(),
  conditions: z.array(z.string().trim().max(200)).max(40).optional(),
  askingFor: z.string().trim().max(200).optional(),
});

// Round six L′ — mirrors the local `EarlyAccessRecord` in
// `apps/web/src/lib/early-access.ts`, carried alongside the history snapshot
// so a person who registered interest before signing in ends up linked to
// their account. Optional: most migrations have no early-access record at
// all.
const earlyAccessSchema = z.object({
  contact: z.string().trim().max(254).nullable(),
  source: z.enum(EARLY_ACCESS_SOURCES),
  registeredAt: z.string().trim().min(1).max(200),
});

// The literal shape `snapshotForMigration()` returns — `apps/web` posts it
// to this route unmodified.
const migrateSchema = z.object({
  anonymousId: z.string().trim().min(1).max(200),
  store: z.object({
    version: z.literal(1),
    exchanges: z.array(exchangeSchema).max(40),
    profile: profileSchema,
  }),
  earlyAccess: earlyAccessSchema.optional(),
});

function parseOrThrow<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Invalid request', details: parsed.error.flatten() });
  }
  return parsed.data;
}

/**
 * Round four F1 — the server half of anonymous-history migration.
 * `user-journey-gap.md` row 4/6: the person's pre-sign-in questions must not
 * be lost the moment they create an account. `apps/web`'s `PhoneOtpFlow`
 * (and later Google) calls this immediately after a successful verify, and
 * only clears `localStorage` once this responds 2xx — so this route must be
 * safe to retry, which is `HistoryService.migrate`'s whole idempotency
 * contract. Round six L′ extended it to also link a pending `EarlyAccess`
 * row — see `earlyAccessSchema`'s comment above.
 */
@ApiTags('history')
@Controller('history')
export class HistoryController {
  constructor(
    private readonly history: HistoryService,
    private readonly earlyAccess: EarlyAccessService,
  ) {}

  @Post('migrate')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: "Attach an anonymous device's question history and profile hints to the signed-in account, once, ever" })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['anonymousId', 'store'],
      properties: {
        anonymousId: { type: 'string' },
        store: {
          type: 'object',
          required: ['version', 'exchanges', 'profile'],
          properties: {
            version: { type: 'number', enum: [1] },
            exchanges: { type: 'array' },
            profile: { type: 'object' },
          },
        },
        earlyAccess: {
          type: 'object',
          nullable: true,
          properties: {
            contact: { type: 'string', nullable: true },
            source: { type: 'string', enum: EARLY_ACCESS_SOURCES as unknown as string[] },
            registeredAt: { type: 'string' },
          },
        },
      },
    },
  })
  async migrate(@CurrentUser() user: CurrentUserResult, @Body() body: unknown) {
    const input = parseOrThrow(migrateSchema, body);
    const result = await this.history.migrate({
      userId: user.subjectId,
      anonymousId: input.anonymousId,
      exchanges: input.store.exchanges,
      profile: input.store.profile,
    });
    if (input.earlyAccess) {
      // Swallows its own failure — the history exchanges above are the
      // point of this route, and a person's questions must land even if
      // their interest registration can't be linked this time. A dropped
      // link is safe to retry: the next sign-in sends the same local
      // record again.
      try {
        await this.earlyAccess.linkToUser({
          userId: user.subjectId,
          contact: input.earlyAccess.contact,
          source: input.earlyAccess.source,
          registeredAt: new Date(input.earlyAccess.registeredAt),
        });
      } catch {
        // See comment above.
      }
    }
    return { ok: true, alreadyMigrated: result.alreadyMigrated };
  }
}

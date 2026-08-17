import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { HistoryStore, MigrateHistoryInput } from './history-store.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/**
 * The real `HistoryStore`. `migrate` is a single `$transaction`: the
 * `HistoryMigration` row (unique on `anonymousId`) and every `HistoryExchange`
 * row are written together, so a crash mid-batch never leaves a migration
 * marked done with only some exchanges attached. If the `anonymousId` insert
 * conflicts — a retried request, or two tabs racing the same migration — the
 * transaction's own unique-constraint error is caught here and treated as
 * the same "already migrated" outcome a plain lookup-first would report,
 * without the lookup-then-insert race a separate check would still leave.
 */
@Injectable()
export class PrismaHistoryStore implements HistoryStore {
  constructor(private readonly prisma: PrismaService) {}

  async migrate(input: MigrateHistoryInput): Promise<{ alreadyMigrated: boolean }> {
    const profile = jsonProfile(input.profile);
    try {
      await this.prisma.client.$transaction([
        this.prisma.client.historyMigration.create({
          data: {
            userId: input.userId,
            anonymousId: input.anonymousId,
            // Conditionally spread, not `profileSnapshot: profile ?? undefined`
            // — an optional Prisma input field's value type excludes
            // `undefined` under `exactOptionalPropertyTypes`; only an absent
            // key means "don't set this column".
            ...(profile ? { profileSnapshot: profile } : {}),
          },
        }),
        ...(input.exchanges.length > 0
          ? [
              this.prisma.client.historyExchange.createMany({
                data: input.exchanges.map((exchange) => ({
                  userId: input.userId,
                  askedAt: new Date(exchange.askedAt),
                  question: exchange.question,
                  answer: exchange.answer,
                  language: exchange.language,
                  outcome: exchange.outcome,
                  // Conditionally spread, same `exactOptionalPropertyTypes`
                  // reasoning as `profileSnapshot` above: an absent key means
                  // "leave the column null", not "set it to undefined".
                  ...(exchange.conversationId ? { conversationId: exchange.conversationId } : {}),
                  ...(exchange.spokenIn !== undefined ? { spokenIn: exchange.spokenIn } : {}),
                })),
              }),
            ]
          : []),
      ]);
      return { alreadyMigrated: false };
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return { alreadyMigrated: true };
      throw error;
    }
  }
}

/**
 * `AnonymousProfileSnapshot` has no index signature — `ageBand`/`conditions`/
 * `askingFor` are named, optional fields, not an arbitrary bag — so it is
 * not itself assignable to Prisma's `InputJsonValue`. This rebuilds it as a
 * plain object containing only the fields actually offered, which both
 * satisfies that structural requirement and is the right on-disk shape:
 * a field the person never touched should not appear as `null` in the
 * stored JSON snapshot. Returns `null`, not `{}`, when nothing was offered
 * at all — the caller uses that to omit the column entirely.
 */
function jsonProfile(profile: MigrateHistoryInput['profile']): Record<string, string | string[]> | null {
  const fields: Record<string, string | string[]> = {};
  if (profile.ageBand) fields['ageBand'] = profile.ageBand;
  if (profile.askingFor) fields['askingFor'] = profile.askingFor;
  if (profile.conditions && profile.conditions.length > 0) fields['conditions'] = profile.conditions;
  return Object.keys(fields).length > 0 ? fields : null;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === UNIQUE_CONSTRAINT_VIOLATION;
}

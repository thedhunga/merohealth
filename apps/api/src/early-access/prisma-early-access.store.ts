import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { EarlyAccessRow, EarlyAccessSource, EarlyAccessStore, RegisterEarlyAccessInput, RegisterEarlyAccessOutcome } from './early-access-store.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/**
 * The real `EarlyAccessStore`. `contact` carries the database's own unique
 * constraint, so the create-then-catch idiom here is the same race-safe
 * shape `PrismaHistoryStore.migrate` uses for `anonymousId`: a conflict
 * means someone already holds this contact, and the conditional
 * `updateMany` below is the only path that ever claims it for a `userId`
 * afterwards, so two concurrent sign-ins racing the same contact can never
 * both report `linked`.
 */
@Injectable()
export class PrismaEarlyAccessStore implements EarlyAccessStore {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: RegisterEarlyAccessInput): Promise<{ outcome: RegisterEarlyAccessOutcome }> {
    try {
      await this.prisma.client.earlyAccess.create({
        data: {
          contact: input.contact,
          source: input.source,
          registeredAt: input.registeredAt,
          ...(input.userId ? { userId: input.userId } : {}),
        },
      });
      return { outcome: 'created' };
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      if (input.contact && input.userId) {
        const updated = await this.prisma.client.earlyAccess.updateMany({
          where: { contact: input.contact, userId: null },
          data: { userId: input.userId },
        });
        if (updated.count > 0) return { outcome: 'linked' };
      }
      return { outcome: 'alreadyRegistered' };
    }
  }

  async list(): Promise<EarlyAccessRow[]> {
    const rows = await this.prisma.client.earlyAccess.findMany({ orderBy: { registeredAt: 'asc' } });
    // `source` is a free-form `String` column at the database boundary (see the schema comment) but every write
    // goes through `registerSchema`'s `EARLY_ACCESS_SOURCES` enum, so this cast reflects a real invariant rather
    // than asserting one away.
    return rows.map((row) => ({
      id: row.id,
      contact: row.contact,
      source: row.source as EarlyAccessSource,
      registeredAt: row.registeredAt,
      userId: row.userId,
    }));
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === UNIQUE_CONSTRAINT_VIOLATION;
}

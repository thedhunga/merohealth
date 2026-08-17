import { Injectable } from '@nestjs/common';
import { compareTiers } from '@swasthya/entitlements';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SubscriptionGrantStore } from './subscription-grant.store.js';

/**
 * The real `SubscriptionGrantStore`, against the `Subscription` table
 * `packages/database`'s schema already provisions — see that model's own
 * comment for why a resolver against it is separate future work this store
 * does not do. One row per owner (`ownerId` is `@unique`), so this is a plain
 * upsert, not `PrismaFamilyGrantsStore`'s create-then-find shape: a
 * contributor earning their second reward extends the same row rather than
 * creating a second one.
 */
@Injectable()
export class PrismaSubscriptionGrantStore implements SubscriptionGrantStore {
  constructor(private readonly prisma: PrismaService) {}

  async grantPlusMonths(ownerId: string, months: number): Promise<void> {
    const now = new Date();
    const existing = await this.prisma.client.subscription.findUnique({ where: { ownerId } });

    // Extend from whichever is later — "now" for a lapsed or never-granted
    // subscription, the existing `currentPeriodEnd` for one still running —
    // so an earned reward never shortens time already paid for.
    const periodBase = existing?.currentPeriodEnd && existing.currentPeriodEnd > now ? existing.currentPeriodEnd : now;
    const currentPeriodEnd = addMonths(periodBase, months);

    // Never downgrades an existing Pro subscription to Plus; a FREE or
    // already-Plus owner moves to (or stays at) PLUS.
    const tier = existing && compareTiers(existing.tier, 'PLUS') > 0 ? existing.tier : 'PLUS';

    await this.prisma.client.subscription.upsert({
      where: { ownerId },
      create: { ownerId, tier, currentPeriodStart: now, currentPeriodEnd },
      update: { tier, currentPeriodEnd },
    });
  }
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

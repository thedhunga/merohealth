import { Injectable } from '@nestjs/common';
import type { PlanTier } from '@swasthya/shared-types';

/** DI token — bind to a real Subscription-table-backed resolver once one exists. */
export const SUBSCRIPTION_RESOLVER = 'SUBSCRIPTION_RESOLVER';

export interface SubscriptionResolver {
  resolveTier(ownerId: string): PlanTier;
}

/**
 * Stand-in for the Prisma-backed resolver the `Subscription` schema item
 * (queued right after this one) will provide. No subscription persistence
 * exists yet anywhere the API can read, so every owner is treated as `FREE`
 * — the safe default, since nothing has actually verified anyone as a paying
 * subscriber. This must not be read as "everyone gets FREE forever"; it's
 * the same kind of honest process-local placeholder as `RecordsRepository`,
 * swapped out wholesale once real subscription data exists, not extended.
 */
@Injectable()
export class FreeTierSubscriptionResolver implements SubscriptionResolver {
  resolveTier(): PlanTier {
    return 'FREE';
  }
}

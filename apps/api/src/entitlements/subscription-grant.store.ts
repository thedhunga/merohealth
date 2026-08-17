export const SUBSCRIPTION_GRANT_STORE = 'SUBSCRIPTION_GRANT_STORE';

/**
 * Writes a paid-tier grant against the `Subscription` table the schema
 * already provisions for this — see the schema's own comment on
 * `Subscription`, which names wiring a resolver against it as "future work,
 * not this task." That future work is still `SUBSCRIPTION_RESOLVER`'s to do
 * (its `resolveTier` is synchronous, so a Prisma-backed implementation needs
 * that interface to change first, which is out of scope here); this port
 * only covers the narrower *write* path Reward needs — crediting a
 * contributor's earned Plus months — not resolving anyone's tier for entitlement
 * checks elsewhere. `LanguageCorpusService` is the only caller today.
 */
export interface SubscriptionGrantStore {
  /**
   * Credits `months` of Plus to `ownerId`, extending from the later of "now"
   * and their current `currentPeriodEnd` — so an already-Plus/Pro owner's
   * paid time is never shortened by an earned reward — and never downgrading
   * an existing Pro subscription to Plus.
   */
  grantPlusMonths(ownerId: string, months: number): Promise<void>;
}

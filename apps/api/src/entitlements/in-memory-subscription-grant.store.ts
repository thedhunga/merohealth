import type { SubscriptionGrantStore } from './subscription-grant.store.js';

/**
 * Test fake, same "records what it was asked to do, in order" shape as
 * `InMemoryAuthStore`'s OTP log. `grants` is the assertion surface; `#fail`
 * lets a test exercise `LanguageCorpusService`'s "reward failure must never
 * mask a successful validation" contract without a real store to break.
 */
export class InMemorySubscriptionGrantStore implements SubscriptionGrantStore {
  readonly grants: { ownerId: string; months: number }[] = [];

  constructor(private readonly failWith: Error | null = null) {}

  grantPlusMonths(ownerId: string, months: number): Promise<void> {
    if (this.failWith) return Promise.reject(this.failWith);
    this.grants.push({ ownerId, months });
    return Promise.resolve();
  }
}

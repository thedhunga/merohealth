import type { TwinFact } from '@swasthya/shared-types';
import type { ConfirmTwinProfileInput, TwinProfileStore } from './twin-profile-store.js';

/**
 * A hand-rolled `TwinProfileStore` fake, test-only — mirrors
 * `InMemoryHistoryStore`'s reason for existing: `TwinProfileService` and
 * `TwinProfileController` can be exercised without a live Postgres.
 */
export class InMemoryTwinProfileStore implements TwinProfileStore {
  readonly factsByUserId = new Map<string, TwinFact[]>();

  confirmFacts(input: ConfirmTwinProfileInput): Promise<{ created: number }> {
    const existing = this.factsByUserId.get(input.userId) ?? [];
    this.factsByUserId.set(input.userId, [...existing, ...input.facts]);
    return Promise.resolve({ created: input.facts.length });
  }
}

import type { HistoryStore, MigrateHistoryInput } from './history-store.js';

/**
 * A hand-rolled `HistoryStore` fake, test-only — mirrors
 * `InMemoryFamilyGrantsStore`'s reason for existing: `HistoryService` and
 * `HistoryController` can be exercised without a live Postgres.
 */
export class InMemoryHistoryStore implements HistoryStore {
  readonly migrations: MigrateHistoryInput[] = [];
  private readonly seenAnonymousIds = new Set<string>();

  migrate(input: MigrateHistoryInput): Promise<{ alreadyMigrated: boolean }> {
    if (this.seenAnonymousIds.has(input.anonymousId)) {
      return Promise.resolve({ alreadyMigrated: true });
    }
    this.seenAnonymousIds.add(input.anonymousId);
    this.migrations.push(input);
    return Promise.resolve({ alreadyMigrated: false });
  }
}

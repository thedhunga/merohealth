import { Inject, Injectable } from '@nestjs/common';
import { HISTORY_STORE, type HistoryStore, type MigrateHistoryInput } from './history-store.js';

@Injectable()
export class HistoryService {
  constructor(@Inject(HISTORY_STORE) private readonly store: HistoryStore) {}

  migrate(input: MigrateHistoryInput): Promise<{ alreadyMigrated: boolean }> {
    return this.store.migrate(input);
  }
}

import type { EarlyAccessRow, EarlyAccessStore, RegisterEarlyAccessInput, RegisterEarlyAccessOutcome } from './early-access-store.js';

interface Row extends RegisterEarlyAccessInput {
  id: string;
}

/** A hand-rolled `EarlyAccessStore` fake, test-only — mirrors `InMemoryHistoryStore`'s reason for existing. */
export class InMemoryEarlyAccessStore implements EarlyAccessStore {
  readonly rows: Row[] = [];

  register(input: RegisterEarlyAccessInput): Promise<{ outcome: RegisterEarlyAccessOutcome }> {
    const existing = input.contact ? this.rows.find((row) => row.contact === input.contact) : undefined;
    if (existing) {
      if (existing.userId === null && input.userId !== null) {
        existing.userId = input.userId;
        return Promise.resolve({ outcome: 'linked' });
      }
      return Promise.resolve({ outcome: 'alreadyRegistered' });
    }
    this.rows.push({ ...input, id: `early-${this.rows.length + 1}` });
    return Promise.resolve({ outcome: 'created' });
  }

  list(): Promise<EarlyAccessRow[]> {
    const sorted = [...this.rows].sort((a, b) => a.registeredAt.getTime() - b.registeredAt.getTime());
    return Promise.resolve(sorted.map(({ id, contact, source, registeredAt, userId }) => ({ id, contact, source, registeredAt, userId })));
  }
}

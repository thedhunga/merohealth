export const EARLY_ACCESS_STORE = 'EARLY_ACCESS_STORE';

/** Mirrors `EarlyAccessRecord['source']` in `apps/web/src/lib/early-access.ts` — kept as the single source of truth for the zod enum both `EarlyAccessController` and `HistoryController` validate against. */
export const EARLY_ACCESS_SOURCES = ['pricing', 'get-care', 'other'] as const;

export type EarlyAccessSource = (typeof EARLY_ACCESS_SOURCES)[number];

export interface RegisterEarlyAccessInput {
  /** Already canonicalised — see `normaliseContact` — or `null` for an anonymous, contact-less registration. */
  contact: string | null;
  source: EarlyAccessSource;
  registeredAt: Date;
  /** Set only when this call comes from `HistoryController.migrate`, i.e. the person is signed in. */
  userId: string | null;
}

export type RegisterEarlyAccessOutcome = 'created' | 'alreadyRegistered' | 'linked';

/** One row of the launch-day contact list — everything the CSV export needs, nothing more. */
export interface EarlyAccessRow {
  id: string;
  contact: string | null;
  source: EarlyAccessSource;
  registeredAt: Date;
  userId: string | null;
}

/**
 * Port behind `POST /early-access` and `HistoryController.migrate`'s
 * anon→account linking step — same "port here, `Prisma*` adapter plus an
 * in-memory test fake" shape as `HistoryStore`.
 */
export interface EarlyAccessStore {
  /**
   * Anonymous call (`userId: null`): creates a row, deduped by `contact`
   * when one is given — a retry with the same contact is a no-op
   * (`alreadyRegistered`), matching every anonymous-write route in this
   * codebase (see `HistoryStore.migrate`). No contact means no dedupe key,
   * so every contact-less call creates its own row (`created`).
   *
   * Authenticated call (`userId` set): if an earlier anonymous row already
   * exists for this contact, it is linked to the account (`linked`) rather
   * than duplicated. A contact already linked to a *different* account is
   * left untouched (`alreadyRegistered`) — this store never reassigns an
   * existing link.
   */
  register(input: RegisterEarlyAccessInput): Promise<{ outcome: RegisterEarlyAccessOutcome }>;

  /** Every row, oldest registration first — the owner-only CSV export reads this and nothing else. */
  list(): Promise<EarlyAccessRow[]>;
}

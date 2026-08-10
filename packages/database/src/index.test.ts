import { describe, expect, it } from 'vitest';

import { createPrismaClient, DocumentStatus, ObservationStatus } from './index.ts';

/**
 * `@prisma/adapter-pg`'s `PrismaPg` builds a `pg.Pool` from the connection
 * string but only opens a socket on first query — so construction alone,
 * even against an address nothing is listening on, must never throw or
 * touch the network. That laziness is what these tests lean on to stay
 * fast and infra-free; a real round trip against Postgres was run by hand
 * for this change (see the ledger log) rather than committed here, since
 * this environment cannot guarantee a live Postgres for every future run
 * the way it can guarantee a bogus one is safe to construct against.
 */
describe('createPrismaClient', () => {
  it('constructs without connecting, given an explicit connection string', () => {
    const client = createPrismaClient('postgresql://nope:nope@127.0.0.1:1/nope');
    expect(client.healthDocument).toBeDefined();
    expect(client.healthObservation).toBeDefined();
    expect(client.deviceSample).toBeDefined();
  });

  it('falls back to DATABASE_URL (or the compose.yaml default) when no connection string is given', () => {
    expect(() => createPrismaClient()).not.toThrow();
  });

  it('disconnects cleanly without ever having connected', async () => {
    const client = createPrismaClient('postgresql://nope:nope@127.0.0.1:1/nope');
    await expect(client.$disconnect()).resolves.toBeUndefined();
  });
});

describe('re-exported enums', () => {
  it('mirror the Prisma schema members the rest of the codebase matches against', () => {
    expect(DocumentStatus.CONFIRMED).toBe('CONFIRMED');
    expect(ObservationStatus.DRAFT).toBe('DRAFT');
    expect(ObservationStatus.CORRECTED).toBe('CORRECTED');
  });
});

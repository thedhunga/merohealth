import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/client.ts';

export { PrismaClient } from '../generated/client.ts';
export * from '../generated/enums.ts';

/**
 * The generator this schema uses (`provider = "prisma-client"`, Prisma 7's
 * ESM-first client) drops the old `datasources: { db: { url } }` constructor
 * shape — `new PrismaClient()` now throws `PrismaClientInitializationError`
 * ("a driver adapter is required") the instant anything actually tries to
 * connect. Nothing in this repo constructs a `PrismaClient` yet (see
 * `apps/api/src/language-corpus/corpus-reviewer.guard.ts`'s doc comment), so
 * this had never been exercised against a real database until this file —
 * every module so far talks to in-memory fakes. `createPrismaClient` is the
 * one place a caller should ever build a client from, so the driver-adapter
 * wiring lives here once rather than being copy-pasted at every future call
 * site.
 */
export function createPrismaClient(connectionString: string = defaultConnectionString()): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// Mirrors prisma.config.ts's own fallback, which only the Prisma CLI reads —
// this is the same default for callers that construct a client at runtime
// instead of going through the CLI.
function defaultConnectionString(): string {
  return process.env['DATABASE_URL'] ?? 'postgresql://swasthya:swasthya@localhost:5432/swasthya';
}

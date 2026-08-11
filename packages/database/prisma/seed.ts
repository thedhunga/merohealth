// Entirely fictional demonstration data. Never replace with patient production
// data. Run via `pnpm --filter @swasthya/database seed` (or root `pnpm
// db:seed`) against a real Postgres — see docs/product/agent-progress.md
// Round two A2. The actual dataset lives in ../src/seed-data.ts, which stays
// pure and DB-free so it can be unit-tested on its own; this script is just
// the thin apply step, matching createPrismaClient() as the one place a
// caller should ever construct a client from (../src/index.ts).
import { createPrismaClient } from '../src/index.ts';
import {
  conditions,
  deviceSamples,
  directoryEntities,
  featureFlags,
  guardianshipGrants,
  healthDocuments,
  healthObservations,
  organizations,
  patientProfiles,
  plans,
  subscriptions,
  usageCounters,
  users,
} from '../src/seed-data.ts';

const prisma = createPrismaClient();

/**
 * Every table here is upserted by its own fixed id, `update: {}` — insert
 * once, then no-op on every later run. Mirrors the `ON CONFLICT (...) DO
 * NOTHING` idempotency the previous raw-SQL seed used, so re-running this
 * against a database that already has the demonstration data is always safe.
 */
async function upsertAll<T extends { id: string }>(
  label: string,
  rows: readonly T[],
  upsert: (row: T) => Promise<unknown>,
): Promise<void> {
  for (const row of rows) {
    await upsert(row);
  }
  console.log(`  ${label}: ${rows.length}`);
}

async function main(): Promise<void> {
  console.log('Seeding demonstration dataset...');

  await upsertAll('organizations', organizations, (row) =>
    prisma.organization.upsert({ where: { id: row.id }, create: row, update: {} }),
  );
  await upsertAll('directoryEntities', directoryEntities, (row) =>
    prisma.directoryEntity.upsert({ where: { id: row.id }, create: row, update: {} }),
  );
  await upsertAll('featureFlags', featureFlags, (row) =>
    prisma.featureFlag.upsert({ where: { id: row.id }, create: row, update: {} }),
  );
  await upsertAll('plans', plans, (row) => prisma.plan.upsert({ where: { id: row.id }, create: row, update: {} }));

  // Subjects before the records that point at them — no DB-level foreign
  // keys exist yet (see schema.prisma's "Personal health platform" comment),
  // but writing them in dependency order keeps this script readable.
  await upsertAll('users', users, (row) => prisma.user.upsert({ where: { id: row.id }, create: row, update: {} }));
  await upsertAll('patientProfiles', patientProfiles, (row) =>
    prisma.patientProfile.upsert({ where: { id: row.id }, create: row, update: {} }),
  );
  await upsertAll('guardianshipGrants', guardianshipGrants, (row) =>
    prisma.guardianshipGrant.upsert({ where: { id: row.id }, create: row, update: {} }),
  );
  await upsertAll('healthDocuments', healthDocuments, (row) =>
    prisma.healthDocument.upsert({ where: { id: row.id }, create: row, update: {} }),
  );
  await upsertAll('healthObservations', healthObservations, (row) =>
    prisma.healthObservation.upsert({ where: { id: row.id }, create: row, update: {} }),
  );
  await upsertAll('deviceSamples', deviceSamples, (row) =>
    prisma.deviceSample.upsert({ where: { id: row.id }, create: row, update: {} }),
  );
  await upsertAll('conditions', conditions, (row) =>
    prisma.condition.upsert({ where: { id: row.id }, create: row, update: {} }),
  );
  await upsertAll('subscriptions', subscriptions, (row) =>
    prisma.subscription.upsert({ where: { id: row.id }, create: row, update: {} }),
  );
  await upsertAll('usageCounters', usageCounters, (row) =>
    prisma.usageCounter.upsert({ where: { id: row.id }, create: row, update: {} }),
  );

  console.log('Seed complete.');
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

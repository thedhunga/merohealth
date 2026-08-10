import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@swasthya/database';

/**
 * The first thing in `apps/api` to actually construct a `PrismaClient` —
 * every module before `AuthModule` (Round two A3) talks to an in-memory
 * repository, per `createPrismaClient`'s own doc comment in
 * `packages/database`. Composition, not `extends PrismaClient`: the
 * driver-adapter wiring stays owned by `createPrismaClient` alone, so there
 * is exactly one place that ever decides how a client gets built.
 *
 * No `onModuleInit`/`$connect()` — `PrismaPg`'s underlying `pg.Pool` opens
 * its socket lazily on the first query (see A1's log in
 * `docs/product/agent-progress.md`), so this stays safe to instantiate even
 * when nothing has queried yet, e.g. under `pnpm test`/`pnpm build`, neither
 * of which is guaranteed a live Postgres in every environment.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor() {
    this.client = createPrismaClient();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}

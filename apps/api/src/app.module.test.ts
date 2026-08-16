import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';

/**
 * Every other test in this app exercises a service or controller directly,
 * constructed by hand — nothing ever asked Nest to resolve the real module
 * graph the way `NestFactory.create(AppModule)` does in `main.ts`. That gap
 * let `ClinicalChartingModule` and `BillingModule` ship with `SessionAuthGuard`
 * on a controller but no `AuthModule` import to supply its `AuthService`
 * dependency — `RecordsModule`/`ClinicalChartingModule` import `AuthModule`
 * internally but only export their own service, so the guard was
 * unresolvable one hop further out. Nothing caught it until this run
 * actually booted the compiled app against a real, migrated, seeded
 * Postgres (see docs/product/agent-progress.md, Round three C2) and hit
 * `UnknownDependenciesException` at startup. `compile()` alone reproduces
 * the same resolution Nest does at boot without needing a live database —
 * `PrismaService` builds its client lazily (see `prisma.service.ts`), so no
 * socket ever opens here.
 */
describe('AppModule', () => {
  it('resolves every provider and guard in the real module graph', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(moduleRef).toBeDefined();

    await moduleRef.close();
  });
});

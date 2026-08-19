import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OwnerGuard } from '../auth/owner.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EARLY_ACCESS_STORE } from './early-access-store.js';
import { EarlyAccessController } from './early-access.controller.js';
import { EarlyAccessRateLimiter } from './early-access-rate-limiter.js';
import { EarlyAccessService } from './early-access.service.js';
import { PrismaEarlyAccessStore } from './prisma-early-access.store.js';

// Exports `EarlyAccessService` — `HistoryModule` imports this module so
// `HistoryController.migrate` can link an anonymous `EarlyAccess` row to the
// newly signed-in account in the same request, per the schema comment on
// `EarlyAccess`. Imports `AuthModule` for `SessionAuthGuard` and to make
// `OwnerGuard` available to `EarlyAccessController.export`, the same
// "import the module, get the guard" wiring `IdentityModule` uses.
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EarlyAccessController],
  providers: [
    EarlyAccessRateLimiter,
    EarlyAccessService,
    OwnerGuard,
    { provide: EARLY_ACCESS_STORE, useClass: PrismaEarlyAccessStore },
  ],
  exports: [EarlyAccessService],
})
export class EarlyAccessModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EARLY_ACCESS_STORE } from './early-access-store.js';
import { EarlyAccessController } from './early-access.controller.js';
import { EarlyAccessRateLimiter } from './early-access-rate-limiter.js';
import { EarlyAccessService } from './early-access.service.js';
import { PrismaEarlyAccessStore } from './prisma-early-access.store.js';

// Exports `EarlyAccessService` — `HistoryModule` imports this module so
// `HistoryController.migrate` can link an anonymous `EarlyAccess` row to the
// newly signed-in account in the same request, per the schema comment on
// `EarlyAccess`.
@Module({
  imports: [PrismaModule],
  controllers: [EarlyAccessController],
  providers: [EarlyAccessRateLimiter, EarlyAccessService, { provide: EARLY_ACCESS_STORE, useClass: PrismaEarlyAccessStore }],
  exports: [EarlyAccessService],
})
export class EarlyAccessModule {}

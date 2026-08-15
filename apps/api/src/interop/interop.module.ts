import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EntitlementsGuard } from '../entitlements/entitlements.guard.js';
import { FreeTierSubscriptionResolver, SUBSCRIPTION_RESOLVER } from '../entitlements/subscription-resolver.js';
import { USAGE_READER } from '../entitlements/usage-reader.js';
import { RecordsModule } from '../records/records.module.js';
import { InteropController } from './interop.controller.js';
import { InteropRepository } from './interop.repository.js';
import { InteropUsageReader } from './interop-usage.reader.js';
import { InteropService } from './interop.service.js';

/**
 * Imports `RecordsModule` for `RecordsService` — this module's one real
 * dependency, per its `ModuleDescriptor` — and `AuthModule` for
 * `SessionAuthGuard`, the same "import the module, get the guard" pattern
 * `RecordsModule` itself documents. Also binds this module's own
 * `EntitlementsGuard`/`SUBSCRIPTION_RESOLVER`/`USAGE_READER`, the same
 * `RecordsModule` wiring for `RECORD_SHARING`/`ACTIVE_SHARE_LINKS` — the
 * entitlements catalogue already prices both; only the guard was missing.
 */
@Module({
  imports: [AuthModule, RecordsModule],
  controllers: [InteropController],
  providers: [
    InteropRepository,
    InteropService,
    InteropUsageReader,
    EntitlementsGuard,
    { provide: SUBSCRIPTION_RESOLVER, useClass: FreeTierSubscriptionResolver },
    { provide: USAGE_READER, useClass: InteropUsageReader },
  ],
  exports: [InteropService],
})
export class InteropModule {}

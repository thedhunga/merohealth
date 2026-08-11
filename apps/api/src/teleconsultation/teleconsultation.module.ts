import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EntitlementsGuard } from '../entitlements/entitlements.guard.js';
import { NoQuotaUsageReader } from '../entitlements/no-quota-usage.reader.js';
import { FreeTierSubscriptionResolver, SUBSCRIPTION_RESOLVER } from '../entitlements/subscription-resolver.js';
import { USAGE_READER } from '../entitlements/usage-reader.js';
import { SchedulingModule } from '../scheduling/scheduling.module.js';
import { TeleconsultationController } from './teleconsultation.controller.js';
import { TeleconsultationRepository } from './teleconsultation.repository.js';
import { TeleconsultationService } from './teleconsultation.service.js';

/**
 * Imports `AuthModule` for `SessionAuthGuard` and binds this module's own
 * `EntitlementsGuard`/`SUBSCRIPTION_RESOLVER`/`USAGE_READER` — the same
 * "import the module, get the guard" wiring `RecordsModule` established.
 * `USAGE_READER` binds to `NoQuotaUsageReader` because `schedule` is gated
 * on `@RequireModule` alone; there is no `@RequireQuota` here for a real
 * reader to meter.
 */
@Module({
  imports: [AuthModule, SchedulingModule],
  controllers: [TeleconsultationController],
  providers: [
    TeleconsultationRepository,
    TeleconsultationService,
    EntitlementsGuard,
    { provide: SUBSCRIPTION_RESOLVER, useClass: FreeTierSubscriptionResolver },
    { provide: USAGE_READER, useClass: NoQuotaUsageReader },
  ],
  exports: [TeleconsultationService],
})
export class TeleconsultationModule {}

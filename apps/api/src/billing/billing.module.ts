import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClinicalChartingModule } from '../clinical-charting/clinical-charting.module.js';
import { BillingController } from './billing.controller.js';
import { BillingRepository } from './billing.repository.js';
import { BillingService } from './billing.service.js';

/**
 * Imports `AuthModule` directly for `SessionAuthGuard` — same gap as
 * `ClinicalChartingModule` had: `ClinicalChartingModule` only exports its
 * own service, not the `AuthModule` it happens to import internally, so
 * `SessionAuthGuard` was unresolvable here even though `BillingController`
 * declares it.
 */
@Module({
  imports: [ClinicalChartingModule, AuthModule],
  controllers: [BillingController],
  providers: [BillingRepository, BillingService],
  exports: [BillingService],
})
export class BillingModule {}

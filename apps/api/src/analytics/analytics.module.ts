import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module.js';
import { EngagementModule } from '../engagement/engagement.module.js';
import { PatientRegistryModule } from '../patient-registry/patient-registry.module.js';
import { ReferralsModule } from '../referrals/referrals.module.js';
import { SchedulingModule } from '../scheduling/scheduling.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

/**
 * No repository provider — this module owns no data of its own, per
 * clinical-suite.md capability map row 14's "read-only replica."
 */
@Module({
  imports: [PatientRegistryModule, SchedulingModule, BillingModule, ReferralsModule, EngagementModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OwnerGuard } from '../auth/owner.guard.js';
import { BillingModule } from '../billing/billing.module.js';
import { DiagnosticsOrdersModule } from '../diagnostics-orders/diagnostics-orders.module.js';
import { EngagementModule } from '../engagement/engagement.module.js';
import { ImmunizationModule } from '../immunization/immunization.module.js';
import { PatientRegistryModule } from '../patient-registry/patient-registry.module.js';
import { ReferralsModule } from '../referrals/referrals.module.js';
import { SchedulingModule } from '../scheduling/scheduling.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

/**
 * No repository provider — this module owns no data of its own, per
 * clinical-suite.md capability map row 14's "read-only replica." Imports
 * `AuthModule` directly (not transitively) for `SessionAuthGuard` — the
 * same "import the module, get the guard" wiring `EarlyAccessModule` and
 * `PrescribingModule` use, and `immunization.module.ts` documents why a
 * transitive re-export leaves the guard unresolvable.
 */
@Module({
  imports: [
    PatientRegistryModule,
    SchedulingModule,
    BillingModule,
    ReferralsModule,
    EngagementModule,
    ImmunizationModule,
    DiagnosticsOrdersModule,
    AuthModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, OwnerGuard],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}

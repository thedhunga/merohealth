import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { ClinicalChartingModule } from '../clinical-charting/clinical-charting.module.js';
import { ClinicalSummaryModule } from '../clinical-summary/clinical-summary.module.js';
import { DiagnosticsOrdersModule } from '../diagnostics-orders/diagnostics-orders.module.js';
import { EngagementModule } from '../engagement/engagement.module.js';
import { ImmunizationModule } from '../immunization/immunization.module.js';
import { InteropModule } from '../interop/interop.module.js';
import { MedicationSafetyModule } from '../medication-safety/medication-safety.module.js';
import { PatientRegistryModule } from '../patient-registry/patient-registry.module.js';
import { PopulationHealthModule } from '../population-health/population-health.module.js';
import { PrescribingModule } from '../prescribing/prescribing.module.js';
import { RecordsModule } from '../records/records.module.js';
import { ReferralsModule } from '../referrals/referrals.module.js';
import { SchedulingModule } from '../scheduling/scheduling.module.js';
import { TeleconsultationModule } from '../teleconsultation/teleconsultation.module.js';
import { ClinicalSuiteController } from './clinical-suite.controller.js';
import { ClinicalSuiteService } from './clinical-suite.service.js';

/**
 * Imports every module up to `interop` purely to reuse the services Nest
 * already constructed for them — this module owns no data and no
 * repository of its own, only the aggregate view over the others'
 * already-exported ports.
 */
@Module({
  imports: [
    RecordsModule,
    PatientRegistryModule,
    SchedulingModule,
    ClinicalChartingModule,
    ClinicalSummaryModule,
    MedicationSafetyModule,
    PrescribingModule,
    DiagnosticsOrdersModule,
    TeleconsultationModule,
    BillingModule,
    ReferralsModule,
    PopulationHealthModule,
    AnalyticsModule,
    EngagementModule,
    InteropModule,
    ImmunizationModule,
  ],
  controllers: [ClinicalSuiteController],
  providers: [ClinicalSuiteService],
})
export class ClinicalSuiteModule {}

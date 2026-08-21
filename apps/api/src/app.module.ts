import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BillingModule } from './billing/billing.module.js';
import { ClinicalChartingModule } from './clinical-charting/clinical-charting.module.js';
import { ClinicalSuiteModule } from './clinical-suite/clinical-suite.module.js';
import { ClinicalSummaryModule } from './clinical-summary/clinical-summary.module.js';
import { CompanionAssessRateLimiter } from './companion-assess-rate-limiter.js';
import { CompanionResearchRateLimiter } from './companion-research-rate-limiter.js';
import { CompanionController } from './companion.controller.js';
import { CredentialingModule } from './credentialing/credentialing.module.js';
import { DiagnosticsOrdersModule } from './diagnostics-orders/diagnostics-orders.module.js';
import { DirectoryController } from './directory.controller.js';
import { EarlyAccessModule } from './early-access/early-access.module.js';
import { EngagementModule } from './engagement/engagement.module.js';
import { FamilyModule } from './family/family.module.js';
import { HealthController } from './health.controller.js';
import { HistoryModule } from './history/history.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { LanguageCorpusModule } from './language-corpus/language-corpus.module.js';
import { MedicationSafetyModule } from './medication-safety/medication-safety.module.js';
import { PatientRegistryModule } from './patient-registry/patient-registry.module.js';
import { PerplexityHealthService } from './perplexity-health.service.js';
import { PopulationHealthModule } from './population-health/population-health.module.js';
import { PrescribingModule } from './prescribing/prescribing.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RecordsModule } from './records/records.module.js';
import { ReferralsModule } from './referrals/referrals.module.js';
import { SchedulingModule } from './scheduling/scheduling.module.js';
import { TeleconsultationModule } from './teleconsultation/teleconsultation.module.js';
import { TwinProfileModule } from './twin-profile/twin-profile.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    RecordsModule,
    CredentialingModule,
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
    ClinicalSuiteModule,
    LanguageCorpusModule,
    FamilyModule,
    IdentityModule,
    HistoryModule,
    TwinProfileModule,
    EarlyAccessModule,
  ],
  controllers: [HealthController, CompanionController, DirectoryController],
  providers: [PerplexityHealthService, CompanionResearchRateLimiter, CompanionAssessRateLimiter],
})
export class AppModule {}

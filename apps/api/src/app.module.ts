import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { ClinicalChartingModule } from './clinical-charting/clinical-charting.module.js';
import { ClinicalSuiteModule } from './clinical-suite/clinical-suite.module.js';
import { ClinicalSummaryModule } from './clinical-summary/clinical-summary.module.js';
import { CompanionController } from './companion.controller.js';
import { CredentialingModule } from './credentialing/credentialing.module.js';
import { DirectoryController } from './directory.controller.js';
import { FamilyModule } from './family/family.module.js';
import { HealthController } from './health.controller.js';
import { LanguageCorpusModule } from './language-corpus/language-corpus.module.js';
import { MedicationSafetyModule } from './medication-safety/medication-safety.module.js';
import { PatientRegistryModule } from './patient-registry/patient-registry.module.js';
import { PerplexityHealthService } from './perplexity-health.service.js';
import { PrescribingModule } from './prescribing/prescribing.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RecordsModule } from './records/records.module.js';
import { SchedulingModule } from './scheduling/scheduling.module.js';

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
    ClinicalSuiteModule,
    LanguageCorpusModule,
    FamilyModule,
  ],
  controllers: [HealthController, CompanionController, DirectoryController],
  providers: [PerplexityHealthService],
})
export class AppModule {}

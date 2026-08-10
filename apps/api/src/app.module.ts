import { Module } from '@nestjs/common';
import { ClinicalChartingModule } from './clinical-charting/clinical-charting.module.js';
import { ClinicalSummaryModule } from './clinical-summary/clinical-summary.module.js';
import { CompanionController } from './companion.controller.js';
import { CredentialingModule } from './credentialing/credentialing.module.js';
import { DirectoryController } from './directory.controller.js';
import { HealthController } from './health.controller.js';
import { LanguageCorpusModule } from './language-corpus/language-corpus.module.js';
import { MedicationSafetyModule } from './medication-safety/medication-safety.module.js';
import { PatientRegistryModule } from './patient-registry/patient-registry.module.js';
import { PerplexityHealthService } from './perplexity-health.service.js';
import { PrescribingModule } from './prescribing/prescribing.module.js';
import { RecordsModule } from './records/records.module.js';
import { SchedulingModule } from './scheduling/scheduling.module.js';

@Module({
  imports: [
    RecordsModule,
    CredentialingModule,
    PatientRegistryModule,
    SchedulingModule,
    ClinicalChartingModule,
    ClinicalSummaryModule,
    MedicationSafetyModule,
    PrescribingModule,
    LanguageCorpusModule,
  ],
  controllers: [HealthController, CompanionController, DirectoryController],
  providers: [PerplexityHealthService],
})
export class AppModule {}

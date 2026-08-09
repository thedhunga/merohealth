import { Module } from '@nestjs/common';
import { ClinicalChartingModule } from './clinical-charting/clinical-charting.module.js';
import { CompanionController } from './companion.controller.js';
import { CredentialingModule } from './credentialing/credentialing.module.js';
import { DirectoryController } from './directory.controller.js';
import { HealthController } from './health.controller.js';
import { PatientRegistryModule } from './patient-registry/patient-registry.module.js';
import { PerplexityHealthService } from './perplexity-health.service.js';
import { RecordsModule } from './records/records.module.js';
import { SchedulingModule } from './scheduling/scheduling.module.js';

@Module({
  imports: [RecordsModule, CredentialingModule, PatientRegistryModule, SchedulingModule, ClinicalChartingModule],
  controllers: [HealthController, CompanionController, DirectoryController],
  providers: [PerplexityHealthService],
})
export class AppModule {}

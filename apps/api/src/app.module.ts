import { Module } from '@nestjs/common';
import { CompanionController } from './companion.controller.js';
import { CredentialingModule } from './credentialing/credentialing.module.js';
import { DirectoryController } from './directory.controller.js';
import { HealthController } from './health.controller.js';
import { PatientRegistryModule } from './patient-registry/patient-registry.module.js';
import { PerplexityHealthService } from './perplexity-health.service.js';
import { RecordsModule } from './records/records.module.js';

@Module({
  imports: [RecordsModule, CredentialingModule, PatientRegistryModule],
  controllers: [HealthController, CompanionController, DirectoryController],
  providers: [PerplexityHealthService],
})
export class AppModule {}

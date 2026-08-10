import { Module } from '@nestjs/common';
import { PatientRegistryController } from './patient-registry.controller.js';
import { PatientRegistryRepository } from './patient-registry.repository.js';
import { PatientRegistryService } from './patient-registry.service.js';

@Module({
  controllers: [PatientRegistryController],
  providers: [PatientRegistryRepository, PatientRegistryService],
  exports: [PatientRegistryService],
})
export class PatientRegistryModule {}

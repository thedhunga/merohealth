import { Module } from '@nestjs/common';
import { PatientRegistryModule } from '../patient-registry/patient-registry.module.js';
import { SchedulingController } from './scheduling.controller.js';
import { SchedulingRepository } from './scheduling.repository.js';
import { SchedulingService } from './scheduling.service.js';

@Module({
  imports: [PatientRegistryModule],
  controllers: [SchedulingController],
  providers: [SchedulingRepository, SchedulingService],
  exports: [SchedulingService],
})
export class SchedulingModule {}

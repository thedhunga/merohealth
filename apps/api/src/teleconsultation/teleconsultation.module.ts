import { Module } from '@nestjs/common';
import { SchedulingModule } from '../scheduling/scheduling.module.js';
import { TeleconsultationController } from './teleconsultation.controller.js';
import { TeleconsultationRepository } from './teleconsultation.repository.js';
import { TeleconsultationService } from './teleconsultation.service.js';

@Module({
  imports: [SchedulingModule],
  controllers: [TeleconsultationController],
  providers: [TeleconsultationRepository, TeleconsultationService],
  exports: [TeleconsultationService],
})
export class TeleconsultationModule {}

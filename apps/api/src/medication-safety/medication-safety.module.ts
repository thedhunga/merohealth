import { Module } from '@nestjs/common';
import { ClinicalSummaryModule } from '../clinical-summary/clinical-summary.module.js';
import { MedicationSafetyController } from './medication-safety.controller.js';
import { MedicationSafetyRepository } from './medication-safety.repository.js';
import { MedicationSafetyService } from './medication-safety.service.js';

@Module({
  imports: [ClinicalSummaryModule],
  controllers: [MedicationSafetyController],
  providers: [MedicationSafetyRepository, MedicationSafetyService],
  exports: [MedicationSafetyService],
})
export class MedicationSafetyModule {}

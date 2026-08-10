import { Module } from '@nestjs/common';
import { ClinicalChartingModule } from '../clinical-charting/clinical-charting.module.js';
import { MedicationSafetyModule } from '../medication-safety/medication-safety.module.js';
import { PrescribingController } from './prescribing.controller.js';
import { PrescribingRepository } from './prescribing.repository.js';
import { PrescribingService } from './prescribing.service.js';

@Module({
  imports: [ClinicalChartingModule, MedicationSafetyModule],
  controllers: [PrescribingController],
  providers: [PrescribingRepository, PrescribingService],
  exports: [PrescribingService],
})
export class PrescribingModule {}

import { Module } from '@nestjs/common';
import { ClinicalChartingModule } from '../clinical-charting/clinical-charting.module.js';
import { ImmunizationController } from './immunization.controller.js';
import { ImmunizationRepository } from './immunization.repository.js';
import { ImmunizationService } from './immunization.service.js';

@Module({
  imports: [ClinicalChartingModule],
  controllers: [ImmunizationController],
  providers: [ImmunizationRepository, ImmunizationService],
  exports: [ImmunizationService],
})
export class ImmunizationModule {}

import { Module } from '@nestjs/common';
import { ClinicalChartingModule } from '../clinical-charting/clinical-charting.module.js';
import { ClinicalSummaryController } from './clinical-summary.controller.js';
import { ClinicalSummaryRepository } from './clinical-summary.repository.js';
import { ClinicalSummaryService } from './clinical-summary.service.js';

@Module({
  imports: [ClinicalChartingModule],
  controllers: [ClinicalSummaryController],
  providers: [ClinicalSummaryRepository, ClinicalSummaryService],
  exports: [ClinicalSummaryService],
})
export class ClinicalSummaryModule {}

import { Module } from '@nestjs/common';
import { RecordsModule } from '../records/records.module.js';
import { ClinicalChartingController } from './clinical-charting.controller.js';
import { ClinicalChartingRepository } from './clinical-charting.repository.js';
import { ClinicalChartingService } from './clinical-charting.service.js';

@Module({
  imports: [RecordsModule],
  controllers: [ClinicalChartingController],
  providers: [ClinicalChartingRepository, ClinicalChartingService],
  exports: [ClinicalChartingService],
})
export class ClinicalChartingModule {}

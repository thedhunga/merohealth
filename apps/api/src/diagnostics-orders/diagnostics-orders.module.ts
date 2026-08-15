import { Module } from '@nestjs/common';
import { ClinicalChartingModule } from '../clinical-charting/clinical-charting.module.js';
import { DiagnosticsOrdersController } from './diagnostics-orders.controller.js';
import { DiagnosticsOrdersRepository } from './diagnostics-orders.repository.js';
import { DiagnosticsOrdersService } from './diagnostics-orders.service.js';

@Module({
  imports: [ClinicalChartingModule],
  controllers: [DiagnosticsOrdersController],
  providers: [DiagnosticsOrdersRepository, DiagnosticsOrdersService],
  exports: [DiagnosticsOrdersService],
})
export class DiagnosticsOrdersModule {}

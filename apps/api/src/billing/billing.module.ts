import { Module } from '@nestjs/common';
import { ClinicalChartingModule } from '../clinical-charting/clinical-charting.module.js';
import { BillingController } from './billing.controller.js';
import { BillingRepository } from './billing.repository.js';
import { BillingService } from './billing.service.js';

@Module({
  imports: [ClinicalChartingModule],
  controllers: [BillingController],
  providers: [BillingRepository, BillingService],
  exports: [BillingService],
})
export class BillingModule {}

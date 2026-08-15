import { Module } from '@nestjs/common';
import { ClinicalChartingModule } from '../clinical-charting/clinical-charting.module.js';
import { ReferralsController } from './referrals.controller.js';
import { ReferralsRepository } from './referrals.repository.js';
import { ReferralsService } from './referrals.service.js';

@Module({
  imports: [ClinicalChartingModule],
  controllers: [ReferralsController],
  providers: [ReferralsRepository, ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}

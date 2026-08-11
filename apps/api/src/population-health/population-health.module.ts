import { Module } from '@nestjs/common';
import { ClinicalSummaryModule } from '../clinical-summary/clinical-summary.module.js';
import { SchedulingModule } from '../scheduling/scheduling.module.js';
import { PopulationHealthController } from './population-health.controller.js';
import { PopulationHealthService } from './population-health.service.js';

/**
 * No repository provider — this module owns no data of its own, per
 * clinical-suite.md capability map row 13's "reads from other modules;
 * never writes to them."
 */
@Module({
  imports: [ClinicalSummaryModule, SchedulingModule],
  controllers: [PopulationHealthController],
  providers: [PopulationHealthService],
  exports: [PopulationHealthService],
})
export class PopulationHealthModule {}

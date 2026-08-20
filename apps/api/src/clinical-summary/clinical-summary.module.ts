import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClinicalChartingModule } from '../clinical-charting/clinical-charting.module.js';
import { ClinicalSummaryController } from './clinical-summary.controller.js';
import { ClinicalSummaryRepository } from './clinical-summary.repository.js';
import { ClinicalSummaryService } from './clinical-summary.service.js';

// Imports `AuthModule` directly (not transitively) for `SessionAuthGuard` —
// `clinical-charting.module.ts` documents why: relying on another module's
// re-export leaves the guard unresolvable here even when a sibling
// controller works fine off the same import.
@Module({
  imports: [ClinicalChartingModule, AuthModule],
  controllers: [ClinicalSummaryController],
  providers: [ClinicalSummaryRepository, ClinicalSummaryService],
  exports: [ClinicalSummaryService],
})
export class ClinicalSummaryModule {}

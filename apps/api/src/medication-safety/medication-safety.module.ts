import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClinicalSummaryModule } from '../clinical-summary/clinical-summary.module.js';
import { MedicationSafetyController } from './medication-safety.controller.js';
import { MedicationSafetyRepository } from './medication-safety.repository.js';
import { MedicationSafetyService } from './medication-safety.service.js';

// Imports `AuthModule` directly (not transitively) for `SessionAuthGuard` —
// `clinical-charting.module.ts` documents why: relying on another module's
// re-export leaves the guard unresolvable here even when a sibling
// controller works fine off the same import.
@Module({
  imports: [ClinicalSummaryModule, AuthModule],
  controllers: [MedicationSafetyController],
  providers: [MedicationSafetyRepository, MedicationSafetyService],
  exports: [MedicationSafetyService],
})
export class MedicationSafetyModule {}

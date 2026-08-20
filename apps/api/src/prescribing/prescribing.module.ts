import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClinicalChartingModule } from '../clinical-charting/clinical-charting.module.js';
import { MedicationSafetyModule } from '../medication-safety/medication-safety.module.js';
import { PrescribingController } from './prescribing.controller.js';
import { PrescribingRepository } from './prescribing.repository.js';
import { PrescribingService } from './prescribing.service.js';

// Imports `AuthModule` directly (not transitively) for `SessionAuthGuard` —
// `immunization.module.ts` documents why: relying on another module's
// re-export leaves the guard unresolvable here even when a sibling
// controller works fine off the same import.
@Module({
  imports: [ClinicalChartingModule, MedicationSafetyModule, AuthModule],
  controllers: [PrescribingController],
  providers: [PrescribingRepository, PrescribingService],
  exports: [PrescribingService],
})
export class PrescribingModule {}

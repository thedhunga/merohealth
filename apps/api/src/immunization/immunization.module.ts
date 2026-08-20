import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClinicalChartingModule } from '../clinical-charting/clinical-charting.module.js';
import { ImmunizationController } from './immunization.controller.js';
import { ImmunizationRepository } from './immunization.repository.js';
import { ImmunizationService } from './immunization.service.js';

// Imports `AuthModule` directly (not transitively) for `SessionAuthGuard` —
// `diagnostics-orders.module.ts` documents why: relying on another module's
// re-export leaves the guard unresolvable here even when a sibling
// controller works fine off the same import.
@Module({
  imports: [ClinicalChartingModule, AuthModule],
  controllers: [ImmunizationController],
  providers: [ImmunizationRepository, ImmunizationService],
  exports: [ImmunizationService],
})
export class ImmunizationModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClinicalChartingModule } from '../clinical-charting/clinical-charting.module.js';
import { DiagnosticsOrdersController } from './diagnostics-orders.controller.js';
import { DiagnosticsOrdersRepository } from './diagnostics-orders.repository.js';
import { DiagnosticsOrdersService } from './diagnostics-orders.service.js';

// Imports `AuthModule` directly (not transitively) for `SessionAuthGuard` —
// `clinical-summary.module.ts` documents why: relying on another module's
// re-export leaves the guard unresolvable here even when a sibling
// controller works fine off the same import.
@Module({
  imports: [ClinicalChartingModule, AuthModule],
  controllers: [DiagnosticsOrdersController],
  providers: [DiagnosticsOrdersRepository, DiagnosticsOrdersService],
  exports: [DiagnosticsOrdersService],
})
export class DiagnosticsOrdersModule {}

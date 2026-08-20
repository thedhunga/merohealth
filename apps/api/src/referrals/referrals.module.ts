import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClinicalChartingModule } from '../clinical-charting/clinical-charting.module.js';
import { ReferralsController } from './referrals.controller.js';
import { ReferralsRepository } from './referrals.repository.js';
import { ReferralsService } from './referrals.service.js';

// Imports `AuthModule` directly (not transitively) for `SessionAuthGuard` —
// `immunization.module.ts` documents why: relying on another module's
// re-export leaves the guard unresolvable here even when a sibling
// controller works fine off the same import.
@Module({
  imports: [ClinicalChartingModule, AuthModule],
  controllers: [ReferralsController],
  providers: [ReferralsRepository, ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}

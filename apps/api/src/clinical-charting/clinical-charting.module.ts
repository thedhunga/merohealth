import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RecordsModule } from '../records/records.module.js';
import { ClinicalChartingController } from './clinical-charting.controller.js';
import { ClinicalChartingRepository } from './clinical-charting.repository.js';
import { ClinicalChartingService } from './clinical-charting.service.js';

/**
 * Imports `AuthModule` directly for `SessionAuthGuard` — `RecordsModule`
 * imports it too but only exports `RecordsService`, so relying on that
 * import transitively (as this module did before) leaves `SessionAuthGuard`
 * unresolvable here even though `RecordsController` next door works fine.
 * Every route-guarded module in this app follows "import the module, get
 * the guard" directly against `AuthModule`; this one had drifted from it
 * silently because no unit test boots the real Nest module graph.
 */
@Module({
  imports: [RecordsModule, AuthModule],
  controllers: [ClinicalChartingController],
  providers: [ClinicalChartingRepository, ClinicalChartingService],
  exports: [ClinicalChartingService],
})
export class ClinicalChartingModule {}

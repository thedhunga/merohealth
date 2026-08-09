import type { ClinicalModuleDescriptor } from '@swasthya/shared-types';
import type { ClinicalChartingService } from './clinical-charting.service.js';

/**
 * clinical-suite.md §2's fault-isolation contract for this module.
 * `requires` stays empty — charting still runs with health-records down,
 * just with document attachment unavailable — while `degradesWith` names
 * exactly what capability map row 3 says: charting "consumes health-records."
 * `HIDE` per §2's own definition ("remove the surface entirely; nothing else
 * notices") — the attach action is the only thing this module offers that
 * touches health-records at all; opening encounters and writing SOAP notes
 * are unaffected.
 */
export function createClinicalChartingModuleDescriptor(service: ClinicalChartingService): ClinicalModuleDescriptor {
  return {
    key: 'CLINICAL_CHARTING',
    requires: [],
    degradesWith: [{ key: 'HEALTH_RECORDS', mode: 'HIDE' }],
    health: () => service.health(),
  };
}

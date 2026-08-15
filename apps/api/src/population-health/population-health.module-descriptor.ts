import type { ClinicalModuleDescriptor } from '@swasthya/shared-types';
import type { PopulationHealthService } from './population-health.service.js';

/**
 * clinical-suite.md §2's fault-isolation contract for this module.
 * `requires` stays empty — neither dependency ever throws outright, both
 * degrade — and `degradesWith` names the two real dependencies the service
 * has: `CLINICAL_SUMMARY`, the owner of the data a registry is built from,
 * and `SCHEDULING`, the owner of the data a recall list adds on top. Both
 * `HIDE`: unlike `MEDICATION_SAFETY`'s own `MANUAL` degradation (row 5,
 * where a caller can still act on a "checks unavailable" result), a
 * registry or recall list computed from an incomplete read would misreport
 * who is and is not in it — there is no honest partial answer to show, so
 * the surface hides instead.
 */
export function createPopulationHealthModuleDescriptor(service: PopulationHealthService): ClinicalModuleDescriptor {
  return {
    key: 'POPULATION_HEALTH',
    requires: [],
    degradesWith: [
      { key: 'CLINICAL_SUMMARY', mode: 'HIDE' },
      { key: 'SCHEDULING', mode: 'HIDE' },
    ],
    health: () => service.health(),
  };
}

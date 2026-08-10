import type { ClinicalModuleDescriptor } from '@swasthya/shared-types';
import type { RecordsService } from './records.service.js';

/**
 * clinical-suite.md §2's fault-isolation contract for `HEALTH_RECORDS`.
 * `requires` and `degradesWith` are both empty: this module already existed
 * as `packages/health-records` before the clinical-suite fault-isolation
 * system did, and nothing in this codebase makes health-records itself
 * depend on another clinical-suite module. `clinical-charting` is the first
 * module to declare `degradesWith` against `HEALTH_RECORDS` — this file is
 * the real descriptor it resolves against, not a placeholder, the same
 * "foundation descriptor first" shape `patient-registry`'s own descriptor
 * set for `scheduling`.
 */
export function createHealthRecordsModuleDescriptor(service: RecordsService): ClinicalModuleDescriptor {
  return {
    key: 'HEALTH_RECORDS',
    requires: [],
    degradesWith: [],
    health: () => service.health(),
  };
}

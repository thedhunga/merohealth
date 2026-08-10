import type { ClinicalModuleDescriptor } from '@swasthya/shared-types';
import type { SchedulingService } from './scheduling.service.js';

/**
 * clinical-suite.md §2's fault-isolation contract for this module.
 * `requires` stays empty — scheduling still runs with patient-registry
 * down, just in a degraded mode — while `degradesWith` names exactly what
 * capability map row 2 says: `READ_ONLY` against `PATIENT_REGISTRY`. This is
 * the first real `degradesWith` edge in the registry; `patient-registry`'s
 * own descriptor declared both lists empty because nothing sits above it.
 */
export function createSchedulingModuleDescriptor(service: SchedulingService): ClinicalModuleDescriptor {
  return {
    key: 'SCHEDULING',
    requires: [],
    degradesWith: [{ key: 'PATIENT_REGISTRY', mode: 'READ_ONLY' }],
    health: () => service.health(),
  };
}

import type { ClinicalModuleDescriptor } from '@swasthya/shared-types';
import type { PatientRegistryService } from './patient-registry.service.js';

/**
 * clinical-suite.md §2's fault-isolation contract for this module.
 * `requires` and `degradesWith` are both empty: capability map row 1 names
 * patient-registry "the foundation" everything else depends on, so there is
 * nothing above it in the dependency graph for it to lean on. Later modules
 * (`scheduling` first, per §4's sequencing) will list `PATIENT_REGISTRY` in
 * their own `degradesWith` — this file is the real descriptor they resolve
 * against, not a placeholder.
 */
export function createPatientRegistryModuleDescriptor(service: PatientRegistryService): ClinicalModuleDescriptor {
  return {
    key: 'PATIENT_REGISTRY',
    requires: [],
    degradesWith: [],
    health: () => service.health(),
  };
}

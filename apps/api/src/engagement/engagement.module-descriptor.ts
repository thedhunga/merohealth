import type { ClinicalModuleDescriptor } from '@swasthya/shared-types';
import type { EngagementService } from './engagement.service.js';

/**
 * clinical-suite.md §2's fault-isolation contract for this module.
 * `requires` stays empty — reading, listing and retrying a message all
 * still work with patient-registry down, only queuing a new one against a
 * patient is refused — while `degradesWith` names the one real dependency:
 * `HIDE` against `PATIENT_REGISTRY`, the same mode `ReferralsService`'s own
 * descriptor uses for the identical "opening a clinical action against a
 * foundation module" shape.
 */
export function createEngagementModuleDescriptor(service: EngagementService): ClinicalModuleDescriptor {
  return {
    key: 'ENGAGEMENT',
    requires: [],
    degradesWith: [{ key: 'PATIENT_REGISTRY', mode: 'HIDE' }],
    health: () => service.health(),
  };
}
